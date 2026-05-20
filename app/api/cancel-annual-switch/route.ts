import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia'
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing token' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token context' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_subscription_id, pending_plan_switch')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to retrieve subscription context' },
        { status: 500 }
      );
    }

    if (!profile?.pending_plan_switch) {
      return NextResponse.json(
        { error: 'No pending plan switch to cancel' },
        { status: 400 }
      );
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Missing Stripe subscription reference' },
        { status: 400 }
      );
    }

    // Find the schedule attached to the subscription
    let scheduleId: string | null = null;
    try {
      const sub = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id,
        { expand: ['schedule'] }
      );
      if (sub.schedule) {
        scheduleId =
          typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id;
      }
    } catch (err: any) {
      console.error('Failed to retrieve subscription:', err);
      return NextResponse.json(
        { error: 'Could not retrieve subscription' },
        { status: 500 }
      );
    }

    // Release the schedule — this detaches it and lets the original subscription continue normally
    if (scheduleId) {
      try {
        await stripe.subscriptionSchedules.release(scheduleId);
      } catch (err: any) {
        console.error('Failed to release subscription schedule:', err);
        return NextResponse.json(
          { error: `Schedule release failed: ${err.message}` },
          { status: 500 }
        );
      }
    }

    // Clear the marker in DB
    await supabaseAdmin
      .from('profiles')
      .update({ pending_plan_switch: null })
      .eq('id', user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('Cancel annual switch error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
