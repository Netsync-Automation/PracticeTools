import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../lib/dynamodb.js';

export async function GET() {
  try {
    let actions = await db.getEmailActions();
    
    if (!actions || actions.length === 0) {
      await createDefaultActions();
      actions = await db.getEmailActions();
    }
    
    if (!actions || actions.length === 0) {
      actions = [{ value: 'resource_assignment', name: 'Resource Assignment' }];
    }
    
    return NextResponse.json({ 
      success: true, 
      actions: actions.sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (error) {
    return NextResponse.json({ 
      success: true, 
      actions: [{ value: 'resource_assignment', name: 'Resource Assignment' }]
    });
  }
}

async function createDefaultActions() {
  const defaultActions = [
    { 
      value: 'resource_assignment', 
      name: 'Resource Assignment',
      description: 'Create a new resource assignment from email data'
    }
  ];
  
  for (const action of defaultActions) {
    try {
      await db.createEmailAction({
        id: action.value,
        value: action.value,
        name: action.name,
        description: action.description,
        created_at: new Date().toISOString(),
        environment: getEnvironment()
      });
    } catch (error) {
      // Silent fallback
    }
  }
}