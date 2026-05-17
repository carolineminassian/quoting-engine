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

    // 1. Securely resolve the business owner's email from the auth.users table
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

    // 2. Format the email content
    const subject = isFr
      ? `[Nouveau Message] Modif. demandée sur le Devis #${customId}`
      : `[New Message] Modification requested on Estimate #${customId}`;

    const textContent = isFr
      ? `Bonjour,\n\nVotre client ${clientName} a laissé un nouveau commentaire concernant le devis #${customId} :\n\n"${commentContent}"\n\nVous pouvez voir le fil de discussion et modifier le document ici : ${estimateUrl}`
      : `Hello,\n\nYour client ${clientName} has left a new comment on estimate #${customId}:\n\n"${commentContent}"\n\nYou can view the thread and adjust the document here: ${estimateUrl}`;

    // 3. Send the notification via Resend
    await resend.emails.send({
      from: 'Estimates App <onboarding@resend.dev>', // Update this to your verified domain when ready
      to: ownerEmail,
      subject: subject,
      text: textContent
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
