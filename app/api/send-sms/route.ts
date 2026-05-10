import { NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

export async function POST(req: Request) {
  const { phone, clientName, estimateUrl, businessName } = await req.json();

  try {
    const message = await client.messages.create({
      body: `Hi ${clientName}, ${businessName} has sent you a new estimate: ${estimateUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    return NextResponse.json({ success: true, sid: message.sid });
  } catch (error) {
    return NextResponse.json({ success: false, error: error });
  }
}
