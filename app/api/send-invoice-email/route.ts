import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      invoiceId,
      clientEmail,
      clientName,
      invoiceUrl,
      businessName,
      ownerEmail,
      logoUrl,
      country,
      invoiceNumber,
      grandTotal,
      currency,
      dueDate,
      bankWireInstructions,
      paymentLinkUrl
    } = body;

    if (!invoiceId || !clientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const isFr = country === 'FR';
    const currencySymbol = currency === 'EUR' ? '€' : '$';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
      : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${businessName}</h2>`;

    // Payment instructions block
    let paymentHtml = '';
    if (bankWireInstructions || paymentLinkUrl) {
      paymentHtml = `
      <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; margin-bottom: 12px;">
          ${isFr ? 'Instructions de paiement' : 'Payment Instructions'}
        </p>
        ${
          bankWireInstructions
            ? `
          <p style="font-size: 12px; color: #6b7280; font-weight: bold; margin-bottom: 4px;">
            ${isFr ? 'Virement bancaire' : 'Bank Transfer'}
          </p>
          <p style="font-size: 12px; color: #374151; white-space: pre-wrap; margin-bottom: 12px;">${bankWireInstructions}</p>
        `
            : ''
        }
        ${
          paymentLinkUrl
            ? `
          <a href="${paymentLinkUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">
            ${isFr ? 'Payer en ligne' : 'Pay Online'}
          </a>
        `
            : ''
        }
      </div>
    `;
    }

    const subject = isFr
      ? `Facture ${invoiceNumber} — ${businessName}`
      : `Invoice ${invoiceNumber} from ${businessName}`;

    const htmlContent = isFr
      ? `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">Bonjour ${clientName},</h2>
        <p style="line-height: 1.6; color: #4b5563;">Veuillez trouver ci-joint votre facture <strong>${invoiceNumber}</strong> de <strong>${businessName}</strong>.</p>
        <div style="margin: 24px 0; padding: 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 4px 0;">Montant Total</p>
              <p style="font-size: 24px; font-weight: 900; color: #1e40af; margin: 0;">${currencySymbol}${grandTotal}</p>
            </div>
            ${
              dueDate
                ? `<div style="text-align: right;">
              <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 4px 0;">Échéance</p>
              <p style="font-size: 14px; font-weight: bold; color: #374151; margin: 0;">${dueDate}</p>
            </div>`
                : ''
            }
          </div>
        </div>
        <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 8px;">
          Consulter la Facture
        </a>
        ${paymentHtml}
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          Des questions ? Répondez directement à cet e-mail pour contacter ${businessName} à ${ownerEmail}.
        </p>
      </div>`
      : `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">Hello ${clientName},</h2>
        <p style="line-height: 1.6; color: #4b5563;">Please find your invoice <strong>${invoiceNumber}</strong> from <strong>${businessName}</strong> attached below.</p>
        <div style="margin: 24px 0; padding: 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 4px 0;">Amount Due</p>
              <p style="font-size: 24px; font-weight: 900; color: #1e40af; margin: 0;">${currencySymbol}${grandTotal}</p>
            </div>
            ${
              dueDate
                ? `<div style="text-align: right;">
              <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 4px 0;">Due Date</p>
              <p style="font-size: 14px; font-weight: bold; color: #374151; margin: 0;">${dueDate}</p>
            </div>`
                : ''
            }
          </div>
        </div>
        <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 8px;">
          View Invoice
        </a>
        ${paymentHtml}
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          Any questions? Reply to this email to reach ${businessName} at ${ownerEmail}.
        </p>
      </div>`;

    const { error } = await resend.emails.send({
      from: `${businessName} <estimates@pactestim.com>`,
      to: [clientEmail],
      replyTo: ownerEmail,
      subject,
      html: htmlContent
    });

    if (error) {
      console.error('[send-invoice-email] Resend error:', error);
      return NextResponse.json({ error }, { status: 500 });
    }

    // Track last_email_sent_at
    await supabaseAdmin
      .from('invoices')
      .update({ last_email_sent_at: new Date().toISOString() })
      .eq('id', invoiceId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send-invoice-email] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
