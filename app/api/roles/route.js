import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

export async function GET() {
  try {
    const roles = await db.getUserRoles();
    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}