import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';
import { validateUserSession } from '../../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = params;
    const body = await request.json();
    const { proofFile } = body;
    
    const result = await db.completeTrainingCert(id, validation.user.email, validation.user.name, proofFile);

    if (result.success) {
      return NextResponse.json({ 
        success: true
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to complete training' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error completing training cert:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete training' },
      { status: 500 }
    );
  }
}