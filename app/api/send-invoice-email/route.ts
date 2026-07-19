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
      lang_snapshot,
      langSnapshot,
      // Structured bank fields (replaces bankWireInstructions blob)
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

    // Server-Side Source of Truth Lookup:
    // Query the database directly using the verified invoiceId to get the true lang_snapshot
    const { data: dbInvoice } = await supabaseAdmin
      .from('invoices')
      .select('lang_snapshot, country_snapshot')
      .eq('id', invoiceId)
      .single();

    // Prioritize the database value first, then payload parameter, then fallback to country snapshot
    const activeLang =
      dbInvoice?.lang_snapshot || langSnapshot || lang_snapshot;
    const activeCountry = dbInvoice?.country_snapshot || country;

    const isFr = activeLang ? activeLang === 'FR' : activeCountry === 'FR';
    const currencySymbol = currency === 'EUR' ? '€' : '$';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
      : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px; font-weight: 800;">${businessName}</h2>`;

    const hasBankDetails = bankName || bankAccountNumber;
    const hasPayLink = !!paymentLinkUrl;

    // ── Payment block ──────────────────────────────────────────
    let paymentHtml = '';
    if (hasBankDetails || hasPayLink) {
      const bankLabel = isFr ? 'Banque' : 'Bank';
      const accountLabel = isFr ? 'IBAN' : 'Account';
      const routingLabel = isFr ? 'BIC/SWIFT' : 'Routing';
      const transferTitle = isFr ? 'Virement bancaire' : 'Bank Transfer';
      const orText = isFr ? '— ou —' : '— or —';
      const payOnlineText = isFr ? 'Payer en ligne' : 'Pay Online';
      const paymentTitle = isFr
        ? 'Instructions de paiement'
        : 'Payment Instructions';

      const bankRowsHtml = hasBankDetails
        ? `
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 10px 0;">
            ${transferTitle}
          </p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;">
            ${
              bankName
                ? `
            <tr>
              <td style="color: #9ca3af; font-weight: 600; padding: 3px 12px 3px 0; white-space: nowrap; vertical-align: top;">${bankLabel}</td>
              <td style="color: #111827; font-weight: 700;">${bankName}</td>
            </tr>`
                : ''
            }
            ${
              bankAccountNumber
                ? `
            <tr>
              <td style="color: #9ca3af; font-weight: 600; padding: 3px 12px 3px 0; white-space: nowrap; vertical-align: top; width: 80px;">${accountLabel}</td>
              <td style="color: #111827; font-family: monospace; font-weight: 600; word-break: break-all; overflow-wrap: break-word;">${bankAccountNumber}</td>
            </tr>`
                : ''
            }
            ${
              bankRoutingNumber
                ? `
            <tr>
              <td style="color: #9ca3af; font-weight: 600; padding: 3px 12px 3px 0; white-space: nowrap; vertical-align: top; width: 80px;">${routingLabel}</td>
              <td style="color: #111827; font-family: monospace; font-weight: 600; word-break: break-all; overflow-wrap: break-word;">${bankRoutingNumber}</td>
            </tr>`
                : ''
            }
          </table>`
        : '';

      const orSeparatorHtml =
        hasBankDetails && hasPayLink
          ? `<p style="text-align: center; font-size: 11px; font-weight: 800; color: #9ca3af; letter-spacing: 0.15em; margin: 16px 0;">${orText}</p>`
          : '';

      const payLinkHtml = hasPayLink
        ? `<div style="text-align: center;">
            <a href="${paymentLinkUrl}"
               style="display: inline-block; background: #2563eb; color: white; padding: 11px 28px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 13px; letter-spacing: 0.05em;">
              ${payOnlineText}
            </a>
          </div>`
        : '';

      paymentHtml = `
        <div style="margin-top: 24px; padding: 20px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #374151; margin: 0 0 16px 0;">
            ${paymentTitle}
          </p>
          ${bankRowsHtml}
          ${orSeparatorHtml}
          ${payLinkHtml}
        </div>`;
    }

    // ── Contact line ───────────────────────────────────────────
    const replyAddress = contactEmail || ownerEmail;
    const contactLine = isFr
      ? `Des questions ? Répondez à cet e-mail ou contactez-nous à <a href="mailto:${replyAddress}" style="color: #2563eb;">${replyAddress}</a>.`
      : `Questions? Reply to this email or reach us at <a href="mailto:${replyAddress}" style="color: #2563eb;">${replyAddress}</a>.`;

    // ── Amount + due date block ────────────────────────────────
    const amountBlock = `
      <div style="margin: 24px 0; padding: 16px 20px; background: #eff6ff; border-radius: 10px; border: 1px solid #bfdbfe;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 4px 0;">
                ${isFr ? 'Montant Total' : 'Amount Due'}
              </p>
              <p style="font-size: 26px; font-weight: 900; color: #1e40af; margin: 0; font-family: monospace;">
                ${currencySymbol}${grandTotal}
              </p>
            </td>
            ${
              dueDate
                ? `
            <td style="vertical-align: middle; text-align: right;">
              <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 4px 0;">
                ${isFr ? 'Échéance' : 'Due Date'}
              </p>
              <p style="font-size: 14px; font-weight: 700; color: #374151; margin: 0;">${dueDate}</p>
            </td>`
                : ''
            }
          </tr>
        </table>
      </div>`;

    const subject = isFr
      ? `Facture ${invoiceNumber} — ${businessName}`
      : `Invoice ${invoiceNumber} from ${businessName}`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px 0;">
          ${isFr ? `Bonjour ${clientName},` : `Hello ${clientName},`}
        </h2>
        <p style="line-height: 1.6; color: #4b5563; margin: 0 0 4px 0;">
          ${
            isFr
              ? `Veuillez trouver ci-joint votre facture <strong>${invoiceNumber}</strong> de <strong>${businessName}</strong>.`
              : `Please find your invoice <strong>${invoiceNumber}</strong> from <strong>${businessName}</strong> below.`
          }
        </p>
        ${amountBlock}
        <a href="${invoiceUrl}"
           style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 14px; margin-bottom: 4px;">
          ${isFr ? 'Consulter la Facture' : 'View Invoice'}
        </a>
        ${paymentHtml}
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 28px 0 16px 0;" />
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin: 0;">
          ${contactLine}
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
