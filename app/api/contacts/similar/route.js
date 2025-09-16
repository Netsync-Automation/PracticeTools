import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export async function POST(request) {
  try {
    const { name, email } = await request.json();
    
    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const similarContacts = await db.findSimilarDeletedContacts(name, email);
    return NextResponse.json({ contacts: similarContacts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to find similar contacts' }, { status: 500 });
  }
}