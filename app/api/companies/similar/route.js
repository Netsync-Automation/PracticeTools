import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export async function POST(request) {
  try {
    const { name, website, practiceGroupId, contactType } = await request.json();
    
    if (!name || !website || !practiceGroupId || !contactType) {
      return NextResponse.json({ error: 'Name, website, practice group ID, and contact type are required' }, { status: 400 });
    }

    const similarCompanies = await db.findSimilarDeletedCompanies(name, website, practiceGroupId, contactType);
    return NextResponse.json({ companies: similarCompanies });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to find similar companies' }, { status: 500 });
  }
}