import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    
    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    // Get user by email (groupId is the manager's email)
    const manager = await db.getUser(groupId);
    
    if (!manager || manager.role !== 'practice_manager') {
      return NextResponse.json({ error: 'Practice manager not found' }, { status: 404 });
    }


    const contactInfo = {
      manager: {
        name: manager.name,
        email: manager.email
      },
      practices: manager.practices || []
    };

    return NextResponse.json({ contactInfo });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contact information' }, { status: 500 });
  }
}