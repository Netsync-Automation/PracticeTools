import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../lib/dynamodb.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    let mappings = [];
    
    if (action === 'sa_assignment') {
      // Generate mappings directly from SA assignments table schema
      mappings = getSaAssignmentFieldMappings();
    } else if (action === 'sa_assignment_approval_request') {
      // SA Assignment Approval Request only needs practice and SA fields
      mappings = getSaAssignmentApprovalRequestFieldMappings();
    } else if (action === 'sa_assignment_approved') {
      // SA Assignment Approved needs opportunity ID, revision number, and approver fields
      mappings = getSaAssignmentApprovedFieldMappings();
    } else {
      // Default to resource assignment fields
      mappings = getResourceAssignmentFieldMappings();
    }
    
    return NextResponse.json({ 
      success: true, 
      mappings: mappings.sort((a, b) => a.label.localeCompare(b.label))
    });
  } catch (error) {
    console.error('Error fetching email field mappings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function getSaAssignmentFieldMappings() {
  return [
    { value: 'practice', label: 'Practice' },
    { value: 'status', label: 'Status' },
    { value: 'opportunityId', label: 'Opportunity ID' },
    { value: 'requestDate', label: 'Request Date' },
    { value: 'eta', label: 'ETA' },
    { value: 'customerName', label: 'Customer Name' },
    { value: 'opportunityName', label: 'Opportunity Name' },
    { value: 'region', label: 'Region' },
    { value: 'am', label: 'AM' },
    { value: 'saAssigned', label: 'SA Assigned' },
    { value: 'dateAssigned', label: 'Date Assigned' },
    { value: 'notes', label: 'Notes' },
    { value: 'isr', label: 'ISR' },
    { value: 'submittedBy', label: 'Submitted By' },
    { value: 'sa_assignment_notification_users', label: 'SA Assignment Notification Users' },
    { value: 'scoopUrl', label: 'SCOOP URL' }
  ];
}

function getSaAssignmentApprovalRequestFieldMappings() {
  return [
    { value: 'opportunityId', label: 'Opportunity ID' },
    { value: 'revisionNumber', label: 'Revision Number' },
    { value: 'saAssigned', label: 'SA' },
    { value: 'sa_assignment_approval_request_notification_users', label: 'SA Assignment Approval Request Notification Users' }
  ];
}

function getSaAssignmentApprovedFieldMappings() {
  return [
    { value: 'opportunityId', label: 'Opportunity ID' },
    { value: 'revisionNumber', label: 'Revision Number' },
    { value: 'taskTriggeredBy', label: 'Approver' },
    { value: 'sa_assignment_approved_notification_users', label: 'SA Assignment Approved Notification Users' }
  ];
}

function getResourceAssignmentFieldMappings() {
  return [
    { value: 'projectNumber', label: 'Project Number' },
    { value: 'clientName', label: 'Client Name' },
    { value: 'requestedBy', label: 'Requested By' },
    { value: 'skillsRequired', label: 'Skills Required' },
    { value: 'startDate', label: 'Start Date' },
    { value: 'endDate', label: 'End Date' },
    { value: 'description', label: 'Description' },
    { value: 'priority', label: 'Priority' },
    { value: 'region', label: 'Region' },
    { value: 'pm', label: 'PM' },
    { value: 'documentationLink', label: 'Documentation Link' },
    { value: 'notes', label: 'Notes' },
    { value: 'resource_assignment_notification_users', label: 'Notification Users' }
  ];
}