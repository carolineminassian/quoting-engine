import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia'
});

// Le Service Role Key permet au backend d'écrire dans la base de données sans session active
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  // Idempotency check — skip if we've already processed this event
  const { data: existingEvent } = await supabaseAdmin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(`Skipping duplicate Stripe event: ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  let processedSuccessfully = false;

  // Traiter uniquement les paiements réussis
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const type = session.metadata?.type;

    // Stripe sometimes sends customer/subscription as null in the initial event payload.
    // Re-fetch the session with expanded fields to guarantee we have them.
    let customerId: string | null = null;
    let subscriptionId: string | null = null;

    if (userId && (type === 'pro' || type === 'pro_annual')) {
      // For subscriptions: retrieve fresh session to get customer + subscription IDs
      try {
        const fullSession = await stripe.checkout.sessions.retrieve(
          session.id,
          { expand: ['customer', 'subscription'] }
        );
        customerId =
          (typeof fullSession.customer === 'string'
            ? fullSession.customer
            : fullSession.customer?.id) || null;
        subscriptionId =
          (typeof fullSession.subscription === 'string'
            ? fullSession.subscription
            : fullSession.subscription?.id) || null;
        console.log(
          `[webhook] Resolved IDs from full session: customer=${customerId}, subscription=${subscriptionId}`
        );
      } catch (err) {
        console.error('[webhook] Failed to retrieve full session:', err);
      }

      // Update profile with whatever we resolved
      const updates: Record<string, any> = {
        subscription_tier: 'pro',
        subscription_interval: type === 'pro_annual' ? 'annual' : 'monthly'
      };
      if (customerId) updates.stripe_customer_id = customerId;
      if (subscriptionId) updates.stripe_subscription_id = subscriptionId;

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('[webhook] Profile update error:', updateError);
      } else {
        console.log(
          `[webhook] Pro upgrade applied for user ${userId} (interval: ${updates.subscription_interval})`
        );
      }
    } else if (userId && type === 'credits') {
      // Atomic increment to prevent race conditions
      const { error: rpcError } = await supabaseAdmin.rpc('increment_credits', {
        p_user_id: userId,
        p_amount: 10
      });
      if (rpcError) {
        console.error('Credits increment RPC failed:', rpcError);
      }
    }
    processedSuccessfully = true;
    console.log(
      `[webhook] Processed checkout.session.completed for user ${userId} (type: ${type})`
    );
  }

  // Handle subscription cancellation (period-end reached, or manually deleted)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: 'free',
        subscription_interval: null,
        stripe_subscription_id: null,
        subscription_cancel_at: null,
        pending_plan_switch: null
      })
      .eq('stripe_customer_id', customerId);
    processedSuccessfully = true;
  }

  // Handle subscription updates (e.g. user un-cancels via portal, or cancellation is scheduled,
  // OR a subscription schedule transitions from monthly to annual phase)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Stripe moved current_period_end to the subscription items level (Basil/Dahlia API)
    const periodEnd =
      subscription.items?.data?.[0]?.current_period_end ??
      (subscription as any).current_period_end ??
      null;

    // Detect scheduled cancellation via either field for compatibility
    let cancelAtIso: string | null = null;
    if (subscription.cancel_at) {
      cancelAtIso = new Date(subscription.cancel_at * 1000).toISOString();
    } else if (subscription.cancel_at_period_end && periodEnd) {
      cancelAtIso = new Date(periodEnd * 1000).toISOString();
    }

    // Detect the current price's recurring interval (monthly vs annual)
    // This catches phase transitions when a Subscription Schedule moves to its annual phase.
    const recurringInterval =
      subscription.items?.data?.[0]?.price?.recurring?.interval;
    const newInterval =
      recurringInterval === 'year'
        ? 'annual'
        : recurringInterval === 'month'
          ? 'monthly'
          : null;

    const updates: Record<string, any> = {
      subscription_cancel_at: cancelAtIso
    };

    if (newInterval) {
      updates.subscription_interval = newInterval;
      // If we just transitioned to annual, clear the pending switch marker
      if (newInterval === 'annual') {
        updates.pending_plan_switch = null;
      }
    }

    await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('stripe_customer_id', customerId);
    processedSuccessfully = true;
  }

  // Handle failed payments (downgrade after grace period — Stripe handles retries automatically)
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;
    console.warn(
      `Payment failed for customer ${customerId} — Stripe will retry automatically.`
    );
    // Optional: send an email here, or wait for subscription.deleted to fire
  }

  // Mark event as processed for idempotency — ONLY if it actually did something
  if (processedSuccessfully) {
    await supabaseAdmin
      .from('stripe_events')
      .insert({ id: event.id, type: event.type });
  } else {
    console.warn(
      `[webhook] Event ${event.id} (${event.type}) was not processed — skipping idempotency mark so it can retry`
    );
  }

  return NextResponse.json({ received: true });
}
