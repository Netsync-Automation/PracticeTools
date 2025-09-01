import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const upvoters = await db.getIssueUpvoters(params.id);
    return NextResponse.json({ upvoters });
  } catch (error) {
    console.error('Error fetching upvoters:', error);
    return NextResponse.json({ error: 'Failed to fetch upvoters' }, { status: 500 });
  }
}