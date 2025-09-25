import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectNumber = searchParams.get('projectNumber');
    
    if (!projectNumber) {
      return NextResponse.json({ error: 'Project number required' }, { status: 400 });
    }

    // Get all assignments and find by project number
    const assignments = await db.getAllAssignments();
    const assignment = assignments.find(a => a.projectNumber === projectNumber);
    
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Return all email-related fields for debugging
    const emailDebugInfo = {
      assignmentId: assignment.id,
      projectNumber: assignment.projectNumber,
      customerName: assignment.customerName,
      status: assignment.status,
      
      // Name fields
      am: assignment.am,
      pm: assignment.pm,
      resourceAssigned: assignment.resourceAssigned,
      
      // Email fields (DSR compliance)
      am_email: assignment.am_email,
      pm_email: assignment.pm_email,
      resource_assigned_email: assignment.resource_assigned_email,
      
      // Notification users
      resource_assignment_notification_users: assignment.resource_assignment_notification_users,
      
      // Parsed notification users
      parsedNotificationUsers: (() => {
        try {
          return JSON.parse(assignment.resource_assignment_notification_users || '[]');
        } catch {
          return [];
        }
      })(),
      
      created_at: assignment.created_at,
      updated_at: assignment.updated_at
    };

    return NextResponse.json({
      success: true,
      assignment: emailDebugInfo,
      environment: process.env.ENVIRONMENT || 'dev'
    });
  } catch (error) {
    console.error('Error debugging assignment emails:', error);
    return NextResponse.json({ error: 'Failed to debug assignment emails' }, { status: 500 });
  }
}