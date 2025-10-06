import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { projectNumber, customerName } = await request.json();
    
    if (!projectNumber || !customerName) {
      return NextResponse.json(
        { error: 'Project number and customer name are required' },
        { status: 400 }
      );
    }
    
    const duplicates = await db.checkResourceAssignmentDuplicate(projectNumber, customerName);
    
    return NextResponse.json({
      success: true,
      isDuplicate: duplicates.length > 0,
      duplicates: duplicates.map(d => ({
        id: d.id,
        assignment_number: d.assignment_number,
        status: d.status,
        created_at: d.created_at
      }))
    });
  } catch (error) {
    console.error('Error checking assignment duplicates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check duplicates' },
      { status: 500 }
    );
  }
}