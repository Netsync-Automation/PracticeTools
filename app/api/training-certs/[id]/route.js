import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = params;
    const data = await request.json();
    
    // DSR: Permission check - only admins, practice managers, and practice principals can edit
    const user = validation.user;
    const canEdit = user.isAdmin || user.role === 'practice_manager' || user.role === 'practice_principal';
    
    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions to edit training/certification entries' }, { status: 403 });
    }
    
    // DSR: Practice restriction - non-admins can only edit entries for their practices
    if (!user.isAdmin) {
      // Get the existing entry to check practice ownership
      const existingEntry = await db.getTrainingCertById(id);
      if (!existingEntry) {
        return NextResponse.json({ error: 'Training/certification entry not found' }, { status: 404 });
      }
      
      const userPractices = user.practices || [];
      if (!userPractices.includes(existingEntry.practice)) {
        return NextResponse.json({ error: 'You can only edit entries for practices you belong to' }, { status: 403 });
      }
      
      // Also check if they're trying to change practice to one they don't belong to
      if (data.practice && !userPractices.includes(data.practice)) {
        return NextResponse.json({ error: 'You cannot change the practice to one you do not belong to' }, { status: 403 });
      }
    }
    
    const updateData = {
      practice: data.practice,
      type: data.type,
      vendor: data.vendor,
      name: data.name,
      code: data.code,
      level: data.level,
      trainingType: data.trainingType,
      prerequisites: data.prerequisites,
      examsRequired: data.examsRequired,
      examCost: data.examCost,
      quantityNeeded: data.quantityNeeded,
      incentive: data.incentive,
      notes: data.notes,
      updated_by: validation.user.email,
      updated_by_name: validation.user.name
    };
    console.log('[TRAINING-CERTS-UPDATE] Update data with lastEditedBy:', updateData);
    
    let result;
    try {
      result = await db.updateTrainingCert(id, updateData);
    } catch (dbError) {
      console.error('Database error caught in API:', dbError);
      throw dbError;
    }

    if (result.success) {
      return NextResponse.json({ 
        success: true,
        warning: result.warning,
        affectedSignups: result.affectedSignups,
        cleanupPerformed: result.cleanupPerformed
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update training cert entry' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating training cert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update training cert entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = params;
    
    // DSR: Permission check - only admins, practice managers, and practice principals can delete
    const user = validation.user;
    const canDelete = user.isAdmin || user.role === 'practice_manager' || user.role === 'practice_principal';
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions to delete training/certification entries' }, { status: 403 });
    }
    
    // DSR: Practice restriction - non-admins can only delete entries for their practices
    if (!user.isAdmin) {
      // Get the existing entry to check practice ownership
      const existingEntry = await db.getTrainingCertById(id);
      if (!existingEntry) {
        return NextResponse.json({ error: 'Training/certification entry not found' }, { status: 404 });
      }
      
      const userPractices = user.practices || [];
      if (!userPractices.includes(existingEntry.practice)) {
        return NextResponse.json({ error: 'You can only delete entries for practices you belong to' }, { status: 403 });
      }
    }
    
    const success = await db.deleteTrainingCert(id);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to delete training cert entry' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting training cert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete training cert entry' },
      { status: 500 }
    );
  }
}