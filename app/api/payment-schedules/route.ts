import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INTERVAL_DAYS: Record<string, number> = {
  monthly: 30,
  biweekly: 14,
  weekly: 7
};

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

    const {
      estimateId,
      frequency,
      customIntervalDays,
      amountCents,
      startDate,
      mode,
      totalInvoices
    } = await request.json();

    if (!estimateId || !frequency || !amountCents || !startDate || !mode) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    // ── Pro / lifetime gate ───────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, lifetime_access')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier !== 'pro' && !profile?.lifetime_access) {
      return NextResponse.json(
        { error: 'Pro subscription required.' },
        { status: 403 }
      );
    }

    // ── Validate estimate ─────────────────────────────────────────────────────
    const { data: estimate } = await supabaseAdmin
      .from('estimates')
      .select('id, user_id, client_status, cancelled_at, superseded_at')
      .eq('id', estimateId)
      .eq('user_id', user.id)
      .single();

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found.' },
        { status: 404 }
      );
    }
    if (
      estimate.client_status !== 'approved' ||
      estimate.cancelled_at ||
      estimate.superseded_at
    ) {
      return NextResponse.json(
        {
          error: 'Schedule can only be created for an active approved estimate.'
        },
        { status: 400 }
      );
    }

    const intervalDays =
      frequency === 'custom'
        ? customIntervalDays || 30
        : INTERVAL_DAYS[frequency] || 30;

    const { data: schedule, error: insertError } = await supabaseAdmin
      .from('payment_schedules')
      .insert([
        {
          user_id: user.id,
          estimate_id: estimateId,
          frequency,
          interval_days: intervalDays,
          amount_cents: amountCents,
          start_date: startDate,
          next_run_date: startDate,
          mode,
          is_active: true,
          invoices_created: 0,
          total_invoices: totalInvoices || null
        }
      ])
      .select()
      .single();

    if (insertError || !schedule) {
      throw new Error(insertError?.message || 'Failed to create schedule.');
    }

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err: any) {
    console.error('Create payment schedule error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
