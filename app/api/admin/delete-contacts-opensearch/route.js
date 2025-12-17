import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check.js';
import { deleteContactIndices } from '../../../../lib/opensearch-contacts.js';

export async function DELETE(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteContactIndices();

    return NextResponse.json({ 
      success: true,
      message: 'Contact indices deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact indices:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}
