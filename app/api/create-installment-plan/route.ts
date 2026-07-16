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
    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { estimateId, installments } = await request.json();

    if (
      !estimateId ||
      !Array.isArray(installments) ||
      installments.length < 2
    ) {
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
      return NextResponse.json(
        { error: 'Estimate not found.' },
        { status: 404 }
      );
    }
    if (estimate.client_status !== 'approved') {
      return NextResponse.json(
        { error: 'Estimate must be approved.' },
        { status: 400 }
      );
    }
    if (estimate.cancelled_at || estimate.superseded_at) {
      return NextResponse.json(
        {
          error:
            'Cannot create installments for a cancelled or superseded estimate.'
        },
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

    // Decoupled: set installment description text strictly based on estimate language snapshot
    const isFr = estimate.lang_snapshot === 'FR';

    // ── Calculate remaining balance ───────────────────────────────────────────
    const { data: existingInvoices } = await supabaseAdmin
      .from('invoices')
      .select(
        'total_amount_cents, credited_amount_cents, is_locked, is_cancelled'
      )
      .eq('estimate_id', estimateId)
      .eq('user_id', user.id);

    const activeInvoices = (existingInvoices || []).filter(
      (inv) => !inv.is_cancelled
    );
    const draftInvoices = activeInvoices.filter((inv) => !inv.is_locked);

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
      .filter((inv) => inv.is_locked)
      .reduce(
        (sum, inv) =>
          sum +
          Math.max(
            0,
            (inv.total_amount_cents || 0) - (inv.credited_amount_cents || 0)
          ),
        0
      );

    const estimateTotalCents = estimate.total_amount_cents || 0;
    const remainingToBillCents = Math.max(
      0,
      estimateTotalCents - netFinalizedCents
    );

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

    // Smart Deposit Detection: Check if a locked/finalized deposit invoice already exists
    const hasFinalizedDeposit = activeInvoices.some(
      (inv) => (inv as any).invoice_type === 'deposit' && inv.is_locked
    );

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
      (sum: number, inst: any) => sum + inst.amountCents,
      0
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
    const estimateTaxCents = estimate.tax_amount_cents || 0;
    const estimateSubtotalCents = Math.max(
      0,
      estimateTotalCents - estimateTaxCents
    );

    const splitSubtotalAndTax = (targetTotal: number) => {
      if (!estimateTotalCents)
        return { subtotalCents: targetTotal, taxCents: 0 };
      const ratio = targetTotal / estimateTotalCents;
      const subtotal = Math.round(estimateSubtotalCents * ratio);
      return {
        subtotalCents: subtotal,
        taxCents: Math.max(0, targetTotal - subtotal)
      };
    };

    const estimateRef =
      estimate.estimate_number || estimate.custom_id || estimate.id.slice(0, 8);
    const totalCount = installments.length;

    const rawTerms = estimate.payment_terms_snapshot || '30_days';
    const paymentDays =
      rawTerms === 'upon_receipt'
        ? 0
        : parseInt(rawTerms.replace('_days', '')) || 30;

    const baseFields = {
      user_id: user.id,
      estimate_id: estimateId,
      client_name: estimate.client_name,
      client_email: estimate.client_email,
      client_phone: estimate.client_phone,
      client_address: estimate.client_address,
      client_city: estimate.client_city,
      client_state: estimate.client_state || null,
      client_zip: estimate.client_zip,
      client_country: estimate.client_country,
      client_siret: estimate.client_siret || null,
      client_siren: estimate.client_siren || null,
      business_name_snapshot: estimate.business_name_snapshot,
      business_address_snapshot: estimate.business_address_snapshot || null,
      business_city_snapshot: estimate.business_city_snapshot || null,
      business_state_snapshot: estimate.business_state_snapshot || null,
      business_zip_snapshot: estimate.business_zip_snapshot || null,
      business_vat_snapshot: estimate.business_vat_snapshot || null,
      business_reg_snapshot: estimate.business_reg_snapshot || null,
      country_snapshot: estimate.country_snapshot,
      lang_snapshot: estimate.lang_snapshot || 'EN',
      currency_snapshot: estimate.currency_snapshot,
      tax_rate_snapshot: estimate.tax_rate_snapshot,
      margin_mode_snapshot: estimate.margin_mode_snapshot,
      global_margin_snapshot: estimate.global_margin_snapshot,
      payment_terms_snapshot: estimate.payment_terms_snapshot,
      sections: estimate.sections || [],
      additional_charges: estimate.additional_charges || [],
      show_details_snapshot: estimate.show_details_snapshot ?? false,
      line_items: [],
      is_locked: false,
      is_cancelled: false,
      payment_status: 'unpaid',
      installment_total: totalCount,
      deposit_enabled: false,
      deposit_percentage: 0
    };

    // ── Create installment invoices ───────────────────────────────────────────
    const createdInvoices: any[] = [];

    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i];
      const { subtotalCents, taxCents } = splitSubtotalAndTax(inst.amountCents);

      const dueDate = new Date(inst.dueDate);
      const invoiceDate = new Date(dueDate);
      invoiceDate.setDate(invoiceDate.getDate() - paymentDays);

      const isLast = i === installments.length - 1;

      // Smart Deposit mapping: if a deposit invoice already exists,
      // intermediate installments are 'installment' (or regular full types) and final is 'balance'.
      let invoiceType: string;
      if (estimate.deposit_enabled) {
        if (hasFinalizedDeposit) {
          invoiceType = isLast ? 'balance' : 'full'; // remaining are full installments, last is balance
        } else {
          invoiceType = isLast ? 'balance' : 'deposit'; // first is deposit, rest intermediate, last balance
        }
      } else {
        invoiceType = 'full';
      }

      let description: string;
      if (estimate.deposit_enabled) {
        if (hasFinalizedDeposit) {
          description = isLast
            ? isFr
              ? `Solde final — Devis #${estimateRef}`
              : `Final Balance — Estimate #${estimateRef}`
            : isFr
              ? `Échéance ${i + 1}/${totalCount - 1} — Devis #${estimateRef}`
              : `Installment ${i + 1} of ${totalCount - 1} — Estimate #${estimateRef}`;
        } else {
          const depositCount = totalCount - 1;
          description = isLast
            ? isFr
              ? `Solde final — Devis #${estimateRef}`
              : `Final Balance — Estimate #${estimateRef}`
            : isFr
              ? `Acompte ${i + 1}/${depositCount} — Devis #${estimateRef}`
              : `Deposit ${i + 1} of ${depositCount} — Estimate #${estimateRef}`;
        }
      } else {
        description = isFr
          ? `Versement ${i + 1} sur ${totalCount} — Devis #${estimateRef}`
          : `Installment ${i + 1} of ${totalCount} — Estimate #${estimateRef}`;
      }

      const { data: invoice, error } = await supabaseAdmin
        .from('invoices')
        .insert([
          {
            ...baseFields,
            invoice_type: invoiceType,
            invoice_number: `DRAFT-${crypto.randomUUID().slice(0, 8)}`,
            invoice_description: description,
            installment_number: i + 1,
            invoice_date: invoiceDate.toISOString(),
            due_date: inst.dueDate,
            subtotal_cents: subtotalCents,
            subtotal_amount_cents: subtotalCents,
            tax_amount_cents: taxCents,
            total_amount_cents: inst.amountCents
          }
        ])
        .select()
        .single();

      if (error || !invoice) {
        // Rollback: delete any invoices already created in this batch
        if (createdInvoices.length > 0) {
          await supabaseAdmin
            .from('invoices')
            .delete()
            .in(
              'id',
              createdInvoices.map((inv) => inv.id)
            );
        }
        throw new Error(
          error?.message || `Failed to create installment ${i + 1}`
        );
      }

      createdInvoices.push(invoice);
    }

    return NextResponse.json(
      {
        type: 'installment_plan',
        invoices: createdInvoices,
        count: totalCount,
        redirectTo: `/estimates/${estimateId}?tab=billing`
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
