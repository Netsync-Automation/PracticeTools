import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';
import { uploadFileToS3 } from '../../../lib/s3';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const saAssignments = await db.getAllSaAssignments();
    
    return NextResponse.json({
      success: true,
      saAssignments: saAssignments
    });
  } catch (error) {
    console.error('Error fetching SA assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SA assignments' },
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
    
    const formData = await request.formData();
    
    const attachments = [];
    const files = formData.getAll('attachments');
    
    for (const file of files) {
      if (file.size > 0) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const s3Key = await uploadFileToS3(buffer, file.name);
          attachments.push({
            filename: file.name,
            path: s3Key,
            size: file.size
          });
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }
    }
    
    const saAssignmentId = await db.addSaAssignment(
      formData.get('practice'),
      formData.get('status') || 'Active',
      formData.get('opportunityId'),
      formData.get('requestDate'),
      formData.get('eta'),
      formData.get('customerName'),
      formData.get('opportunityName'),
      formData.get('region'),
      formData.get('am'),
      formData.get('saAssigned'),
      formData.get('dateAssigned'),
      formData.get('notes') || '',
      attachments,
      [],
      formData.get('scoopUrl') || '',
      formData.get('isr') || '',
      formData.get('submittedBy') || ''
    );

    if (saAssignmentId) {
      const saAssignment = await db.getSaAssignmentById(saAssignmentId);
      
      return NextResponse.json({
        success: true,
        saAssignment
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to create SA assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating SA assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create SA assignment' },
      { status: 500 }
    );
  }
}