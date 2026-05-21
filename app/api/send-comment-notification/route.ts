import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase with the Service Role Key to safely access auth.users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customId,
      clientName,
      commentContent,
      ownerId,
      estimateUrl,
      country
    } = body;

    if (!ownerId) {
      return NextResponse.json({ error: 'Missing owner ID' }, { status: 400 });
    }

    // 1. Securely resolve the business owner's email + check notification preferences
    const {
      data: { user },
      error: userError
    } = await supabaseAdmin.auth.admin.getUserById(ownerId);

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: 'Could not resolve owner email account' },
        { status: 400 }
      );
    }

    // Check if owner has opted out of comment notifications
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('notify_on_comment')
      .eq('id', ownerId)
      .single();

    // Resolve the estimate ID from the body (we'll need it for notification creation)
    const estimateId = body.estimateId;

    // Always create an in-app notification badge (regardless of email setting)
    if (estimateId) {
      const { error: notifError } = await supabaseAdmin
        .from('estimate_notifications')
        .insert({
          user_id: ownerId,
          estimate_id: estimateId,
          event_type: 'comment'
        });
      if (notifError) {
        console.error('[notification] Failed to create badge:', notifError);
      }
    }

    if (ownerProfile?.notify_on_comment === false) {
      return NextResponse.json(
        { skipped: 'owner opted out of comment emails (badge created)' },
        { status: 200 }
      );
    }

    const ownerEmail = user.email;
    const isFr = country === 'FR';

    // Reference your hosted PNG dynamically based on the user's country
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pactestim.com';
    const logoFile = isFr ? 'favicon-fr.png' : 'favicon-us.png';
    const pactEstimLogoHtml = `<img src="${baseUrl}/${logoFile}" alt="PactEstim" style="max-height: 40px; margin-bottom: 24px; display: block;" />`;

    // 2. Format the email content
    const subject = isFr
      ? `[Nouveau Message] Commentaire de ${clientName} sur le Devis #${customId}`
      : `[New Message] Comment left by ${clientName} on Estimate #${customId}`;

    const textContent = isFr
      ? `Bonjour,\n\nVotre client ${clientName} a laissé un nouveau commentaire concernant le devis #${customId} :\n\n"${commentContent}"\n\nVous pouvez voir le fil de discussion et modifier le document ici : ${estimateUrl}`
      : `Hello,\n\nYour client ${clientName} has left a new comment on estimate #${customId}:\n\n"${commentContent}"\n\nYou can view the thread and adjust the document here: ${estimateUrl}`;

    const htmlContent = isFr
      ? `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${pactEstimLogoHtml}
          <p style="font-size: 16px;">Bonjour,</p>
          <p style="font-size: 16px; line-height: 1.5;">Votre client <strong>${clientName}</strong> a laissé un nouveau commentaire concernant le devis <strong>#${customId}</strong> :</p>
          <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 24px 0; color: #4b5563; font-style: italic; font-size: 16px;">
            "${commentContent}"
          </blockquote>
          <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">Voir le devis</a>
        </div>`
      : `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${pactEstimLogoHtml}
          <p style="font-size: 16px;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.5;">Your client <strong>${clientName}</strong> has left a new comment on estimate <strong>#${customId}</strong>:</p>
          <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 24px 0; color: #4b5563; font-style: italic; font-size: 16px;">
            "${commentContent}"
          </blockquote>
          <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">View Estimate</a>
        </div>`;

    // 3. Send the notification via Resend
    await resend.emails.send({
      from: 'PactEstim <noreply@pactestim.com>',
      to: ownerEmail,
      subject: subject,
      text: textContent,
      html: htmlContent
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
