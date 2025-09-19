import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const statuses = await db.getSaAssignmentStatuses();
    
    return NextResponse.json({
      success: true,
      statuses
    });
  } catch (error) {
    console.error('Error fetching SA assignment statuses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SA assignment statuses' },
      { status: 500 }
    );
  }
}