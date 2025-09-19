import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../lib/dynamodb.js';

export async function GET() {
  try {
    let actions = await db.getEmailActions();
    
    if (!actions || actions.length === 0) {
      await createDefaultActions();
      actions = await db.getEmailActions();
    }
    
    // Check if SA Assignment Approval Request exists, if not create it
    const hasApprovalRequest = actions.some(action => action.value === 'sa_assignment_approval_request');
    if (!hasApprovalRequest) {
      await db.createEmailAction({
        id: 'sa_assignment_approval_request',
        value: 'sa_assignment_approval_request',
        name: 'SA Assignment Approval Request',
        description: 'Update SA assignment status from Assigned to Pending Approval',
        created_at: new Date().toISOString(),
        environment: getEnvironment()
      });
      actions = await db.getEmailActions();
    }
    
    if (!actions || actions.length === 0) {
      actions = [
        { value: 'resource_assignment', name: 'Resource Assignment' },
        { value: 'sa_assignment', name: 'SA Assignment' },
        { value: 'sa_assignment_approval_request', name: 'SA Assignment Approval Request' }
      ];
    }
    
    return NextResponse.json({ 
      success: true, 
      actions: actions.sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (error) {
    return NextResponse.json({ 
      success: true, 
      actions: [
        { value: 'resource_assignment', name: 'Resource Assignment' },
        { value: 'sa_assignment', name: 'SA Assignment' },
        { value: 'sa_assignment_approval_request', name: 'SA Assignment Approval Request' }
      ]
    });
  }
}

export async function POST() {
  try {
    await createDefaultActions();
    return NextResponse.json({ success: true, message: 'Default actions created' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function createDefaultActions() {
  const defaultActions = [
    { 
      value: 'resource_assignment', 
      name: 'Resource Assignment',
      description: 'Create a new resource assignment from email data'
    },
    { 
      value: 'sa_assignment', 
      name: 'SA Assignment',
      description: 'Create a new SA assignment from email data'
    },
    { 
      value: 'sa_assignment_approval_request', 
      name: 'SA Assignment Approval Request',
      description: 'Update SA assignment status from Assigned to Pending Approval'
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