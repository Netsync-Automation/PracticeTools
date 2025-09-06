import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export async function GET() {
  try {
    const rules = await db.getEmailRules();
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching email rules:', error);
    return NextResponse.json({ error: 'Failed to fetch email rules' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const rule = await request.json();
    const savedRule = await db.saveEmailRule(rule);
    return NextResponse.json(savedRule);
  } catch (error) {
    console.error('Error saving email rule:', error);
    return NextResponse.json({ error: 'Failed to save email rule' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, ...updates } = await request.json();
    const success = await db.updateEmailRule(id, updates);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to update email rule' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating email rule:', error);
    return NextResponse.json({ error: 'Failed to update email rule' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }
    
    const success = await db.deleteEmailRule(id);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to delete email rule' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error deleting email rule:', error);
    return NextResponse.json({ error: 'Failed to delete email rule' }, { status: 500 });
  }
}