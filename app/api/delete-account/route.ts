import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe with your private secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' // Use your current Stripe API version
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

    // 2. Query the user's profile to extract subscription markers
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, stripe_subscription_id') // Adjust column names if different
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to retrieve profile billing context' },
        { status: 500 }
      );
    }

    // 3. If the user is on the Pro plan and has a subscription ID, cancel it via Stripe
    if (
      profile?.subscription_tier === 'pro' &&
      profile?.stripe_subscription_id
    ) {
      try {
        // Cancel the subscription immediately
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (stripeError: any) {
        console.error('Stripe Cancellation Error:', stripeError);
        // We catch the error but don't block account deletion if the subscription is already dead on Stripe's end
        if (stripeError.code !== 'resource_missing') {
          return NextResponse.json(
            { error: `Billing cancellation failed: ${stripeError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 4. Administratively delete the user from auth.users schema
    // Foreign keys set to ON DELETE CASCADE will now automatically clear database rows securely
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
