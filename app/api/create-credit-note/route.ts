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

    const { invoiceId, amountCents, isFullCredit, reason, poNumber } =
      await request.json();

    if (!invoiceId || !amountCents) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify ownership + invoice is finalized
    const { data: invoice, error: invError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (invError || !invoice) {
      console.error('[create-credit-note] Invoice lookup failed:', {
        invoiceId,
        userId: user.id,
        error: invError
      });
      return NextResponse.json(
        {
          error: 'Invoice not found or you do not have permission to access it.'
        },
        { status: 404 }
      );
    }

    if (!invoice.is_locked) {
      return NextResponse.json(
        { error: 'Credit notes can only be issued on finalized invoices' },
        { status: 400 }
      );
    }

    if (invoice.is_cancelled) {
      return NextResponse.json(
        { error: 'This invoice has already been fully cancelled' },
        { status: 400 }
      );
    }

    // Validate credit amount doesn't exceed invoice total
    const alreadyCreditedCents = invoice.credited_amount_cents || 0;
    const remainingCreditableCents =
      invoice.total_amount_cents - alreadyCreditedCents;

    if (amountCents > remainingCreditableCents) {
      return NextResponse.json(
        {
          error: `Credit amount cannot exceed remaining creditable amount of ${remainingCreditableCents / 100}`
        },
        { status: 400 }
      );
    }

    // Generate credit note number
    const { data: creditNoteNumber, error: seqError } = await supabaseAdmin.rpc(
      'generate_credit_note_number',
      {
        p_user_id: user.id,
        p_country: invoice.country_snapshot || 'US'
      }
    );

    if (seqError || !creditNoteNumber) {
      return NextResponse.json(
        { error: 'Failed to generate credit note number' },
        { status: 500 }
      );
    }

    // Create the credit note
    const { data: creditNote, error: cnError } = await supabaseAdmin
      .from('credit_notes')
      .insert([
        {
          user_id: user.id,
          invoice_id: invoiceId,
          credit_note_number: creditNoteNumber,
          credit_note_date: new Date().toISOString(),
          amount_cents: amountCents,
          is_full_credit: isFullCredit,
          reason: reason?.trim() || null,
          currency_snapshot: invoice.currency_snapshot,
          country_snapshot: invoice.country_snapshot,
          client_name: invoice.client_name,
          client_email: invoice.client_email,
          business_name_snapshot: invoice.business_name_snapshot,
          po_number: poNumber?.trim() || invoice.po_number || null
        }
      ])
      .select()
      .single();

    if (cnError || !creditNote) {
      return NextResponse.json(
        { error: cnError?.message || 'Failed to create credit note' },
        { status: 500 }
      );
    }

    // Update invoice status based on credit amount
    const newCreditedTotal = alreadyCreditedCents + amountCents;
    const isNowFullyCancelled = newCreditedTotal >= invoice.total_amount_cents;

    const invoiceUpdate: Record<string, any> = {
      credited_amount_cents: newCreditedTotal
    };

    if (isNowFullyCancelled) {
      // Full credit — mark invoice as cancelled
      invoiceUpdate.is_cancelled = true;
      invoiceUpdate.cancelled_at = new Date().toISOString();
      invoiceUpdate.cancelled_reason =
        reason?.trim() || 'Full credit note issued';
    }
    // Note: partial credit doesn't change is_cancelled — we track it via credited_amount_cents

    await supabaseAdmin
      .from('invoices')
      .update(invoiceUpdate)
      .eq('id', invoiceId);

    return NextResponse.json(
      {
        creditNote,
        isFullyCancelled: isNowFullyCancelled,
        newCreditedTotal
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create credit note error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
