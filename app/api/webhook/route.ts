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

  // Traiter uniquement les paiements réussis
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const type = session.metadata?.type;

    // For Pro subscriptions, also save the Stripe customer/subscription IDs
    // so we can cancel/manage later via the portal
    if (userId && type === 'pro' && session.customer && session.subscription) {
      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: 'pro',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string
        })
        .eq('id', userId);
    } else if (userId && type) {
      if (type === 'pro') {
        // Mise à niveau Pro
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_tier: 'pro' })
          .eq('id', userId);
      } else if (type === 'credits') {
        // Atomic increment to prevent race conditions
        const { error: rpcError } = await supabaseAdmin.rpc(
          'increment_credits',
          { p_user_id: userId, p_amount: 10 }
        );
        if (rpcError) {
          console.error('Credits increment RPC failed:', rpcError);
        }
      }
    }
  }

  // Handle subscription cancellation (period-end reached, or manually deleted)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: 'free',
        stripe_subscription_id: null,
        subscription_cancel_at: null
      })
      .eq('stripe_customer_id', customerId);
  }

  // Handle subscription updates (e.g. user un-cancels via portal, or cancellation is scheduled)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Stripe moved current_period_end to the subscription items level (Basil/Dahlia API)
    const periodEnd =
      subscription.items?.data?.[0]?.current_period_end ??
      (subscription as any).current_period_end ??
      null;

    // If they un-canceled (cancel_at_period_end flipped back to false), clear the date
    // If they canceled (cancel_at_period_end is true), record the period end
    const cancelAt =
      subscription.cancel_at_period_end && periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null;

    await supabaseAdmin
      .from('profiles')
      .update({ subscription_cancel_at: cancelAt })
      .eq('stripe_customer_id', customerId);
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

  // Mark event as processed for idempotency
  await supabaseAdmin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });

  return NextResponse.json({ received: true });
}
