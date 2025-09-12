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
    const users = await db.getAllUsers();
    const manager = users.find(user => user.email === groupId && user.role === 'practice_manager');
    
    if (!manager) {
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
    console.error('Error fetching contact information:', error);
    return NextResponse.json({ error: 'Failed to fetch contact information' }, { status: 500 });
  }
}