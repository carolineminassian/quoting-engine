import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Fetch all active schedules due today or overdue
    const { data: schedules, error: fetchError } = await supabaseAdmin
      .from('payment_schedules')
      .select('*, estimates(*, profiles(*))')
      .lte('next_run_date', today)
      .eq('is_active', true);

    if (fetchError || !schedules) {
      throw new Error(fetchError?.message || 'Failed to fetch schedules');
    }

    for (const schedule of schedules) {
      try {
        const estimate = schedule.estimates;
        const profile = estimate?.profiles;

        if (!estimate || !profile) {
          skipped++;
          continue;
        }

        const estCountry = estimate.country_snapshot || profile.country || 'US';
        const isFr = estCountry === 'FR';

        // Check remaining balance
        const { data: existingInvoices } = await supabaseAdmin
          .from('invoices')
          .select(
            'total_amount_cents, credited_amount_cents, is_locked, is_cancelled'
          )
          .eq('estimate_id', schedule.estimate_id)
          .eq('user_id', schedule.user_id);

        const netBilled = (existingInvoices || [])
          .filter((inv) => !inv.is_cancelled && inv.is_locked)
          .reduce(
            (sum, inv) =>
              sum +
              Math.max(
                0,
                (inv.total_amount_cents || 0) - (inv.credited_amount_cents || 0)
              ),
            0
          );

        const remaining = Math.max(
          0,
          (estimate.total_amount_cents || 0) - netBilled
        );

        if (remaining <= 0) {
          // Fully billed — deactivate schedule automatically
          await supabaseAdmin
            .from('payment_schedules')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', schedule.id);
          skipped++;
          continue;
        }

        const amountCents = Math.min(schedule.amount_cents, remaining);
        const estimateTotalCents = estimate.total_amount_cents || 0;
        const estimateTaxCents = estimate.tax_amount_cents || 0;
        const estimateSubtotalCents = Math.max(
          0,
          estimateTotalCents - estimateTaxCents
        );

        const ratio = estimateTotalCents ? amountCents / estimateTotalCents : 1;
        const subtotalCents = Math.round(estimateSubtotalCents * ratio);
        const taxCents = Math.max(0, amountCents - subtotalCents);

        const estimateRef =
          estimate.estimate_number ||
          estimate.custom_id ||
          estimate.id.slice(0, 8);
        const invoiceNum = schedule.invoices_created + 1;
        const description = isFr
          ? `Facturation récurrente #${invoiceNum} — Devis #${estimateRef}`
          : `Recurring billing #${invoiceNum} — Estimate #${estimateRef}`;

        // ── Create the invoice ────────────────────────────────────────────────
        const draftNumber = `DRAFT-${crypto.randomUUID().slice(0, 8)}`;

        const { data: invoice, error: createError } = await supabaseAdmin
          .from('invoices')
          .insert([
            {
              user_id: schedule.user_id,
              estimate_id: schedule.estimate_id,
              payment_schedule_id: schedule.id,
              invoice_date: new Date().toISOString(),
              due_date: schedule.next_run_date,
              invoice_number: draftNumber,
              invoice_description: description,
              invoice_type: 'full',
              client_name: estimate.client_name,
              client_email: estimate.client_email,
              client_phone: estimate.client_phone,
              client_address: estimate.client_address,
              business_name_snapshot: estimate.business_name_snapshot,
              country_snapshot: estimate.country_snapshot,
              currency_snapshot: estimate.currency_snapshot,
              tax_rate_snapshot: estimate.tax_rate_snapshot,
              margin_mode_snapshot: estimate.margin_mode_snapshot,
              global_margin_snapshot: estimate.global_margin_snapshot,
              payment_terms_snapshot: estimate.payment_terms_snapshot,
              sections: estimate.sections || [],
              additional_charges: estimate.additional_charges || [],
              show_details_snapshot: estimate.show_details_snapshot ?? false,
              line_items: [],
              subtotal_cents: subtotalCents,
              subtotal_amount_cents: subtotalCents,
              tax_amount_cents: taxCents,
              total_amount_cents: amountCents,
              deposit_enabled: false,
              deposit_percentage: 0,
              is_locked: false,
              is_cancelled: false,
              payment_status: 'unpaid'
            }
          ])
          .select()
          .single();

        if (createError || !invoice)
          throw new Error(createError?.message || 'Failed to create invoice');

        // ── Auto mode: finalize + send ────────────────────────────────────────
        if (schedule.mode === 'auto') {
          const { data: invoiceNumber, error: seqError } =
            await supabaseAdmin.rpc('generate_invoice_number', {
              p_user_id: schedule.user_id,
              p_country: estCountry
            });

          if (seqError || !invoiceNumber)
            throw new Error('Failed to generate invoice number');

          await supabaseAdmin
            .from('invoices')
            .update({
              invoice_number: invoiceNumber,
              is_locked: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.id);

          // Send invoice email to client
          if (estimate.client_email) {
            const currency =
              estimate.currency_snapshot || (isFr ? 'EUR' : 'USD');
            const symbol = currency === 'EUR' ? '€' : '$';
            const amount = (amountCents / 100).toFixed(2);
            const invoiceUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/invoices/${invoice.id}`;
            const paymentSection = profile.payment_link_url
              ? `<div style="text-align:center;margin-top:16px;"><a href="${profile.payment_link_url}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:800;font-size:13px;">${isFr ? 'Payer en ligne' : 'Pay Online'}</a></div>`
              : '';
            const logoHtml = profile.logo_url
              ? `<img src="${profile.logo_url}" alt="${profile.business_name}" style="max-height:50px;margin-bottom:24px;display:block;" />`
              : `<h2 style="margin-bottom:24px;color:#111827;font-size:20px;">${profile.business_name}</h2>`;

            const subject = isFr
              ? `Nouvelle facture ${invoiceNumber} — ${symbol}${amount}`
              : `Invoice ${invoiceNumber} — ${symbol}${amount}`;

            const html = isFr
              ? `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;padding:40px;color:#111827;">${logoHtml}<h2 style="font-size:22px;font-weight:800;margin-bottom:16px;">Bonjour ${estimate.client_name},</h2><p style="line-height:1.6;">Veuillez trouver ci-joint votre facture <strong>${invoiceNumber}</strong> d'un montant de <strong>${symbol}${amount}</strong>.</p><a href="${invoiceUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;margin-bottom:16px;">Voir la facture</a>${paymentSection}<hr style="border:0;border-top:1px solid #f3f4f6;margin:24px 0;" /><p style="font-size:12px;color:#6b7280;">Cordialement,<br/><strong>${profile.business_name}</strong></p></div>`
              : `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;padding:40px;color:#111827;">${logoHtml}<h2 style="font-size:22px;font-weight:800;margin-bottom:16px;">Hello ${estimate.client_name},</h2><p style="line-height:1.6;">Please find your invoice <strong>${invoiceNumber}</strong> for <strong>${symbol}${amount}</strong> attached.</p><a href="${invoiceUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;margin-bottom:16px;">View Invoice</a>${paymentSection}<hr style="border:0;border-top:1px solid #f3f4f6;margin:24px 0;" /><p style="font-size:12px;color:#6b7280;">Best regards,<br/><strong>${profile.business_name}</strong></p></div>`;

            const ownerEmail = profile.contact_email || '';
            if (ownerEmail) {
              await resend.emails.send({
                from: `${profile.business_name} <estimates@pactestim.com>`,
                to: [estimate.client_email],
                replyTo: ownerEmail,
                subject,
                html
              });
            }
          }

          // Notify owner
          const ownerEmail = profile.contact_email;
          if (ownerEmail) {
            await resend.emails.send({
              from: 'PactEstim <noreply@pactestim.com>',
              to: [ownerEmail],
              subject: isFr
                ? `Facture automatique envoyée — ${estimate.client_name}`
                : `Auto invoice sent — ${estimate.client_name}`,
              html: isFr
                ? `<p style="font-family:sans-serif;color:#111827;">La facture <strong>${invoiceNumber}</strong> de <strong>${(amountCents / 100).toFixed(2)}${estimate.currency_snapshot === 'EUR' ? '€' : '$'}</strong> a été automatiquement générée et envoyée à <strong>${estimate.client_email}</strong>.</p>`
                : `<p style="font-family:sans-serif;color:#111827;">Invoice <strong>${invoiceNumber}</strong> for <strong>${estimate.currency_snapshot === 'EUR' ? '€' : '$'}${(amountCents / 100).toFixed(2)}</strong> was automatically generated and sent to <strong>${estimate.client_email}</strong>.</p>`
            });
          }
        } else {
          // Draft mode — notify owner to review
          const ownerEmail = profile.contact_email;
          if (ownerEmail) {
            const invoiceUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/invoices/${invoice.id}`;
            await resend.emails.send({
              from: 'PactEstim <noreply@pactestim.com>',
              to: [ownerEmail],
              subject: isFr
                ? `Nouveau brouillon de facture à finaliser — ${estimate.client_name}`
                : `New draft invoice ready to review — ${estimate.client_name}`,
              html: isFr
                ? `<p style="font-family:sans-serif;color:#111827;">Un brouillon de facture de <strong>${(amountCents / 100).toFixed(2)}${estimate.currency_snapshot === 'EUR' ? '€' : '$'}</strong> a été généré pour <strong>${estimate.client_name}</strong>. <a href="${invoiceUrl}">Cliquez ici pour le finaliser.</a></p>`
                : `<p style="font-family:sans-serif;color:#111827;">A draft invoice for <strong>${estimate.currency_snapshot === 'EUR' ? '€' : '$'}${(amountCents / 100).toFixed(2)}</strong> has been generated for <strong>${estimate.client_name}</strong>. <a href="${invoiceUrl}">Click here to review and finalize it.</a></p>`
            });
          }
        }

        // ── Advance the schedule ──────────────────────────────────────────────
        const nextDate = new Date(schedule.next_run_date);
        nextDate.setDate(nextDate.getDate() + schedule.interval_days);
        const newInvoicesCreated = schedule.invoices_created + 1;
        const isComplete =
          schedule.total_invoices !== null &&
          newInvoicesCreated >= schedule.total_invoices;

        await supabaseAdmin
          .from('payment_schedules')
          .update({
            next_run_date: nextDate.toISOString().split('T')[0],
            invoices_created: newInvoicesCreated,
            is_active: !isComplete,
            updated_at: new Date().toISOString()
          })
          .eq('id', schedule.id);

        processed++;
      } catch (scheduleErr: any) {
        console.error(
          `Failed to process schedule ${schedule.id}:`,
          scheduleErr
        );
        failed++;
      }
    }

    return NextResponse.json({ processed, skipped, failed });
  } catch (err: any) {
    console.error('Cron process-schedules error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
