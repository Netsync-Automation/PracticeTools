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

export async function POST(request) {
  try {
    const issueType = await request.json();
    const success = await db.saveIssueType(issueType);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save issue type' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error saving issue type:', error);
    return NextResponse.json({ error: 'Failed to save issue type' }, { status: 500 });
  }
}