import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { estimateId, status } = await request.json();

    if (!estimateId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('estimates')
      .update({ client_status: status })
      .eq('id', estimateId);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
