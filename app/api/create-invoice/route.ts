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

    const { estimateId } = await request.json();

    if (!estimateId) {
      return NextResponse.json(
        { error: 'Missing estimateId' },
        { status: 400 }
      );
    }

    // 1. Fetch estimate
    const { data: estimate, error: estError } = await supabaseAdmin
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('user_id', user.id)
      .single();

    if (estError || !estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    if (estimate.client_status !== 'approved') {
      return NextResponse.json(
        { error: 'Invoice can only be created from an approved estimate' },
        { status: 400 }
      );
    }

    if (estimate.cancelled_at || estimate.superseded_at) {
      return NextResponse.json(
        { error: 'Cannot invoice a cancelled or superseded estimate' },
        { status: 400 }
      );
    }

    // 2. Check profile / Pro
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, country, default_tax_rate')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier !== 'pro') {
      return NextResponse.json(
        { error: 'Pro subscription required for invoicing' },
        { status: 403 }
      );
    }

    const estCountry = estimate.country_snapshot || profile?.country || 'US';
    const isFr = estCountry === 'FR';

    const estimateTotalCents = estimate.total_amount_cents || 0;
    const estimateTaxCents = estimate.tax_amount_cents || 0;
    const estimateSubtotalCents = Math.max(
      0,
      estimateTotalCents - estimateTaxCents
    );

    // 3. Fetch active invoices. Deleted invoices are gone; cancelled should not block.
    const { data: existingInvoices } = await supabaseAdmin
      .from('invoices')
      .select(
        'id, invoice_number, invoice_type, total_amount_cents, credited_amount_cents, is_locked, is_cancelled, created_at'
      )
      .eq('estimate_id', estimateId)
      .eq('user_id', user.id);

    const invoices = existingInvoices || [];

    const activeInvoices = invoices.filter((inv) => !inv.is_cancelled);
    const finalizedInvoices = activeInvoices.filter((inv) => inv.is_locked);
    const draftInvoices = activeInvoices.filter((inv) => !inv.is_locked);

    // 4. Net already-finalized billing.
    // credit_notes link to invoices (invoice_id), NOT estimates, and have no
    // is_locked / is_cancelled / total_amount_cents columns. Credits are
    // already reflected per invoice via credited_amount_cents (and full
    // credits flip is_cancelled), so we net per finalized invoice instead.
    const netFinalizedBilledCents = finalizedInvoices.reduce(
      (sum, inv: any) =>
        sum +
        Math.max(
          0,
          (inv.total_amount_cents || 0) - (inv.credited_amount_cents || 0)
        ),
      0
    );

    const remainingToBillCents = Math.max(
      0,
      estimateTotalCents - netFinalizedBilledCents
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

    const estimateRef =
      estimate.estimate_number || estimate.custom_id || estimate.id.slice(0, 8);

    const computeDueDate = (daysFromNow: number): string => {
      const d = new Date();
      d.setDate(d.getDate() + daysFromNow);
      return d.toISOString();
    };

    const rawTerms = estimate.payment_terms_snapshot || '30_days';
    const isUponReceipt = rawTerms === 'upon_receipt';
    const paymentDays = isUponReceipt
      ? 0
      : parseInt(rawTerms.replace('_days', '')) || 30;

    const dueDate = computeDueDate(paymentDays);

    const makeSubtotalAndTaxFromTotal = (targetTotalCents: number) => {
      if (!estimateTotalCents) {
        return {
          subtotalCents: targetTotalCents,
          taxCents: 0
        };
      }

      const ratio = targetTotalCents / estimateTotalCents;
      const subtotalCents = Math.round(estimateSubtotalCents * ratio);
      const taxCents = Math.max(0, targetTotalCents - subtotalCents);

      return { subtotalCents, taxCents };
    };

    const baseFields = {
      user_id: user.id,
      estimate_id: estimateId,
      invoice_date: new Date().toISOString(),
      due_date: dueDate,

      client_name: estimate.client_name,
      client_email: estimate.client_email,
      client_phone: estimate.client_phone,
      client_address: estimate.client_address,
      client_city: estimate.client_city,
      client_zip: estimate.client_zip,
      client_country: estimate.client_country,

      business_name_snapshot: estimate.business_name_snapshot,
      country_snapshot: estimate.country_snapshot,
      currency_snapshot: estimate.currency_snapshot,
      tax_rate_snapshot: estimate.tax_rate_snapshot,
      margin_mode_snapshot: estimate.margin_mode_snapshot,
      global_margin_snapshot: estimate.global_margin_snapshot,
      payment_terms_snapshot: estimate.payment_terms_snapshot,

      // CRITICAL: copy estimate structure to invoice.
      // This is what makes the invoice page mirror the approved estimate.
      sections: estimate.sections || [],
      additional_charges: estimate.additional_charges || [],

      // Carry the estimate's detail-visibility choice so a finalized invoice
      // renders the same labor/items breakdown the estimate showed.
      show_details_snapshot: estimate.show_details_snapshot ?? false,

      line_items: [],

      is_locked: false,
      is_cancelled: false,
      payment_status: 'unpaid'
    };

    const createInvoice = async ({
      invoiceType,
      amountCents,
      description,
      depositPercentage,
      depositInvoiceRef,
      dueDateOverride
    }: {
      invoiceType: 'full' | 'deposit' | 'balance';
      amountCents: number;
      description: string | null;
      depositPercentage: number;
      depositInvoiceRef?: string | null | undefined;
      dueDateOverride?: string;
    }) => {
      // Placeholder only. Real sequential number is assigned at finalize
      // (/api/finalize-invoice) so deleted drafts never burn a number.
      const invoiceNumber = `DRAFT-${crypto.randomUUID().slice(0, 8)}`;
      const { subtotalCents, taxCents } =
        makeSubtotalAndTaxFromTotal(amountCents);

      const { data: invoice, error } = await supabaseAdmin
        .from('invoices')
        .insert([
          {
            ...baseFields,
            due_date: dueDateOverride || dueDate,
            invoice_number: invoiceNumber,
            invoice_type: invoiceType,
            invoice_description: description,

            deposit_enabled: invoiceType !== 'full',
            deposit_percentage: depositPercentage,

            deposit_invoice_ref: depositInvoiceRef || null,

            subtotal_cents: subtotalCents,
            subtotal_amount_cents: subtotalCents,
            tax_amount_cents: taxCents,
            total_amount_cents: amountCents
          }
        ])
        .select()
        .single();

      if (error || !invoice) {
        throw new Error(error?.message || 'Failed to create invoice');
      }

      return invoice;
    };

    // 5. Deposit workflow
    if (estimate.deposit_enabled && estimate.deposit_percentage > 0) {
      const depositPct = estimate.deposit_percentage;
      const depositTargetCents = Math.round(
        (estimateTotalCents * depositPct) / 100
      );

      const activeDeposit = activeInvoices.find(
        (inv) => inv.invoice_type === 'deposit'
      );

      const finalizedDeposit = finalizedInvoices.find(
        (inv) => inv.invoice_type === 'deposit'
      );

      const activeBalanceDraft = draftInvoices.find(
        (inv) => inv.invoice_type === 'balance'
      );

      // 5A. Create or redirect deposit invoice.
      // Deposit should exist once, unless deleted or cancelled.
      if (!finalizedDeposit) {
        if (activeDeposit && !activeDeposit.is_locked) {
          return NextResponse.json(
            {
              type: 'existing_draft',
              invoice: activeDeposit,
              redirectTo: `/invoices/${activeDeposit.id}`
            },
            { status: 200 }
          );
        }

        const amountCents = Math.min(depositTargetCents, remainingToBillCents);

        const description = isFr
          ? `Acompte ${depositPct}% — Devis #${estimateRef}`
          : `Deposit ${depositPct}% — Estimate #${estimateRef}`;

        const invoice = await createInvoice({
          invoiceType: 'deposit',
          amountCents,
          description,
          depositPercentage: depositPct,
          depositInvoiceRef: null,
          dueDateOverride: new Date().toISOString()
        });

        return NextResponse.json(
          {
            type: 'deposit',
            invoice,
            redirectTo: `/invoices/${invoice.id}`
          },
          { status: 201 }
        );
      }

      // 5B. Deposit is finalized, create or redirect remaining balance invoice.
      if (activeBalanceDraft) {
        return NextResponse.json(
          {
            type: 'existing_draft',
            invoice: activeBalanceDraft,
            redirectTo: `/invoices/${activeBalanceDraft.id}`
          },
          { status: 200 }
        );
      }

      const remainingPct = estimateTotalCents
        ? Math.round((remainingToBillCents / estimateTotalCents) * 100)
        : 100;

      const impliedDepositPct = Math.max(0, 100 - remainingPct);

      const description = isFr
        ? `Solde ${remainingPct}% — Devis #${estimateRef}`
        : `Balance ${remainingPct}% — Estimate #${estimateRef}`;

      const invoice = await createInvoice({
        invoiceType: 'balance',
        amountCents: remainingToBillCents,
        description,
        depositPercentage: impliedDepositPct,
        depositInvoiceRef: finalizedDeposit.id
      });

      return NextResponse.json(
        {
          type: 'balance',
          invoice,
          redirectTo: `/invoices/${invoice.id}`
        },
        { status: 201 }
      );
    }

    // 6. Non-deposit workflow: create remaining full invoice
    const activeFullDraft = draftInvoices.find(
      (inv) => inv.invoice_type === 'full'
    );

    if (activeFullDraft) {
      return NextResponse.json(
        {
          type: 'existing_draft',
          invoice: activeFullDraft,
          redirectTo: `/invoices/${activeFullDraft.id}`
        },
        { status: 200 }
      );
    }

    const alreadyPartiallyBilled = netFinalizedBilledCents > 0;

    const description = alreadyPartiallyBilled
      ? isFr
        ? `Solde restant — Devis #${estimateRef}`
        : `Remaining balance — Estimate #${estimateRef}`
      : null;

    const invoice = await createInvoice({
      invoiceType: 'full',
      amountCents: remainingToBillCents,
      description,
      depositPercentage: 0,
      depositInvoiceRef: null
    });

    return NextResponse.json(
      {
        type: 'single',
        invoice,
        redirectTo: `/invoices/${invoice.id}`
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create invoice error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
