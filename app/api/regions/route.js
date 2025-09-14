import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const regions = await db.getRegions();
    return NextResponse.json({ regions });
  } catch (error) {
    console.error('Error fetching regions:', error);
    return NextResponse.json({ error: 'Failed to fetch regions' }, { status: 500 });
  }
}