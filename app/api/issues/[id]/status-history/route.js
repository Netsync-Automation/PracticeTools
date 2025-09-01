import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const history = await db.getStatusHistory(params.id);
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching status history:', error);
    return NextResponse.json({ error: 'Failed to fetch status history' }, { status: 500 });
  }
}