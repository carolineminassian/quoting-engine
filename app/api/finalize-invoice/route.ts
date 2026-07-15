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

    const { invoiceId } = await request.json();
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
    }

    const { data: invoice, error: invError } = await supabaseAdmin
      .from('invoices')
      .select(
        'user_id, is_locked, country_snapshot, lang_snapshot, invoice_type, installment_total, estimate_id'
      )
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice || invoice.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.is_locked) {
      return NextResponse.json(
        { error: 'Invoice is already finalized' },
        { status: 400 }
      );
    }

    // Assign the real number only now, so deleted drafts leave no gaps.
    const { data: invoiceNumber, error: seqError } = await supabaseAdmin.rpc(
      'generate_invoice_number',
      {
        p_user_id: user.id,
        p_lang: invoice.lang_snapshot || 'EN'
      }
    );

    if (seqError || !invoiceNumber) {
      // PRINT THE EXACT ERROR IN SERVER TERMINAL
      console.error(
        '[DATABASE_CRASH_LOG] generate_invoice_number failed:',
        seqError
      );
      return NextResponse.json(
        { error: seqError?.message || 'Failed to generate invoice number' },
        { status: 500 }
      );
    }

    let depositRefsUpdate = {};
    if (
      invoice.invoice_type === 'balance' &&
      invoice.installment_total &&
      invoice.estimate_id
    ) {
      const { data: priorDeposits } = await supabaseAdmin
        .from('invoices')
        .select(
          'id, invoice_number, invoice_date, total_amount_cents, subtotal_cents'
        )
        .eq('estimate_id', invoice.estimate_id)
        .eq('invoice_type', 'deposit')
        .eq('is_locked', true)
        .eq('is_cancelled', false)
        .neq('id', invoiceId)
        .order('invoice_date', { ascending: true });

      if (priorDeposits && priorDeposits.length > 0) {
        depositRefsUpdate = {
          deposit_invoice_refs: priorDeposits.map((d) => ({
            id: d.id,
            invoice_number: d.invoice_number,
            invoice_date: d.invoice_date,
            total_amount_cents: d.total_amount_cents,
            subtotal_cents: d.subtotal_cents || 0
          }))
        };
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({
        invoice_number: invoiceNumber,
        is_locked: true,
        updated_at: new Date().toISOString(),
        ...depositRefsUpdate
      })
      .eq('id', invoiceId)
      .eq('is_locked', false) // guard against double-finalize
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message || 'Failed to finalize invoice' },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoice: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
