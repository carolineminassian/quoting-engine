import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { estimateIds, baseUrl } = body;

    if (!Array.isArray(estimateIds) || estimateIds.length === 0) {
      return NextResponse.json(
        { error: 'No estimates provided' },
        { status: 400 }
      );
    }

    // Fetch profile (business_name, country, logo, ownerEmail)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('business_name, country, logo_url')
      .eq('id', user.id)
      .single();

    const ownerEmail = user.email;

    if (!profile || !ownerEmail) {
      return NextResponse.json(
        { error: 'Owner profile incomplete' },
        { status: 400 }
      );
    }

    // Fetch all targeted estimates — verify ownership server-side
    const { data: estimates, error: fetchError } = await supabaseAdmin
      .from('estimates')
      .select(
        'id, custom_id, client_name, client_email, client_status, cancelled_at, superseded_at, last_followup_sent_at, country_snapshot'
      )
      .in('id', estimateIds)
      .eq('user_id', user.id)
      .eq('is_locked', true);

    if (fetchError || !estimates) {
      return NextResponse.json(
        { error: 'Failed to load estimates' },
        { status: 500 }
      );
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const successfulIds: string[] = [];

    // Process each estimate sequentially. Resend allows ~10 emails/sec on free tier;
    // sequential is safe and easier to reason about.
    for (const est of estimates) {
      // Skip if not eligible
      if (
        !est.client_email ||
        est.cancelled_at ||
        est.superseded_at ||
        (est.client_status && est.client_status !== 'pending') ||
        (est.last_followup_sent_at &&
          now - new Date(est.last_followup_sent_at).getTime() < sevenDaysMs)
      ) {
        skipped++;
        continue;
      }

      const estCountry = est.country_snapshot || profile.country || 'US';
      const isFr = estCountry === 'FR';
      const customId = est.custom_id || est.id.slice(0, 8);
      const estimateUrl = `${baseUrl || 'https://pactestim.com'}/estimates/${est.id}`;

      const logoHtml = profile.logo_url
        ? `<img src="${profile.logo_url}" alt="${profile.business_name}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
        : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${profile.business_name}</h2>`;

      const subject = isFr
        ? `Suivi de votre devis #${customId}`
        : `Following up on Estimate #${customId}`;

      const htmlContent = isFr
        ? `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
          ${logoHtml}
          <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">Bonjour ${est.client_name},</h2>
          <p style="line-height: 1.6;">Petit rappel concernant le devis que je vous ai transmis. J'aimerais beaucoup avoir votre retour dès que vous en aurez l'occasion.</p>
          <a href="${estimateUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; margin-bottom: 16px;">Voir le devis</a>
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Cordialement,<br/><strong>${profile.business_name}</strong></p>
        </div>`
        : `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
          ${logoHtml}
          <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">Hello ${est.client_name},</h2>
          <p style="line-height: 1.6;">Just a quick follow-up on the estimate I sent you. I'd love to hear your thoughts whenever you have a moment.</p>
          <a href="${estimateUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; margin-bottom: 16px;">View Estimate</a>
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Best regards,<br/><strong>${profile.business_name}</strong></p>
        </div>`;

      try {
        const { error } = await resend.emails.send({
          from: `${profile.business_name} <estimates@pactestim.com>`,
          to: [est.client_email],
          replyTo: ownerEmail,
          subject,
          html: htmlContent
        });

        if (error) {
          console.error(`Bulk follow-up failed for ${est.id}:`, error);
          failed++;
        } else {
          sent++;
          successfulIds.push(est.id);
        }
      } catch (err) {
        console.error(`Bulk follow-up exception for ${est.id}:`, err);
        failed++;
      }
    }

    // Mark all successful estimates with the new follow-up timestamp in one update
    if (successfulIds.length > 0) {
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from('estimates')
        .update({ last_followup_sent_at: nowIso })
        .in('id', successfulIds);
    }

    return NextResponse.json({ sent, skipped, failed });
  } catch (err: any) {
    console.error('Bulk follow-up route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
