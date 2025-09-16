import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';
import { sendSSENotification } from '../../../../lib/sse-notifier.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId');
    const contactType = searchParams.get('contactType');
    
    if (!practiceGroupId || !contactType) {
      return NextResponse.json({ error: 'Practice group ID and contact type are required' }, { status: 400 });
    }

    // Check permissions
    const user = validation.user;
    const canViewDeleted = user.isAdmin || user.role === 'executive' || 
      (['practice_manager', 'practice_principal'].includes(user.role) && 
       user.practices?.some(practice => practiceGroupId?.includes(practice)));
    
    if (!canViewDeleted) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const deletedCompanies = await db.getDeletedCompanies(practiceGroupId, contactType);
    return NextResponse.json({ companies: deletedCompanies });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch deleted companies' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, practiceGroupId, newContactType } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Check permissions
    const user = validation.user;
    const canRestore = user.isAdmin || user.role === 'executive' || 
      (['practice_manager', 'practice_principal'].includes(user.role) && 
       user.practices?.some(practice => practiceGroupId?.includes(practice)));
    
    if (!canRestore) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const success = await db.restoreCompany(id, user, newContactType);

    if (!success) {
      return NextResponse.json({ error: 'Failed to restore company' }, { status: 500 });
    }

    // Send SSE notification for real-time updates
    await sendSSENotification('contact-management', {
      type: 'company-restored',
      data: {
        id,
        practiceGroupId,
        contactType: newContactType || 'original',
        restoredBy: user.name || user.email,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to restore company' }, { status: 500 });
  }
}