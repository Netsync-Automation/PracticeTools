import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId');
    const fieldName = searchParams.get('fieldName');
    
    if (!practiceGroupId || !fieldName) {
      return NextResponse.json({ error: 'Practice group ID and field name are required' }, { status: 400 });
    }

    const options = await db.getFieldOptions(practiceGroupId, fieldName);
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch field options' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { practiceGroupId, fieldName, options } = await request.json();
    
    if (!practiceGroupId || !fieldName || !Array.isArray(options)) {
      return NextResponse.json({ error: 'Practice group ID, field name, and options array are required' }, { status: 400 });
    }

    const success = await db.saveFieldOptions(practiceGroupId, fieldName, options);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to save field options' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save field options' }, { status: 500 });
  }
}