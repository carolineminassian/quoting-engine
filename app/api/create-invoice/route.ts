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

    // 1. Fetch the estimate
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

    // 2. Check Pro subscription
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, country')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier !== 'pro') {
      return NextResponse.json(
        { error: 'Pro subscription required for invoicing' },
        { status: 403 }
      );
    }

    // 3. Check if invoices already exist for this estimate
    const { data: existingInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, invoice_type')
      .eq('estimate_id', estimateId)
      .eq('user_id', user.id);

    if (existingInvoices && existingInvoices.length > 0) {
      return NextResponse.json(
        {
          error: 'Invoices already exist',
          invoices: existingInvoices,
          hasDeposit: existingInvoices.length > 1
        },
        { status: 409 }
      );
    }

    const estCountry = estimate.country_snapshot || profile?.country || 'US';

    // Helper to compute due date
    const computeDueDate = (daysFromNow: number): string => {
      if (daysFromNow === 0) return new Date().toISOString();
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

    // Base invoice fields shared between all invoice types
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
      sections: estimate.sections || [],
      additional_charges: estimate.additional_charges || [],
      tax_amount_cents: estimate.tax_amount_cents || 0,
      total_amount_cents: estimate.total_amount_cents || 0,
      payment_terms_snapshot: estimate.payment_terms_snapshot,
      deposit_enabled: false, // invoices don't repeat deposit split
      deposit_percentage: 0,
      is_locked: false,
      payment_status: 'unpaid'
    };

    // 4. Generate invoice number(s) atomically
    const { data: invoiceNumber1, error: seq1Error } = await supabaseAdmin.rpc(
      'generate_invoice_number',
      {
        p_user_id: user.id,
        p_country: estCountry
      }
    );

    if (seq1Error || !invoiceNumber1) {
      return NextResponse.json(
        { error: 'Failed to generate invoice number' },
        { status: 500 }
      );
    }

    // ─── CASE A: Deposit-split invoicing ───────────────────────────────────
    if (estimate.deposit_enabled && estimate.deposit_percentage > 0) {
      const depositPct = estimate.deposit_percentage;
      const depositCents = Math.round(
        (estimate.total_amount_cents * depositPct) / 100
      );
      const balanceCents = estimate.total_amount_cents - depositCents;

      // Generate second invoice number for balance
      const { data: invoiceNumber2, error: seq2Error } =
        await supabaseAdmin.rpc('generate_invoice_number', {
          p_user_id: user.id,
          p_country: estCountry
        });

      if (seq2Error || !invoiceNumber2) {
        return NextResponse.json(
          { error: 'Failed to generate balance invoice number' },
          { status: 500 }
        );
      }

      const estimateRef = estimate.custom_id || estimate.id.slice(0, 8);
      const isFr = estCountry === 'FR';

      // Create deposit invoice
      const { data: depositInvoice, error: dep1Error } = await supabaseAdmin
        .from('invoices')
        .insert([
          {
            ...baseFields,
            invoice_number: invoiceNumber1,
            invoice_type: 'deposit',
            invoice_description: isFr
              ? `Acompte ${depositPct}% — Devis #${estimateRef}`
              : `Deposit ${depositPct}% — Estimate #${estimateRef}`,
            // Deposit invoice: flat amount, no line items shown (simplified)
            sections: [],
            additional_charges: [],
            subtotal_amount_cents: depositCents,
            tax_amount_cents: 0,
            total_amount_cents: depositCents
          }
        ])
        .select()
        .single();

      if (dep1Error || !depositInvoice) {
        return NextResponse.json(
          { error: dep1Error?.message || 'Failed to create deposit invoice' },
          { status: 500 }
        );
      }

      // Create balance invoice (references the deposit invoice)
      const { data: balanceInvoice, error: dep2Error } = await supabaseAdmin
        .from('invoices')
        .insert([
          {
            ...baseFields,
            invoice_number: invoiceNumber2,
            invoice_type: 'balance',
            invoice_description: isFr
              ? `Solde ${100 - depositPct}% — Devis #${estimateRef}`
              : `Balance ${100 - depositPct}% — Estimate #${estimateRef}`,
            deposit_invoice_ref: depositInvoice.id,
            // Balance invoice: all the line items, but reduced total
            subtotal_amount_cents: Math.round(
              ((estimate.total_amount_cents - estimate.tax_amount_cents) *
                (100 - depositPct)) /
                100
            ),
            tax_amount_cents: Math.round(
              ((estimate.tax_amount_cents || 0) * (100 - depositPct)) / 100
            ),
            total_amount_cents: balanceCents
          }
        ])
        .select()
        .single();

      if (dep2Error || !balanceInvoice) {
        // Clean up deposit invoice if balance creation fails
        await supabaseAdmin
          .from('invoices')
          .delete()
          .eq('id', depositInvoice.id);
        return NextResponse.json(
          { error: dep2Error?.message || 'Failed to create balance invoice' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          type: 'split',
          depositInvoice,
          balanceInvoice,
          // Redirect to estimate billing hub
          redirectTo: `/estimates/${estimateId}?tab=billing`
        },
        { status: 201 }
      );
    }

    // ─── CASE B: Single full invoice ──────────────────────────────────────
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert([
        {
          ...baseFields,
          invoice_number: invoiceNumber1,
          invoice_type: 'full',
          subtotal_amount_cents:
            estimate.total_amount_cents - (estimate.tax_amount_cents || 0),
          tax_amount_cents: estimate.tax_amount_cents || 0,
          total_amount_cents: estimate.total_amount_cents
        }
      ])
      .select()
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: invoiceError?.message || 'Failed to create invoice' },
        { status: 500 }
      );
    }

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
