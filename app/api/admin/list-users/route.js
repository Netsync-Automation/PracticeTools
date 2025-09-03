import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await db.getAllUsers();
    return NextResponse.json({ 
      success: true, 
      users: users.map(user => ({
        email: user.email,
        name: user.name,
        role: user.role,
        auth_method: user.auth_method,
        created_from: user.created_from,
        created_at: user.created_at
      }))
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}