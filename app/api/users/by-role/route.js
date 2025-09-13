import { NextResponse } from 'next/server';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { db } from '../../../../lib/dynamodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    
    if (!role) {
      return NextResponse.json({ success: true, users: [] });
    }

    const allUsers = await db.getAllUsers();
    const filteredUsers = allUsers.filter(user => user.role === role)
      .map(user => ({
        id: user.email,
        name: user.name,
        email: user.email
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      users: filteredUsers
    });
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users by role' },
      { status: 500 }
    );
  }
}