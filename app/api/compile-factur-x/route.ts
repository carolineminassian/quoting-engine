import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFDict,
  PDFArray,
  PDFRawStream
} from 'pdf-lib';
import { generateFacturXXML } from '@/lib/facturXGenerator';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId, pdfBase64 } = await request.json();

    if (!invoiceId || !pdfBase64) {
      return NextResponse.json(
        { error: 'Missing invoiceId or PDF data' },
        { status: 400 }
      );
    }

    // 1. Fetch invoice + owner's profile details
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found.' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found.' },
        { status: 404 }
      );
    }

    // 2. Generate compliant XML string
    const xmlString = generateFacturXXML({ invoice, profile });

    // 3. Load PDF into pdf-lib
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const context = pdfDoc.context;

    // ─── PDF/A-3 & Factur-X Low-Level Catalog Compilation ───

    // A. Embed the XML file stream
    const xmlBuffer = Buffer.from(xmlString, 'utf-8');
    const xmlStream = context.stream(xmlBuffer, {
      Type: 'EmbeddedFile',
      Subtype: 'text/xml',
      Params: context.obj({
        Size: xmlBuffer.length,
        CreationDate: PDFString.fromDate(new Date()),
        ModDate: PDFString.fromDate(new Date())
      })
    });
    const xmlStreamRef = context.register(xmlStream);

    // B. Create the File Specification Dictionary
    const fileSpecDict = context.obj({
      Type: 'Filespec',
      F: PDFString.of('factur-x.xml'),
      UF: PDFString.of('factur-x.xml'),
      EF: context.obj({ F: xmlStreamRef }),
      AFRelationship: PDFName.of('Alternative')
    });
    const fileSpecRef = context.register(fileSpecDict);

    // C. Create the Names Tree and attach /EmbeddedFiles to the Catalog
    const namesArray = PDFArray.withContext(context);
    namesArray.push(PDFString.of('factur-x.xml'));
    namesArray.push(fileSpecRef);

    const embeddedFilesNamesDict = context.obj({
      Names: namesArray
    });
    const embeddedFilesNamesRef = context.register(embeddedFilesNamesDict);

    const catalog = pdfDoc.catalog;

    let namesDict = catalog.get(PDFName.of('Names'));
    if (!namesDict || !(namesDict instanceof PDFDict)) {
      namesDict = context.obj({});
      catalog.set(PDFName.of('Names'), namesDict);
    }
    (namesDict as PDFDict).set(
      PDFName.of('EmbeddedFiles'),
      embeddedFilesNamesRef
    );

    let afArray = catalog.get(PDFName.of('AF'));
    if (!afArray || !(afArray instanceof PDFArray)) {
      afArray = PDFArray.withContext(context);
      catalog.set(PDFName.of('AF'), afArray);
    }
    (afArray as PDFArray).push(fileSpecRef);

    // D. Read and Embed ICC Profile directly from the local file system
    // This avoids network latency and ensures it works seamlessly on both localhost and production.
    const iccPath = path.join(
      process.cwd(),
      'public',
      'sRGB_IEC61966-2-1_black_scaled.icc'
    );
    const iccBuffer = fs.readFileSync(iccPath);

    const profileStream = context.stream(new Uint8Array(iccBuffer), {
      N: 3,
      Alternate: PDFName.of('DeviceRGB')
    });
    const profileStreamRef = context.register(profileStream);

    const outputIntentDict = context.obj({
      Type: 'OutputIntent',
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
      RegistryName: PDFString.of('http://www.color.org'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
      DestOutputProfile: profileStreamRef
    });

    const outputIntentsArray = context.obj([outputIntentDict]);
    catalog.set(PDFName.of('OutputIntents'), outputIntentsArray);

    // E. Inject XMP Metadata with PDF/A Extension Schema (Fixes XMPProperty Error)
    const xmpMetadataString = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    
    <!-- PDF/A Conformance identification -->
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>

    <!-- PDF/A Extension Schema for Factur-X -->
    <rdf:Description rdf:about=""
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The name of the embedded XML document</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The type of the hybrid document in capital letters</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The actual version of the standard applying to the embedded XML document</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The conformance level of the embedded XML document</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>

    <!-- Factur-X schema properties -->
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>BASIC</fx:ConformanceLevel>
    </rdf:Description>

  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const xmpStream = context.stream(Buffer.from(xmpMetadataString, 'utf-8'), {
      Type: 'Metadata',
      Subtype: 'XML'
    });
    const xmpStreamRef = context.register(xmpStream);
    catalog.set(PDFName.of('Metadata'), xmpStreamRef);

    // F. Save the fully updated PDF/A-3b document
    const modifiedPdfBytes = await pdfDoc.save();
    const modifiedBase64 = Buffer.from(modifiedPdfBytes).toString('base64');

    // 6. Upload compiled PDF to Supabase storage bucket
    const bucketName = 'invoices';
    const filePath = `${user.id}/${invoice.id}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, Buffer.from(modifiedPdfBytes), {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Extract or compute the 9-digit SIREN for both parties from snapshots (needed for French PPF envelope schema)
    // Fallback: If SIREN is blank but SIRET is present, slice the first 9 digits.
    const rawSellerSiret = invoice.business_reg_snapshot || ''; // Often stores the French SIRET
    const sellerSiren =
      invoice.business_siren ||
      (rawSellerSiret.replace(/\s+/g, '').length >= 9
        ? rawSellerSiret.replace(/\s+/g, '').substring(0, 9)
        : '');

    const rawBuyerSiret = invoice.client_siret || '';
    const buyerSiren =
      invoice.client_siren ||
      (rawBuyerSiret.replace(/\s+/g, '').length >= 9
        ? rawBuyerSiret.replace(/\s+/g, '').substring(0, 9)
        : '');

    // 7. Auto-Route to French State Portal (PPF Sandbox) if API credentials are configured
    let ppfReceiptId = null;
    let ppfStatus = null;

    if (process.env.PPF_CLIENT_ID && process.env.PPF_CLIENT_SECRET) {
      const { transmitInvoiceToPPF } = await import('@/lib/ppfRouter');

      if (!sellerSiren || !buyerSiren) {
        console.warn(
          `PPF Submission skipped for invoice ${invoice.invoice_number}: Missing required SIREN identifiers. Seller: ${sellerSiren}, Buyer: ${buyerSiren}`
        );
      } else {
        const ppfResult = await transmitInvoiceToPPF({
          pdfBuffer: Buffer.from(modifiedPdfBytes),
          invoiceNumber: invoice.invoice_number,
          sellerSiren,
          buyerSiren
        });

        if (ppfResult.success) {
          ppfReceiptId = ppfResult.ppfRegistryId;
          ppfStatus = ppfResult.status;
        } else {
          console.error(
            `PPF Submission failed for invoice ${invoice.invoice_number}:`,
            ppfResult.error
          );
        }
      }
    }

    // 8. Update database record to announce successful Factur-X compilation
    await supabaseAdmin
      .from('invoices')
      .update({
        factur_x_compiled: true,
        // Save the state portal registration receipts in the database
        ppf_receipt_id: ppfReceiptId || null,
        ppf_status: ppfStatus || null
      })
      .eq('id', invoiceId);

    return NextResponse.json({
      success: true,
      pdfBase64: modifiedBase64,
      filePath: filePath,
      ppfReceiptId
    });
  } catch (err: any) {
    console.error('Factur-X compilation failed:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
