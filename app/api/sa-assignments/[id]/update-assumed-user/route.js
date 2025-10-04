import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb.js';
import { logger } from '../../../../../lib/safe-logger.js';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { assumedUser, newUser, fieldType } = await request.json();

    const assignment = await db.getSaAssignmentById(id);
    if (!assignment) {
      return NextResponse.json({ error: 'SA assignment not found' }, { status: 404 });
    }

    const updates = {};
    
    if (fieldType === 'am') {
      updates.am = `${newUser.name} <${newUser.email}>`;
      updates.am_assumed = 'false'; // Clear assumed flag
    } else if (fieldType === 'isr') {
      updates.isr = `${newUser.name} <${newUser.email}>`;
      updates.isr_assumed = 'false'; // Clear assumed flag
    } else if (fieldType === 'submittedBy') {
      updates.submittedBy = `${newUser.name} <${newUser.email}>`;
      updates.submitted_by_assumed = 'false'; // Clear assumed flag
    }

    await db.updateSaAssignment(id, updates);

    logger.info('Updated SA assignment with new user', {
      saAssignmentId: id,
      fieldType,
      oldUser: assumedUser,
      newUser: newUser,
      updates
    });

    return NextResponse.json({ success: true, updates });

  } catch (error) {
    logger.error('Error updating SA assignment with new user', { error: error.message });
    return NextResponse.json({ error: 'Failed to update SA assignment' }, { status: 500 });
  }
}