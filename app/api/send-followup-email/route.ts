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
      estimateId,
      customId,
      clientName,
      clientEmail,
      estimateUrl,
      businessName,
      ownerEmail,
      logoUrl,
      country
    } = body;

    if (!estimateId || !clientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Server-side cooldown check — prevents abuse even if client bypasses UI
    const { data: existing } = await supabaseAdmin
      .from('estimates')
      .select('last_followup_sent_at')
      .eq('id', estimateId)
      .single();

    if (existing?.last_followup_sent_at) {
      const lastSent = new Date(existing.last_followup_sent_at).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastSent < sevenDaysMs) {
        return NextResponse.json(
          { error: 'Cooldown active', cooldown: true },
          { status: 429 }
        );
      }
    }

    const isFr = country === 'FR';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
      : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${businessName}</h2>`;

    const subject = isFr
      ? `Suivi de votre devis #${customId}`
      : `Following up on Estimate #${customId}`;

    const htmlContent = isFr
      ? `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">Bonjour ${clientName},</h2>
        <p style="line-height: 1.6;">Petit rappel concernant le devis que je vous ai transmis. J'aimerais beaucoup avoir votre retour dès que vous en aurez l'occasion.</p>
        <p style="line-height: 1.6;">Vous pouvez consulter le devis ci-dessous :</p>
        <a href="${estimateUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; margin-bottom: 16px;">Voir le devis</a>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          Si vous avez des questions, vous pouvez <strong>répondre à cet e-mail</strong> pour me joindre directement à ${ownerEmail}.
        </p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">Cordialement,<br/><strong>${businessName}</strong></p>
      </div>`
      : `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 16px;">Hello ${clientName},</h2>
        <p style="line-height: 1.6;">Just a quick follow-up on the estimate I sent you. I'd love to hear your thoughts whenever you have a moment.</p>
        <p style="line-height: 1.6;">You can review the estimate below:</p>
        <a href="${estimateUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; margin-bottom: 16px;">View Estimate</a>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          Any questions? Simply <strong>reply to this email</strong> to reach me directly at ${ownerEmail}.
        </p>
        <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">Best regards,<br/><strong>${businessName}</strong></p>
      </div>`;

    const { error } = await resend.emails.send({
      from: `${businessName} <estimates@pactestim.com>`,
      to: [clientEmail],
      replyTo: ownerEmail,
      subject,
      html: htmlContent
    });

    if (error) {
      console.error('Follow-up send error:', error);
      return NextResponse.json({ error }, { status: 500 });
    }

    // Mark the follow-up timestamp
    await supabaseAdmin
      .from('estimates')
      .update({ last_followup_sent_at: new Date().toISOString() })
      .eq('id', estimateId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Follow-up route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
