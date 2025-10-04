import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb.js';
import { logger } from '../../../../../lib/safe-logger.js';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { assumedUser, newUser, fieldType } = await request.json();

    // Get current assignment
    const assignment = await db.getAssignmentById(id);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Update the appropriate field based on fieldType
    const updates = {};
    
    if (fieldType === 'am') {
      updates.am = `${newUser.name} <${newUser.email}>`;
    } else if (fieldType === 'isr') {
      updates.isr = `${newUser.name} <${newUser.email}>`;
    } else if (fieldType === 'pm') {
      updates.pm = `${newUser.name} <${newUser.email}>`;
      updates.pm_email = newUser.email;
    } else if (fieldType === 'requestedBy') {
      updates.requestedBy = `${newUser.name} <${newUser.email}>`;
    }

    // Update assignment
    await db.updateAssignment(id, updates);

    logger.info('Updated assignment with new user', {
      assignmentId: id,
      fieldType,
      oldUser: assumedUser,
      newUser: newUser,
      updates
    });

    return NextResponse.json({ success: true, updates });

  } catch (error) {
    logger.error('Error updating assignment with new user', { error: error.message });
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}