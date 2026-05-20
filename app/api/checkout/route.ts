import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia'
});

export async function POST(req: Request) {
try {
  const { userId, type, currency } = await req.json();

  if (!userId || !type || !currency) {
    return NextResponse.json(
      { error: 'Missing parameters' },
      { status: 400 }
    );
  }

  // Validate type and resolve the price ID server-side
  let priceId: string | undefined;
  if (type === 'pro') {
    priceId = process.env.STRIPE_PRO_PRICE_ID_LIVE;
  } else if (type === 'credits') {
    priceId = process.env.STRIPE_CREDITS_PRICE_ID_LIVE;
  } else {
    return NextResponse.json(
      { error: 'Invalid checkout type' },
      { status: 400 }
    );
  }

  if (!priceId) {
    console.error(`Missing env var for type: ${type}`);
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: type === 'pro' ? 'subscription' : 'payment',
    client_reference_id: userId,
    // This forces Stripe to use the user's specific currency from the multi-currency price ID
    currency: currency.toLowerCase(),
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/upgrade?canceled=true`,
    metadata: {
      type: type
    }
  });

  return NextResponse.json({ url: session.url });
} catch (err: any) {
  return NextResponse.json({ error: err.message }, { status: 500 });
}
}
