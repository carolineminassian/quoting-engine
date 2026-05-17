import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    // 1. Add logoUrl to the destructured payload
    const { email, clientName, estimateUrl, businessName, userEmail, logoUrl } =
      await req.json();

    console.log(`Sending email to: ${email}`);
    console.log(`Reply-To set to: ${userEmail}`);

    // 2. Prepare the logo HTML snippet
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
      : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${businessName}</h2>`;

    const data = await resend.emails.send({
      from: `${businessName} <estimates@pactestim.com>`,
      to: [email],
      replyTo: userEmail,
      subject: `New Estimate from ${businessName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; color: #111827;">
          ${logoHtml}
          <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 16px;">Hello ${clientName},</h2>
          <p>You have received a new estimate from <strong>${businessName}</strong>.</p>
          <p>Click below to view the details:</p>
          <a href="${estimateUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; margin-bottom: 16px;">
            View Estimate
          </a>
          <hr style="border: 0; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
          <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
            If you have any questions, you can simply <strong>reply to this email</strong> to contact the provider directly at ${userEmail}.
          </p>
        </div>
      `
    });

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
