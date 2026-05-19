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

    // 1. Verify the user's active session token
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

    // 2. Look up Stripe subscription identifier from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to retrieve subscription context' },
        { status: 500 }
      );
    }

    // 3. Validate user actually has an active Pro subscription
    if (profile?.subscription_tier !== 'pro') {
      return NextResponse.json(
        { error: 'No active Pro subscription to cancel' },
        { status: 400 }
      );
    }

    if (!profile?.stripe_subscription_id) {
      // User is marked as Pro but has no subscription ID — likely a legacy record
      // Just downgrade them in the DB
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_tier: 'free' })
        .eq('id', user.id);
      return NextResponse.json({
        success: true,
        message: 'Subscription cleared (no active Stripe record found)'
      });
    }

    // 4. Schedule cancellation at period end (user keeps Pro until they're billed next)
    // The webhook (customer.subscription.deleted) will downgrade them when period actually ends
    let periodEnd: number | null = null;
    try {
      const updated = await stripe.subscriptions.update(
        profile.stripe_subscription_id,
        { cancel_at_period_end: true }
      );
      // Stripe moved current_period_end to the subscription items level (Basil/Dahlia API)
      periodEnd =
        updated.items?.data?.[0]?.current_period_end ??
        (updated as any).current_period_end ??
        null;
    } catch (stripeError: any) {
      console.error('Stripe Cancellation Error:', stripeError);
      if (stripeError.code === 'resource_missing') {
        // Subscription already gone on Stripe — clean up DB and return
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
            subscription_cancel_at: null
          })
          .eq('id', user.id);
        return NextResponse.json({ success: true, alreadyCanceled: true });
      }
      return NextResponse.json(
        { error: `Cancellation failed: ${stripeError.message}` },
        { status: 500 }
      );
    }

    // 5. Mark the cancellation date in DB but keep them on 'pro' until period end
    // The webhook will flip subscription_tier to 'free' when the time actually arrives
    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_cancel_at: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null
      })
      .eq('id', user.id);

    return NextResponse.json(
      { success: true, cancelAt: periodEnd },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Cancel subscription error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
