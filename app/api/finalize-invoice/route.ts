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
      .select('user_id, is_locked, country_snapshot')
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
        p_country: invoice.country_snapshot || 'US'
      }
    );

    if (seqError || !invoiceNumber) {
      return NextResponse.json(
        { error: 'Failed to generate invoice number' },
        { status: 500 }
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({
        invoice_number: invoiceNumber,
        is_locked: true,
        updated_at: new Date().toISOString()
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
