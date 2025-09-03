import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getEmailProcessor } from '../../../../lib/email-processor.js';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailProcessor = getEmailProcessor();
    
    // Trigger email processing
    emailProcessor.processResourceEmails();

    return NextResponse.json({ 
      success: true, 
      message: 'Email processing triggered successfully' 
    });

  } catch (error) {
    console.error('Email processing trigger error:', error);
    return NextResponse.json(
      { success: false, error: 'Email processing failed: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailProcessor = getEmailProcessor();
    
    return NextResponse.json({
      success: true,
      isProcessing: emailProcessor.isProcessing,
      lastProcessTime: emailProcessor.lastProcessTime
    });

  } catch (error) {
    console.error('Email processing status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get processing status' },
      { status: 500 }
    );
  }
}