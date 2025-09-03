import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getEWSClient } from '../../../../lib/ews-client';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const sinceDateTime = since ? new Date(since) : null;

    const ewsClient = getEWSClient();
    const emails = await ewsClient.checkNewMail(sinceDateTime);

    return NextResponse.json({
      success: true,
      emails,
      count: emails.length,
      lastCheck: new Date().toISOString()
    });
  } catch (error) {
    console.error('EWS check mail error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check mail: ' + error.message },
      { status: 500 }
    );
  }
}