import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with your API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customId,
      clientName,
      commentContent,
      ownerEmail,
      estimateUrl,
      country
    } = body;

    if (!ownerEmail) {
      return NextResponse.json(
        { error: 'Missing destination email' },
        { status: 400 }
      );
    }

    const isFr = country === 'FR';

    const subject = isFr
      ? `[Nouveau Message] Modif. demandée sur le Devis #${customId}`
      : `[New Message] Modification requested on Estimate #${customId}`;

    const textContent = isFr
      ? `Bonjour,\n\nVotre client ${clientName} a laissé un nouveau commentaire concernant le devis #${customId} :\n\n"${commentContent}"\n\nVous pouvez voir le fil de discussion et modifier le document ici : ${estimateUrl}`
      : `Hello,\n\nYour client ${clientName} has left a new comment on estimate #${customId}:\n\n"${commentContent}"\n\nYou can view the thread and adjust the document here: ${estimateUrl}`;

    // Send the transactional email via Resend
    await resend.emails.send({
      from: 'Estimates App <noreply@pactestim.com>', // Replace with your verified Resend domain or 'onboarding@resend.dev' for testing
      to: ownerEmail,
      subject: subject,
      text: textContent
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
