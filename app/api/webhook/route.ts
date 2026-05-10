import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
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
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Traiter uniquement les paiements réussis
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const type = session.metadata?.type;

    if (userId && type) {
      if (type === 'pro') {
        // Mise à niveau Pro
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_tier: 'pro' })
          .eq('id', userId);
      } else if (type === 'credits') {
        // Ajout de 10 crédits
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('estimate_credits')
          .eq('id', userId)
          .single();

        const currentCredits = data?.estimate_credits || 0;

        await supabaseAdmin
          .from('profiles')
          .update({ estimate_credits: currentCredits + 10 })
          .eq('id', userId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
