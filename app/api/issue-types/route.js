import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const issueTypes = await db.getIssueTypes();
    return NextResponse.json({ issueTypes });
  } catch (error) {
    console.error('Error fetching issue types:', error);
    return NextResponse.json({ error: 'Failed to fetch issue types' }, { status: 500 });
  }
}