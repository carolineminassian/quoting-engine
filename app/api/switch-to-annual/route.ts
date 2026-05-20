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

    // 1. Verify the user's session
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

    // 2. Look up subscription details
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(
        'subscription_tier, subscription_interval, stripe_subscription_id, stripe_customer_id'
      )
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to retrieve subscription context' },
        { status: 500 }
      );
    }

    // 3. Validate user is on monthly Pro
    if (profile?.subscription_tier !== 'pro') {
      return NextResponse.json(
        { error: 'No active Pro subscription found' },
        { status: 400 }
      );
    }

    if (profile?.subscription_interval === 'annual') {
      return NextResponse.json(
        { error: 'You are already on the annual plan' },
        { status: 400 }
      );
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Missing Stripe subscription reference' },
        { status: 400 }
      );
    }

    // 4. Get the Annual price ID from env
    const annualPriceId = process.env.STRIPE_PRO_ANNUAL_PRICE_ID;
    if (!annualPriceId) {
      console.error('STRIPE_PRO_ANNUAL_PRICE_ID not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 5. Retrieve the existing subscription to find current period end
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id
      );
    } catch (err: any) {
      console.error('Failed to retrieve subscription:', err);
      return NextResponse.json(
        { error: 'Could not retrieve subscription' },
        { status: 500 }
      );
    }

    // Stripe moved current_period_end to the subscription items level (Basil/Dahlia API)
    const periodEnd =
      subscription.items?.data?.[0]?.current_period_end ??
      (subscription as any).current_period_end ??
      null;

    if (!periodEnd) {
      return NextResponse.json(
        { error: 'Could not determine current period end' },
        { status: 500 }
      );
    }

    // 6. Create a Subscription Schedule from the existing subscription
    // This is Stripe's "official" way to handle plan transitions at period end.
    let schedule: Stripe.SubscriptionSchedule;
    try {
      // First, convert the existing subscription into a schedule
      schedule = await stripe.subscriptionSchedules.create({
        from_subscription: profile.stripe_subscription_id
      });
    } catch (err: any) {
      // If a schedule already exists, retrieve it via the subscription
      if (
        err.code === 'subscription_schedule_already_released' ||
        err.message?.includes('already')
      ) {
        // Subscription already has a schedule attached — retrieve it
        const subWithSchedule = await stripe.subscriptions.retrieve(
          profile.stripe_subscription_id,
          { expand: ['schedule'] }
        );
        if (subWithSchedule.schedule) {
          schedule = await stripe.subscriptionSchedules.retrieve(
            typeof subWithSchedule.schedule === 'string'
              ? subWithSchedule.schedule
              : subWithSchedule.schedule.id
          );
        } else {
          throw err;
        }
      } else {
        console.error('Failed to create subscription schedule:', err);
        return NextResponse.json(
          { error: `Schedule creation failed: ${err.message}` },
          { status: 500 }
        );
      }
    }

    // 7. Update the schedule with two phases:
    //    Phase 1: current monthly price (until period end)
    //    Phase 2: annual price (starts at period end, runs indefinitely)
    const currentPriceId = subscription.items.data[0].price.id;

    try {
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        phases: [
          {
            // Phase 1: existing monthly plan, ends at current period end
            items: [{ price: currentPriceId, quantity: 1 }],
            start_date: subscription.items.data[0].current_period_start as any,
            end_date: periodEnd as any,
            proration_behavior: 'none'
          },
          {
            // Phase 2: annual plan, takes over at period end
            items: [{ price: annualPriceId, quantity: 1 }],
            iterations: 1, // 1 year duration; will auto-renew via end_behavior: 'release'
            proration_behavior: 'none'
          }
        ]
      });
    } catch (err: any) {
      console.error('Failed to update subscription schedule:', err);
      return NextResponse.json(
        { error: `Schedule update failed: ${err.message}` },
        { status: 500 }
      );
    }

    // 8. Mark the pending switch in DB so UI can display the status
    await supabaseAdmin
      .from('profiles')
      .update({ pending_plan_switch: 'annual' })
      .eq('id', user.id);

    return NextResponse.json(
      { success: true, switchAt: periodEnd },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Switch to annual error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
