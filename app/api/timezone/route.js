import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const timezone = process.env.DEFAULT_TIMEZONE || 'America/Chicago';

    return NextResponse.json({ timezone });
  } catch (error) {
    console.error('Error getting timezone:', error);
    return NextResponse.json({ timezone: 'America/Chicago' });
  }
}