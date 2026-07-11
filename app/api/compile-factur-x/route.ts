import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
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

    // 1. Fetch full invoice + owner's profile details
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

    // 4. Attach the factur-x.xml file to the PDF
    await pdfDoc.attach(Buffer.from(xmlString), 'factur-x.xml', {
      mimeType: 'text/xml',
      description: 'Factur-X Machine Readable Billing Metadata',
      creationDate: new Date(),
      modificationDate: new Date()
    });

    // 5. Save the updated PDF
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
