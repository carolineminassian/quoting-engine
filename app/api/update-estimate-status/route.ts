import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { estimateId, status, estimateUrl } = await request.json();

    if (
      !estimateId ||
      !['approved', 'rejected'].includes(status) ||
      !estimateUrl
    ) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // 1. Update status and fetch estimate data in one go
    const { data: estimate, error: updateError } = await supabaseAdmin
      .from('estimates')
      .update({ client_status: status })
      .eq('id', estimateId)
      .select('user_id, client_name, client_email, custom_id')
      .single();

    if (updateError) throw updateError;

    // 2. Fetch Owner's profile and auth email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('business_name, country, logo_url')
      .eq('id', estimate.user_id)
      .single();

    const {
      data: { user }
    } = await supabaseAdmin.auth.admin.getUserById(estimate.user_id);
    const ownerEmail = user?.email;

    if (!ownerEmail || !profile) {
      return NextResponse.json({
        success: true,
        warning: 'Status updated, but emails failed (missing user data)'
      });
    }

    const isFr = profile.country === 'FR';
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pactestim.com';

    // Logos
    const logoFile = isFr ? 'favicon-fr.png' : 'favicon-us.png';
    const pactEstimLogoHtml = `<img src="${baseUrl}/${logoFile}" alt="PactEstim" style="max-height: 40px; margin-bottom: 24px; display: block;" />`;
    const ownerLogoHtml = profile.logo_url
      ? `<img src="${profile.logo_url}" alt="${profile.business_name}" style="max-height: 50px; margin-bottom: 24px; display: block;" />`
      : `<h2 style="margin-bottom: 24px; color: #111827; font-size: 20px;">${profile.business_name}</h2>`;

    const emailPromises = [];

    // Format a safe fallback ID using the estimateId from the request payload
    const displayId = estimate.custom_id || estimateId.slice(0, 8);

    // 3. Email 1: Notification to Business Owner (PactEstim Branding)
    const ownerSubject = isFr
      ? `[PactEstim] Devis ${status === 'approved' ? 'Approuvé' : 'Refusé'} par ${estimate.client_name}`
      : `[PactEstim] Estimate ${status === 'approved' ? 'Approved' : 'Rejected'} by ${estimate.client_name}`;

    const ownerHtml = isFr
      ? `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${pactEstimLogoHtml}
          <p style="font-size: 16px;">Bonjour,</p>
          <p style="font-size: 16px; line-height: 1.5;">Votre client <strong>${estimate.client_name}</strong> a <strong>${status === 'approved' ? 'approuvé' : 'refusé'}</strong> le devis #${displayId}.</p>
          <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">Voir le devis</a>
        </div>`
      : `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${pactEstimLogoHtml}
          <p style="font-size: 16px;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.5;">Your client <strong>${estimate.client_name}</strong> has <strong>${status}</strong> estimate #${displayId}.</p>
          <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">View Estimate</a>
        </div>`;
    emailPromises.push(
      resend.emails.send({
        from: 'PactEstim <noreply@pactestim.com>',
        to: ownerEmail,
        subject: ownerSubject,
        html: ownerHtml
      })
    );

    // 4. Email 2: Confirmation to Client (Business Owner Branding - ONLY if approved)
    if (status === 'approved' && estimate.client_email) {
      const clientSubject = isFr
        ? `Confirmation d'accord : Devis #${displayId}`
        : `Agreement Confirmation: Estimate #${displayId}`;

      const clientHtml = isFr
        ? `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${ownerLogoHtml}
            <p style="font-size: 16px;">Bonjour ${estimate.client_name},</p>
            <p style="font-size: 16px; line-height: 1.5;">Nous confirmons la validation de votre devis <strong>#${displayId}</strong> avec <strong>${profile.business_name}</strong>.</p>
            <p style="font-size: 16px; line-height: 1.5;">Vous pouvez consulter le document finalisé à tout moment via le lien ci-dessous.</p>
            <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">Consulter le devis</a>
          </div>`
        : `<div style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${ownerLogoHtml}
            <p style="font-size: 16px;">Hello ${estimate.client_name},</p>
            <p style="font-size: 16px; line-height: 1.5;">We confirm your approval of estimate <strong>#${displayId}</strong> with <strong>${profile.business_name}</strong>.</p>
            <p style="font-size: 16px; line-height: 1.5;">You can view the finalized document at any time using the link below.</p>
            <a href="${estimateUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 8px; font-weight: bold; font-size: 14px;">View Estimate</a>
          </div>`;

      emailPromises.push(
        resend.emails.send({
          from: `${profile.business_name} <estimates@pactestim.com>`,
          replyTo: ownerEmail,
          to: estimate.client_email,
          subject: clientSubject,
          html: clientHtml
        })
      );
    }

    // Await all emails to send concurrently
    await Promise.all(emailPromises);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
