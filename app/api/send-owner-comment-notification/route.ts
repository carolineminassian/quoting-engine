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
    const body = await request.json();
    const {
      customId,
      ownerName,
      commentContent,
      ownerId,
      clientEmail,
      estimateUrl,
      country
    } = body;

    if (!clientEmail) {
      // No client email on file — nothing to send. Not an error.
      return NextResponse.json({ skipped: 'no client email' }, { status: 200 });
    }

    if (!ownerId) {
      return NextResponse.json({ error: 'Missing owner ID' }, { status: 400 });
    }

    // Resolve the owner's email so the client can simply Reply-To them
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

    const ownerEmail = user.email;
    const isFr = country === 'FR';

    // Reference the country-specific PactEstim logo
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pactestim.com';
    const logoFile = isFr ? 'favicon-fr.png' : 'favicon-us.png';
    const pactEstimLogoHtml = `<img src="${baseUrl}/${logoFile}" alt="PactEstim" style="max-height: 40px; margin-bottom: 24px; display: block;" />`;

    const subject = isFr
      ? `[Nouveau Message] ${ownerName} a répondu sur le Devis #${customId}`
      : `[New Message] ${ownerName} replied on Estimate #${customId}`;

    const textContent = isFr
      ? `Bonjour,\n\n${ownerName} a laissé un nouveau message concernant votre devis #${customId} :\n\n"${commentContent}"\n\nVous pouvez voir le fil de discussion et répondre ici : ${estimateUrl}\n\nVous pouvez également répondre directement à cet e-mail pour contacter ${ownerName}.`
      : `Hello,\n\n${ownerName} has left a new message regarding your estimate #${customId}:\n\n"${commentContent}"\n\nYou can view the thread and reply here: ${estimateUrl}\n\nYou can also reply directly to this email to contact ${ownerName}.`;

    const htmlContent = isFr
      ? `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${pactEstimLogoHtml}
        <p style="font-size: 16px;">Bonjour,</p>
        <p style="font-size: 16px; line-height: 1.5;"><strong>${ownerName}</strong> a laissé un nouveau message concernant votre devis <strong>#${customId}</strong> :</p>
        <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 24px 0; color: #4b5563; font-style: italic; font-size: 16px;">
          "${commentContent}"
        </blockquote>
        <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">Voir le devis</a>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin-top: 32px; margin-bottom: 16px;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          Vous pouvez également <strong>répondre directement à cet e-mail</strong> pour contacter ${ownerName} à ${ownerEmail}.
        </p>
      </div>`
      : `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${pactEstimLogoHtml}
        <p style="font-size: 16px;">Hello,</p>
        <p style="font-size: 16px; line-height: 1.5;"><strong>${ownerName}</strong> has left a new message regarding your estimate <strong>#${customId}</strong>:</p>
        <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 24px 0; color: #4b5563; font-style: italic; font-size: 16px;">
          "${commentContent}"
        </blockquote>
        <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">View Estimate</a>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin-top: 32px; margin-bottom: 16px;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          You can also <strong>reply directly to this email</strong> to contact ${ownerName} at ${ownerEmail}.
        </p>
      </div>`;

    await resend.emails.send({
      from: `${ownerName} <noreply@pactestim.com>`,
      to: clientEmail,
      replyTo: ownerEmail,
      subject: subject,
      text: textContent,
      html: htmlContent
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Owner comment notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
