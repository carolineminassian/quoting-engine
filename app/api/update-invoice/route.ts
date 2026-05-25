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

    const body = await request.json();
    const { invoiceId, updates } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
    }

    // Verify ownership + draft status
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('user_id, is_locked')
      .eq('id', invoiceId)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.is_locked) {
      return NextResponse.json(
        {
          error: 'Cannot edit a finalized invoice. Issue a credit note instead.'
        },
        { status: 400 }
      );
    }

    // Allowed fields to update on a draft
    const allowedFields = [
      'client_name',
      'client_email',
      'client_phone',
      'client_address',
      'client_city',
      'client_zip',
      'client_country',
      'due_date',
      'invoice_date',
      'payment_terms_snapshot',
      'sections',
      'additional_charges',
      'subtotal_amount_cents',
      'tax_amount_cents',
      'total_amount_cents',
      'invoice_description',
      'notes',
      'show_details_snapshot'
    ];

    const safeUpdates: Record<string, any> = {};
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    });

    safeUpdates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(safeUpdates)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ invoice: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
