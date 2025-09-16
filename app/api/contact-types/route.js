import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId');
    
    if (!practiceGroupId) {
      return NextResponse.json({ error: 'Practice group ID is required' }, { status: 400 });
    }

    const contactTypes = await db.getContactTypes(practiceGroupId);
    return NextResponse.json({ contactTypes });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contact types' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { practiceGroupId, typeName } = await request.json();
    
    if (!practiceGroupId || !typeName) {
      return NextResponse.json({ error: 'Practice group ID and type name are required' }, { status: 400 });
    }

    await db.saveContactType(practiceGroupId, typeName);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add contact type' }, { status: 500 });
  }
}