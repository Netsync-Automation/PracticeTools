import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId');
    const contactType = searchParams.get('contactType');
    const name = searchParams.get('name');
    const website = searchParams.get('website');
    
    if (!practiceGroupId || !contactType || !name) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const exists = await db.checkCompanyExists(practiceGroupId, contactType, name, website);
    return NextResponse.json({ exists });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check for duplicates' }, { status: 500 });
  }
}