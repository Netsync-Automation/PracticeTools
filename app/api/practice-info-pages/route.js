import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export async function GET() {
  try {
    const pages = await db.getPracticeInfoPages();
    return NextResponse.json(pages);
  } catch (error) {
    console.error('Error fetching practice info pages:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const page = await db.createPracticeInfoPage(data);
    return NextResponse.json(page);
  } catch (error) {
    console.error('Error creating practice info page:', error);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}