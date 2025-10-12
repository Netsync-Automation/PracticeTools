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
    const contentType = request.headers.get('content-type');
    let action = 'toggle';
    let certificateFile = null;
    let notes = '';
    
    if (contentType && contentType.includes('multipart/form-data')) {
      // Handle form data for completion with file upload
      const formData = await request.formData();
      action = formData.get('action') || 'toggle';
      certificateFile = formData.get('certificate');
      notes = formData.get('notes') || '';
    } else {
      // Handle JSON data for other actions
      const body = await request.json();
      action = body.action || 'toggle';
    }
    
    let result;
    
    if (action === 'complete') {
      result = await db.completeTrainingCert(id, validation.user.email, validation.user.name, certificateFile, notes);
    } else if (action === 'uncomplete') {
      result = await db.uncompleteTrainingCert(id, validation.user.email, validation.user.name);
    } else if (action === 'add' || action === 'remove') {
      result = await db.toggleTrainingCertSignUp(id, validation.user.email, validation.user.name, action);
    } else {
      // Default toggle behavior
      result = await db.toggleTrainingCertSignUp(id, validation.user.email, validation.user.name);
    }

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        action: result.action,
        signedUp: result.signedUp,
        completed: result.completed
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update training status' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating training cert status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update training status' },
      { status: 500 }
    );
  }
}