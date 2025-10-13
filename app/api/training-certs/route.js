import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const entries = await db.getAllTrainingCerts();
    console.log('[API-GET-TRAINING-CERTS] Sample entry:', entries[0]);
    console.log('[API-GET-TRAINING-CERTS] updatedBy field:', entries[0]?.updatedBy);
    
    return NextResponse.json({
      success: true,
      entries: entries || []
    });
  } catch (error) {
    console.error('Error fetching training certs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch training certs' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    console.log('[TRAINING-CERTS-CREATE] Request data:', data);
    console.log('[TRAINING-CERTS-CREATE] User:', validation.user.email, validation.user.name);
    
    // DSR: Permission check - only admins, practice managers, and practice principals can add
    const user = validation.user;
    const canAdd = user.isAdmin || user.role === 'practice_manager' || user.role === 'practice_principal';
    
    if (!canAdd) {
      return NextResponse.json({ error: 'Insufficient permissions to add training/certification entries' }, { status: 403 });
    }
    
    // DSR: Practice restriction - non-admins can only add for their practices
    if (!user.isAdmin) {
      const userPractices = user.practices || [];
      if (!userPractices.includes(data.practice)) {
        return NextResponse.json({ error: 'You can only add entries for practices you belong to' }, { status: 403 });
      }
    }
    
    console.log('[TRAINING-CERTS-CREATE] Calling addTrainingCert with createdBy:', validation.user.email);
    const entryId = await db.addTrainingCert(
      data.practice,
      data.type,
      data.vendor,
      data.name,
      data.code,
      data.level,
      data.trainingType,
      data.prerequisites,
      data.examsRequired,
      data.examCost,
      data.quantityNeeded,
      data.incentive,
      data.notes,
      validation.user.email
    );
    
    // Update with user name
    if (entryId) {
      await db.updateTrainingCert(entryId, {
        updated_by_name: validation.user.name
      });
    }
    console.log('[TRAINING-CERTS-CREATE] addTrainingCert returned:', entryId);

    if (entryId) {
      return NextResponse.json({
        success: true,
        entryId
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to create training cert entry' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating training cert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create training cert entry' },
      { status: 500 }
    );
  }
}