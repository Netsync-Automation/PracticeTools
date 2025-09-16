import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const count = await db.getDeletedContactsCount(companyId);
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get deleted contacts count' }, { status: 500 });
  }
}