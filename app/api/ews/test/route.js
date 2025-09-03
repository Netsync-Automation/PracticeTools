import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getEWSClient } from '../../../../lib/ews-client';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ewsClient = getEWSClient();
    const result = await ewsClient.testConnection();

    return NextResponse.json(result);
  } catch (error) {
    console.error('EWS test error:', error);
    return NextResponse.json(
      { success: false, error: 'EWS test failed: ' + error.message },
      { status: 500 }
    );
  }
}