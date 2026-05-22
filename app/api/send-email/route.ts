import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const {
      email,
      clientName,
      estimateUrl,
      businessName,
      userEmail,
      logoUrl,
      country
    } = await req.json();

    if (!email || !businessName || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const isFr = country === 'FR';

    console.log(
      `[send-email] Sending to ${email} (lang: ${isFr ? 'FR' : 'EN'}), reply-to: ${userEmail}`
    );

    // Logo HTML — falls back to the business name as a heading if no logo
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
      : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${businessName}</h2>`;

    const subject = isFr
      ? `Nouveau Devis de ${businessName}`
      : `New Estimate from ${businessName}`;

    const htmlContent = isFr
      ? `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 16px;">Bonjour ${clientName},</h2>
        <p style="line-height: 1.6;">Vous avez reçu un nouveau devis de la part de <strong>${businessName}</strong>.</p>
        <p style="line-height: 1.6;">Cliquez ci-dessous pour consulter les détails :</p>
        <a href="${estimateUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; margin-bottom: 16px;">
          Consulter le Devis
        </a>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          Si vous avez des questions, vous pouvez simplement <strong>répondre à cet e-mail</strong> pour contacter directement le prestataire à l'adresse ${userEmail}.
        </p>
      </div>
    `
      : `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
        ${logoHtml}
        <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 16px;">Hello ${clientName},</h2>
        <p style="line-height: 1.6;">You have received a new estimate from <strong>${businessName}</strong>.</p>
        <p style="line-height: 1.6;">Click below to view the details:</p>
        <a href="${estimateUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; margin-bottom: 16px;">
          View Estimate
        </a>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
        <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
          If you have any questions, you can simply <strong>reply to this email</strong> to contact the provider directly at ${userEmail}.
        </p>
      </div>
    `;

    const data = await resend.emails.send({
      from: `${businessName} <estimates@pactestim.com>`,
      to: [email],
      replyTo: userEmail,
      subject,
      html: htmlContent
    });

    if (data.error) {
      console.error('[send-email] Resend error:', data.error);
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    console.log(`[send-email] Successfully sent (id: ${data.data?.id})`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[send-email] Route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
