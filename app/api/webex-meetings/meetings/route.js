import { NextResponse } from 'next/server';
import { getMeetings } from '../../../../lib/meeting-storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meetings = await getMeetings();
    return NextResponse.json({ meetings });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}