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

    const { invoiceIds, baseUrl } = await request.json();

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: 'No invoices provided' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select(
        'business_name, country, logo_url, bank_name, bank_account_number, bank_routing_number, payment_link_url, contact_email'
      )
      .eq('id', user.id)
      .single();

    const ownerEmail = user.email;
    if (!profile || !ownerEmail) {
      return NextResponse.json(
        { error: 'Owner profile incomplete' },
        { status: 400 }
      );
    }

    const { data: invoices, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select(
        'id, invoice_number, client_name, client_email, total_amount_cents, currency_snapshot, lang_snapshot, country_snapshot, payment_status, is_locked, is_cancelled, due_date, last_email_sent_at, last_followup_sent_at'
      )
      .in('id', invoiceIds)
      .eq('user_id', user.id)
      .eq('is_locked', true);

    if (fetchError || !invoices) {
      return NextResponse.json(
        { error: 'Failed to load invoices' },
        { status: 500 }
      );
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let sent = 0;
    let skippedNoEmail = 0;
    let skippedNeverSent = 0;
    let skippedCooldown = 0;
    let skippedPaid = 0;
    let skippedCancelled = 0;
    let failed = 0;
    const successfulIds: string[] = [];

    for (const inv of invoices) {
      // Eligibility: must be unpaid, not cancelled, have a client email,
      // have been sent at least once already, and not in cooldown
      if (!inv.client_email) {
        skippedNoEmail++;
        continue;
      }
      if (inv.is_cancelled) {
        skippedCancelled++;
        continue;
      }
      if (inv.payment_status === 'paid') {
        skippedPaid++;
        continue;
      }
      if (!inv.last_email_sent_at) {
        skippedNeverSent++;
        continue;
      }
      if (
        inv.last_followup_sent_at &&
        now - new Date(inv.last_followup_sent_at).getTime() < sevenDaysMs
      ) {
        skippedCooldown++;
        continue;
      }

      const isFr = inv.lang_snapshot
        ? inv.lang_snapshot === 'FR'
        : profile.country === 'FR';
      const currency = inv.currency_snapshot || (isFr ? 'EUR' : 'USD');
      const amount = (inv.total_amount_cents / 100).toFixed(2);
      const currencySymbol = currency === 'EUR' ? '€' : '$';
      const invoiceUrl = `${baseUrl || 'https://pactestim.com'}/invoices/${inv.id}`;

      const dueFormatted = inv.due_date
        ? new Date(inv.due_date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : null;

      const logoHtml = profile.logo_url
        ? `<img src="${profile.logo_url}" alt="${profile.business_name}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
        : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${profile.business_name}</h2>`;

      const hasBankDetails = profile.bank_name || profile.bank_account_number;
      const bankLabel = isFr ? 'Banque' : 'Bank';
      const accountLabel = isFr ? 'IBAN' : 'Account';
      const routingLabel = isFr ? 'BIC/SWIFT' : 'Routing';

      const paymentSection =
        hasBankDetails || profile.payment_link_url
          ? `<div style="margin-top: 20px; padding: 16px 20px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
            <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #374151; margin: 0 0 12px 0;">
              ${isFr ? 'Instructions de paiement' : 'Payment Instructions'}
            </p>
            ${
              hasBankDetails
                ? `
              <p style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #6b7280; margin: 0 0 8px 0;">
                ${isFr ? 'Virement bancaire' : 'Bank Transfer'}
              </p>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;">
          ${profile.bank_name ? `<tr><td style="color:#9ca3af;padding:2px 12px 2px 0;font-weight:600;width:80px;white-space:nowrap;">${bankLabel}</td><td style="color:#111827;font-weight:700;word-break:break-all;overflow-wrap:break-word;">${profile.bank_name}</td></tr>` : ''}
          ${profile.bank_account_number ? `<tr><td style="color:#9ca3af;padding:2px 12px 2px 0;font-weight:600;width:80px;white-space:nowrap;">${accountLabel}</td><td style="color:#111827;font-family:monospace;word-break:break-all;overflow-wrap:break-word;">${profile.bank_account_number}</td></tr>` : ''}
          ${profile.bank_routing_number ? `<tr><td style="color:#9ca3af;padding:2px 12px 2px 0;font-weight:600;width:80px;white-space:nowrap;">${routingLabel}</td><td style="color:#111827;font-family:monospace;word-break:break-all;overflow-wrap:break-word;">${profile.bank_routing_number}</td></tr>` : ''}
        </table>`
                : ''
            }
            ${
              hasBankDetails && profile.payment_link_url
                ? `<p style="text-align:center;font-size:11px;font-weight:800;color:#9ca3af;letter-spacing:0.15em;margin:14px 0;">${isFr ? '— ou —' : '— or —'}</p>`
                : ''
            }
            ${
              profile.payment_link_url
                ? `<div style="text-align:center;"><a href="${profile.payment_link_url}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:800;font-size:13px;">${isFr ? 'Payer en ligne' : 'Pay Online'}</a></div>`
                : ''
            }
          </div>`
          : '';

      const paymentLinkSection = profile.payment_link_url
        ? `<a href="${profile.payment_link_url}" style="display: inline-block; background: #16a34a; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">${isFr ? 'Payer en ligne' : 'Pay Online'}</a>`
        : '';

      const subject = isFr
        ? `Rappel de paiement — Facture ${inv.invoice_number}`
        : `Payment reminder — Invoice ${inv.invoice_number}`;

      const htmlContent = isFr
        ? `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
            ${logoHtml}
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">Bonjour ${inv.client_name},</h2>
            <p style="line-height: 1.6;">Je me permets de vous relancer concernant la facture <strong>${inv.invoice_number}</strong> d'un montant de <strong>${currencySymbol}${amount}</strong>${dueFormatted ? `, dont l'échéance était le <strong>${dueFormatted}</strong>` : ''}, qui reste en attente de règlement.</p>
            <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px; margin-bottom: 16px;">Voir la facture</a>
            ${paymentLinkSection}
            ${paymentSection}
            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            <p style="font-size: 12px; color: #6b7280;">Cordialement,<br/><strong>${profile.business_name}</strong></p>
          </div>`
        : `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
            ${logoHtml}
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">Hello ${inv.client_name},</h2>
            <p style="line-height: 1.6;">I wanted to follow up on invoice <strong>${inv.invoice_number}</strong> for <strong>${currencySymbol}${amount}</strong>${dueFormatted ? `, which was due on <strong>${dueFormatted}</strong>` : ''}, which remains outstanding.</p>
            <a href="${invoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px; margin-bottom: 16px;">View Invoice</a>
            ${paymentLinkSection}
            ${paymentSection}
            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            <p style="font-size: 12px; color: #6b7280;">Best regards,<br/><strong>${profile.business_name}</strong></p>
          </div>`;

      try {
        const { error } = await resend.emails.send({
          from: `${profile.business_name} <estimates@pactestim.com>`,
          to: [inv.client_email],
          replyTo: ownerEmail,
          subject,
          html: htmlContent
        });

        if (error) {
          console.error(`Bulk invoice follow-up failed for ${inv.id}:`, error);
          failed++;
        } else {
          sent++;
          successfulIds.push(inv.id);
        }
      } catch (err) {
        console.error(`Bulk invoice follow-up exception for ${inv.id}:`, err);
        failed++;
      }
    }

    if (successfulIds.length > 0) {
      await supabaseAdmin
        .from('invoices')
        .update({ last_followup_sent_at: new Date().toISOString() })
        .in('id', successfulIds);
    }

    return NextResponse.json({
      sent,
      skippedNoEmail,
      skippedNeverSent,
      skippedCooldown,
      skippedPaid,
      skippedCancelled,
      failed
    });
  } catch (err: any) {
    console.error('Bulk invoice follow-up route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
