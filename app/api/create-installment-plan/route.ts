import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { estimateId, installments } = await request.json();

    if (!estimateId || !Array.isArray(installments) || installments.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 installments are required.' },
        { status: 400 }
      );
    }

    // ── Fetch estimate ────────────────────────────────────────────────────────
    const { data: estimate } = await supabaseAdmin
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('user_id', user.id)
      .single();

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 });
    }
    if (estimate.client_status !== 'approved') {
      return NextResponse.json({ error: 'Estimate must be approved.' }, { status: 400 });
    }
    if (estimate.cancelled_at || estimate.superseded_at) {
      return NextResponse.json(
        { error: 'Cannot create installments for a cancelled or superseded estimate.' },
        { status: 400 }
      );
    }

    // ── Pro / lifetime gate ───────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, lifetime_access, country')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier !== 'pro' && !profile?.lifetime_access) {
      return NextResponse.json(
        { error: 'Pro subscription required for installment billing.' },
        { status: 403 }
      );
    }

    const estCountry = estimate.country_snapshot || profile?.country || 'US';
    const isFr = estCountry === 'FR';

    // ── Calculate remaining balance ───────────────────────────────────────────
    const { data: existingInvoices } = await supabaseAdmin
      .from('invoices')
      .select('total_amount_cents, credited_amount_cents, is_locked, is_cancelled')
      .eq('estimate_id', estimateId)
      .eq('user_id', user.id);

    const activeInvoices = (existingInvoices || []).filter(inv => !inv.is_cancelled);
    const draftInvoices  = activeInvoices.filter(inv => !inv.is_locked);

    if (draftInvoices.length > 0) {
      return NextResponse.json(
        {
          error: isFr
            ? 'Des brouillons de factures existent déjà. Supprimez-les avant de créer un plan de versements.'
            : 'Existing invoice drafts found. Delete them before creating an installment plan.'
        },
        { status: 409 }
      );
    }

    const netFinalizedCents = activeInvoices
      .filter(inv => inv.is_locked)
      .reduce((sum, inv) =>
        sum + Math.max(0, (inv.total_amount_cents || 0) - (inv.credited_amount_cents || 0)), 0
      );

    const estimateTotalCents   = estimate.total_amount_cents || 0;
    const remainingToBillCents = Math.max(0, estimateTotalCents - netFinalizedCents);

    if (remainingToBillCents <= 0) {
      return NextResponse.json(
        {
          error: isFr
            ? 'Ce devis est déjà entièrement facturé.'
            : 'This estimate has already been fully billed.'
        },
        { status: 409 }
      );
    }

    // ── Validate installments ─────────────────────────────────────────────────
    for (const inst of installments) {
      if (!inst.amountCents || inst.amountCents <= 0) {
        return NextResponse.json(
          { error: 'Each installment must have a positive amount.' },
          { status: 400 }
        );
      }
      if (!inst.dueDate) {
        return NextResponse.json(
          { error: 'Each installment must have a due date.' },
          { status: 400 }
        );
      }
    }

    const totalInstallmentCents = installments.reduce(
      (sum: number, inst: any) => sum + inst.amountCents, 0
    );
    if (Math.abs(totalInstallmentCents - remainingToBillCents) > 2) {
      return NextResponse.json(
        {
          error: isFr
            ? `Le total des versements ne correspond pas au solde restant (${remainingToBillCents / 100}).`
            : `Installment total does not match the remaining balance (${remainingToBillCents / 100}).`
        },
        { status: 400 }
      );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    const estimateTaxCents      = estimate.tax_amount_cents || 0;
    const estimateSubtotalCents = Math.max(0, estimateTotalCents - estimateTaxCents);

    const splitSubtotalAndTax = (targetTotal: number) => {
      if (!estimateTotalCents) return { subtotalCents: targetTotal, taxCents: 0 };
      const ratio       = targetTotal / estimateTotalCents;
      const subtotal    = Math.round(estimateSubtotalCents * ratio);
      return { subtotalCents: subtotal, taxCents: Math.max(0, targetTotal - subtotal) };
    };

    const estimateRef  = estimate.estimate_number || estimate.custom_id || estimate.id.slice(0, 8);
    const totalCount   = installments.length;

    const baseFields = {
      user_id:                  user.id,
      estimate_id:              estimateId,
      invoice_date:             new Date().toISOString(),
      client_name:              estimate.client_name,
      client_email:             estimate.client_email,
      client_phone:             estimate.client_phone,
      client_address:           estimate.client_address,
      client_city:              estimate.client_city,
      client_zip:               estimate.client_zip,
      client_country:           estimate.client_country,
      business_name_snapshot:   estimate.business_name_snapshot,
      country_snapshot:         estimate.country_snapshot,
      currency_snapshot:        estimate.currency_snapshot,
      tax_rate_snapshot:        estimate.tax_rate_snapshot,
      margin_mode_snapshot:     estimate.margin_mode_snapshot,
      global_margin_snapshot:   estimate.global_margin_snapshot,
      payment_terms_snapshot:   estimate.payment_terms_snapshot,
      sections:                 estimate.sections || [],
      additional_charges:       estimate.additional_charges || [],
      show_details_snapshot:    estimate.show_details_snapshot ?? false,
      line_items:               [],
      is_locked:                false,
      is_cancelled:             false,
      payment_status:           'unpaid',
      invoice_type:             'installment',
      installment_total:        totalCount,
      deposit_enabled:          false,
      deposit_percentage:       0
    };

    // ── Create installment invoices ───────────────────────────────────────────
    const createdInvoices: any[] = [];

    for (let i = 0; i < installments.length; i++) {
      const inst                      = installments[i];
      const { subtotalCents, taxCents } = splitSubtotalAndTax(inst.amountCents);

      const description = isFr
        ? `Versement ${i + 1} sur ${totalCount} — Devis #${estimateRef}`
        : `Installment ${i + 1} of ${totalCount} — Estimate #${estimateRef}`;

      const { data: invoice, error } = await supabaseAdmin
        .from('invoices')
        .insert([{
          ...baseFields,
          invoice_number:       `DRAFT-${crypto.randomUUID().slice(0, 8)}`,
          invoice_description:  description,
          installment_number:   i + 1,
          due_date:             inst.dueDate,
          subtotal_cents:       subtotalCents,
          subtotal_amount_cents: subtotalCents,
          tax_amount_cents:     taxCents,
          total_amount_cents:   inst.amountCents
        }])
        .select()
        .single();

      if (error || !invoice) {
        // Rollback: delete any invoices already created in this batch
        if (createdInvoices.length > 0) {
          await supabaseAdmin
            .from('invoices')
            .delete()
            .in('id', createdInvoices.map(inv => inv.id));
        }
        throw new Error(error?.message || `Failed to create installment ${i + 1}`);
      }

      createdInvoices.push(invoice);
    }

    return NextResponse.json(
      {
        type:        'installment_plan',
        invoices:    createdInvoices,
        count:       totalCount,
        redirectTo:  `/estimates/${estimateId}?tab=billing`
      },
      { status: 201 }
    );

  } catch (err: any) {
    console.error('Create installment plan error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}