import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-ignore
  apiVersion: '2026-04-22.dahlia'
});

export async function POST(req: Request) {
  try {
    const { priceId, userId, type, currency } = await req.json();

    if (!priceId || !userId || !type || !currency) {
      return NextResponse.json(
        { error: 'Missing parameters' },
        { status: 400 }
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
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/upgrade`,
      metadata: {
        type: type
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
