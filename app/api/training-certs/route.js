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
      data.notes,
      validation.user.email
    );

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