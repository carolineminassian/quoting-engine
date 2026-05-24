import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    // 1. Fetch the estimate — verify it belongs to this user and is approved
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

    // 2. Check if an invoice already exists for this estimate
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number')
      .eq('estimate_id', estimateId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Invoice already exists', invoiceId: existing.id },
        { status: 409 }
      );
    }

    // 3. Check Pro subscription
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

    // 4. Generate sequential invoice number atomically
    const { data: invoiceNumber, error: seqError } = await supabaseAdmin.rpc(
      'generate_invoice_number',
      {
        p_user_id: user.id,
        p_country: estimate.country_snapshot || profile?.country || 'US'
      }
    );

    if (seqError || !invoiceNumber) {
      console.error('Failed to generate invoice number:', seqError);
      return NextResponse.json(
        { error: 'Failed to generate invoice number' },
        { status: 500 }
      );
    }

    // 5. Compute due date from payment terms
    const rawTerms = estimate.payment_terms_snapshot || '30_days';
    const isUponReceipt = rawTerms === 'upon_receipt';
    const paymentDays = isUponReceipt
      ? 0
      : parseInt(rawTerms.replace('_days', '')) || 30;

    const invoiceDate = new Date();
    const dueDate = isUponReceipt
      ? invoiceDate
      : new Date(invoiceDate.getTime() + paymentDays * 24 * 60 * 60 * 1000);

    // 6. Create the invoice pre-populated from the estimate
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert([
        {
          user_id: user.id,
          estimate_id: estimateId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate.toISOString(),
          due_date: dueDate.toISOString(),

          // Client snapshot from estimate
          client_name: estimate.client_name,
          client_email: estimate.client_email,
          client_phone: estimate.client_phone,
          client_address: estimate.client_address,
          client_city: estimate.client_city,
          client_zip: estimate.client_zip,
          client_country: estimate.client_country,

          // Business snapshot
          business_name_snapshot: estimate.business_name_snapshot,
          country_snapshot: estimate.country_snapshot,
          currency_snapshot: estimate.currency_snapshot,
          tax_rate_snapshot: estimate.tax_rate_snapshot,
          margin_mode_snapshot: estimate.margin_mode_snapshot,
          global_margin_snapshot: estimate.global_margin_snapshot,

          // Line items
          sections: estimate.sections || [],
          additional_charges: estimate.additional_charges || [],

          // Financial totals
          subtotal_amount_cents: 0, // will be recalculated on save
          tax_amount_cents: estimate.tax_amount_cents || 0,
          total_amount_cents: estimate.total_amount_cents || 0,

          // Payment terms
          payment_terms_snapshot: estimate.payment_terms_snapshot,
          deposit_enabled: estimate.deposit_enabled,
          deposit_percentage: estimate.deposit_percentage,

          // Status
          is_locked: false,
          payment_status: 'unpaid'
        }
      ])
      .select()
      .single();

    if (invoiceError) {
      console.error('Failed to create invoice:', invoiceError);
      return NextResponse.json(
        { error: invoiceError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err: any) {
    console.error('Create invoice error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
