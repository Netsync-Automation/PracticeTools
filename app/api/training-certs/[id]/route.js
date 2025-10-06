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
    
    const success = await db.updateTrainingCert(
      id,
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
      data.notes,
      validation.user.email
    );

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update training cert entry' },
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