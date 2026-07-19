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
      bankName,
      bankAccountNumber,
      bankRoutingNumber,
      paymentLinkUrl,
      contactEmail
    } = body;

    if (!invoiceId || !clientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Server-side cooldown and language snapshot lookup
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('last_followup_sent_at, lang_snapshot')
      .eq('id', invoiceId)
      .single();

    if (existing?.last_followup_sent_at) {
      const lastSent = new Date(existing.last_followup_sent_at).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastSent < sevenDaysMs) {
        return NextResponse.json(
          { error: 'Cooldown active', cooldown: true },
          { status: 429 }
        );
      }
    }

    // Use direct database language configuration, fall back to English 'EN'
    const activeLang = existing?.lang_snapshot || 'EN';
    const isFr = activeLang === 'FR';
    const currencySymbol = currency === 'EUR' ? '€' : '$';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
      : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${businessName}</h2>`;

    const hasBankDetails = bankName || bankAccountNumber;
    const bankLabel = isFr ? 'Banque' : 'Bank';
    const accountLabel = isFr ? 'IBAN' : 'Account';
    const routingLabel = isFr ? 'BIC/SWIFT' : 'Routing';
    const orText = isFr ? '— ou —' : '— or —';

    const bankRowsHtml = hasBankDetails
      ? `
        <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 10px 0;">
          ${isFr ? 'Virement bancaire' : 'Bank Transfer'}
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;">
          ${bankName ? `<tr><td style="color:#9ca3af;font-weight:600;padding:3px 12px 3px 0;white-space:nowrap;width:80px;">${bankLabel}</td><td style="color:#111827;font-weight:700;word-break:break-all;overflow-wrap:break-word;">${bankName}</td></tr>` : ''}
          ${bankAccountNumber ? `<tr><td style="color:#9ca3af;font-weight:600;padding:3px 12px 3px 0;white-space:nowrap;width:80px;">${accountLabel}</td><td style="color:#111827;font-family:monospace;word-break:break-all;overflow-wrap:break-word;">${bankAccountNumber}</td></tr>` : ''}
          ${bankRoutingNumber ? `<tr><td style="color:#9ca3af;font-weight:600;padding:3px 12px 3px 0;white-space:nowrap;width:80px;">${routingLabel}</td><td style="color:#111827;font-family:monospace;word-break:break-all;overflow-wrap:break-word;">${bankRoutingNumber}</td></tr>` : ''}
        </table>`
      : '';

    const orSeparatorHtml =
      hasBankDetails && paymentLinkUrl
        ? `<p style="text-align:center;font-size:11px;font-weight:800;color:#9ca3af;letter-spacing:0.15em;margin:16px 0;">${orText}</p>`
        : '';

    const payLinkHtml = paymentLinkUrl
      ? `<div style="text-align:center;"><a href="${paymentLinkUrl}" style="display:inline-block;background:#2563eb;color:white;padding:11px 28px;border-radius:8px;text-decoration:none;font-weight:800;font-size:13px;">${isFr ? 'Payer en ligne' : 'Pay Online'}</a></div>`
      : '';

    let paymentHtml = '';
    if (hasBankDetails || paymentLinkUrl) {
      paymentHtml = `
        <div style="margin-top: 24px; padding: 20px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #374151; margin: 0 0 16px 0;">
            ${isFr ? 'Instructions de paiement' : 'Payment Instructions'}
          </p>
          ${bankRowsHtml}
          ${orSeparatorHtml}
          ${payLinkHtml}
        </div>`;
    }

    const replyAddress = contactEmail || ownerEmail;
    const contactLine = isFr
      ? `Des questions ? Répondez à cet e-mail ou contactez-nous à <a href="mailto:${replyAddress}" style="color:#2563eb;">${replyAddress}</a>.`
      : `Questions? Reply to this email or reach us at <a href="mailto:${replyAddress}" style="color:#2563eb;">${replyAddress}</a>.`;

    const subject = isFr
      ? `Rappel — Facture ${invoiceNumber} en attente de règlement`
      : `Reminder — Invoice ${invoiceNumber} pending payment`;

    const htmlContent = isFr
      ? `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">Bonjour ${clientName},</h2>
        <p style="line-height: 1.6; color: #4b5563;">Je me permets de vous relancer concernant la facture <strong>${invoiceNumber}</strong> d'un montant de <strong>${currencySymbol}${grandTotal}</strong>${dueDate ? `, dont l'échéance était le <strong>${dueDate}</strong>` : ''}, qui reste en attente de règlement.</p>
        <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Voir la Facture
        </a>
        ${paymentHtml}
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.6;">${contactLine}</p>
      </div>`
      : `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">Hello ${clientName},</h2>
        <p style="line-height: 1.6; color: #4b5563;">This is a friendly reminder about invoice <strong>${invoiceNumber}</strong> for <strong>${currencySymbol}${grandTotal}</strong>${dueDate ? `, which was due on <strong>${dueDate}</strong>` : ''}, which remains unpaid.</p>
        <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          View Invoice
        </a>
        ${paymentHtml}
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.6;">${contactLine}</p>
      </div>`;

    const { error } = await resend.emails.send({
      from: `${businessName} <estimates@pactestim.com>`,
      to: [clientEmail],
      replyTo: ownerEmail,
      subject,
      html: htmlContent
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    await supabaseAdmin
      .from('invoices')
      .update({ last_followup_sent_at: new Date().toISOString() })
      .eq('id', invoiceId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
