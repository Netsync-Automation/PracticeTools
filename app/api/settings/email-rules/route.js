import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';


export const dynamic = 'force-dynamic';
// Helper functions for rule comparison
function normalizeEmail(email) {
  if (!email || email === 'anyone' || email.trim() === '') {
    return 'anyone';
  }
  return email.toLowerCase().trim();
}

function normalizePattern(pattern) {
  if (!pattern || pattern.trim() === '') {
    return 'any';
  }
  return pattern.toLowerCase().trim();
}

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
    
    // Validate required fields
    if (!rule.friendlyName || rule.friendlyName.trim() === '') {
      return NextResponse.json({ 
        error: 'Friendly Name is required' 
      }, { status: 400 });
    }
    
    // Check for duplicate rule
    const existingRules = await db.getEmailRules();
    const duplicate = existingRules.find(existing => 
      normalizeEmail(existing.senderEmail) === normalizeEmail(rule.senderEmail) &&
      normalizePattern(existing.subjectPattern) === normalizePattern(rule.subjectPattern)
    );
    
    if (duplicate) {
      return NextResponse.json({ 
        error: `A rule with the same sender email (${rule.senderEmail || 'anyone'}) and subject pattern (${rule.subjectPattern || 'any'}) already exists: "${duplicate.name}"` 
      }, { status: 400 });
    }
    
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
    
    // Validate required fields if being updated
    if (updates.friendlyName !== undefined && (!updates.friendlyName || updates.friendlyName.trim() === '')) {
      return NextResponse.json({ 
        error: 'Friendly Name is required' 
      }, { status: 400 });
    }
    
    // Check for duplicate rule (excluding the current rule being updated)
    if (updates.senderEmail !== undefined || updates.subjectPattern !== undefined) {
      const existingRules = await db.getEmailRules();
      const currentRule = existingRules.find(rule => rule.id === id);
      
      if (currentRule) {
        const newSenderEmail = updates.senderEmail !== undefined ? updates.senderEmail : currentRule.senderEmail;
        const newSubjectPattern = updates.subjectPattern !== undefined ? updates.subjectPattern : currentRule.subjectPattern;
        
        const duplicate = existingRules.find(existing => 
          existing.id !== id &&
          normalizeEmail(existing.senderEmail) === normalizeEmail(newSenderEmail) &&
          normalizePattern(existing.subjectPattern) === normalizePattern(newSubjectPattern)
        );
        
        if (duplicate) {
          return NextResponse.json({ 
            error: `A rule with the same sender email (${newSenderEmail || 'anyone'}) and subject pattern (${newSubjectPattern || 'any'}) already exists: "${duplicate.name}"` 
          }, { status: 400 });
        }
      }
    }
    
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