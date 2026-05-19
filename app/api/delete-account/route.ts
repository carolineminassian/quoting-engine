import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe with your private secret key
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

    // 2. Query the user's profile to extract Stripe identifiers
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to retrieve profile billing context' },
        { status: 500 }
      );
    }

    // 3. Delete the Stripe customer entirely (this also cancels all subscriptions
    // and removes stored payment methods — required for GDPR compliance)
    if (profile?.stripe_customer_id) {
      try {
        await stripe.customers.del(profile.stripe_customer_id);
      } catch (stripeError: any) {
        console.error('Stripe Customer Deletion Error:', stripeError);
        // Don't block account deletion if customer is already gone on Stripe's side
        if (stripeError.code !== 'resource_missing') {
          return NextResponse.json(
            { error: `Stripe cleanup failed: ${stripeError.message}` },
            { status: 500 }
          );
        }
      }
    } else if (profile?.stripe_subscription_id) {
      // Fallback: if we somehow have a subscription ID but no customer ID,
      // at least cancel the subscription so they stop being billed
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (stripeError: any) {
        console.error('Stripe Subscription Cancellation Error:', stripeError);
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
      console.error('User auth deletion failed:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(
      `Account fully deleted for user ${user.id} (Stripe customer: ${profile?.stripe_customer_id || 'none'})`
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
