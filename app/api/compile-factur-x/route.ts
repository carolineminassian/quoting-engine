import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
      AFRelationship: PDFName.of('Alternative') // MUST be Alternative for Factur-X
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

    // Set /Names in Catalog
    let namesDict = catalog.get(PDFName.of('Names'));
    if (!namesDict || !(namesDict instanceof PDFDict)) {
      namesDict = context.obj({});
      catalog.set(PDFName.of('Names'), namesDict);
    }
    (namesDict as PDFDict).set(
      PDFName.of('EmbeddedFiles'),
      embeddedFilesNamesRef
    );

    // Set /AF in Catalog (Associated Files)
    let afArray = catalog.get(PDFName.of('AF'));
    if (!afArray || !(afArray instanceof PDFArray)) {
      afArray = PDFArray.withContext(context);
      catalog.set(PDFName.of('AF'), afArray);
    }
    (afArray as PDFArray).push(fileSpecRef);

    // D. Inject XMP Metadata Stream declaring PDF/A-3b and Factur-X conformance
    const xmpMetadataString = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <!-- PDF/A Conformance identification -->
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>3</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
  <!-- Factur-X schema metadata -->
  <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
   <fx:DocumentType>INVOICE</fx:DocumentType>
   <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
   <fx:Version>1.0</fx:Version>
   <fx:Profile>BASIC</fx:Profile>
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

    // E. Save the fully updated PDF/A-3 b document
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

    // 7. Update database record to announce successful Factur-X compilation
    await supabaseAdmin
      .from('invoices')
      .update({ factur_x_compiled: true })
      .eq('id', invoiceId);

    return NextResponse.json({
      success: true,
      pdfBase64: modifiedBase64,
      filePath: filePath
    });
  } catch (err: any) {
    console.error('Factur-X compilation failed:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
