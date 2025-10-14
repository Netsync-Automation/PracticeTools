import { NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../../../lib/dynamodb';
import { validateUserSession } from '../../../../../lib/auth-check';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

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
    let iterations = 1;
    let completedIterations = 1;
    
    let formData = null;
    
    if (contentType && contentType.includes('multipart/form-data')) {
      // Handle form data for completion with file upload
      formData = await request.formData();
      action = formData.get('action') || 'toggle';
      certificateFile = formData.get('certificate');
      notes = formData.get('notes') || '';
      completedIterations = parseInt(formData.get('completedIterations')) || 1;
    } else {
      // Handle JSON data for other actions
      const body = await request.json();
      action = body.action || 'toggle';
      iterations = body.iterations || 1;
    }
    
    let result;
    
    if (action === 'complete') {
      let certificateUrl = null;
      let iterationCertificates = [];
      
      if (formData) {
        // Process per-iteration uploads
        for (let i = 0; i < completedIterations; i++) {
          const iterationFile = formData.get(`certificate_${i}`);
          const iterationNotes = formData.get(`iterationNotes_${i}`) || '';
          let iterationCertUrl = null;
          
          if (iterationFile && iterationFile.size > 0) {
            const bucketName = process.env.S3_BUCKET;
            if (!bucketName) {
              return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
            }
            
            try {
              const fileId = uuidv4();
              const fileExtension = iterationFile.name.split('.').pop();
              const fileName = `${fileId}.${fileExtension}`;
              const filePath = `training-certificates/${fileName}`;
              
              const buffer = Buffer.from(await iterationFile.arrayBuffer());
              
              const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: filePath,
                Body: buffer,
                ContentType: iterationFile.type,
                Metadata: {
                  originalName: iterationFile.name,
                  uploadedAt: new Date().toISOString(),
                  uploadedBy: validation.user.email,
                  iteration: (i + 1).toString()
                }
              });
              
              await s3Client.send(command);
              iterationCertUrl = `/api/files/${filePath}`;
            } catch (uploadError) {
              console.error('Certificate upload error:', uploadError);
              return NextResponse.json({ error: 'Failed to upload certificate' }, { status: 500 });
            }
          }
          
          iterationCertificates.push({
            iteration: i + 1,
            certificateUrl: iterationCertUrl,
            notes: iterationNotes
          });
        }
        
        // Fallback for legacy single certificate upload
        if (certificateFile && certificateFile.size > 0 && iterationCertificates.length === 0) {
          const bucketName = process.env.S3_BUCKET;
          if (!bucketName) {
            return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
          }
          
          try {
            const fileId = uuidv4();
            const fileExtension = certificateFile.name.split('.').pop();
            const fileName = `${fileId}.${fileExtension}`;
            const filePath = `training-certificates/${fileName}`;
            
            const buffer = Buffer.from(await certificateFile.arrayBuffer());
            
            const command = new PutObjectCommand({
              Bucket: bucketName,
              Key: filePath,
              Body: buffer,
              ContentType: certificateFile.type,
              Metadata: {
                originalName: certificateFile.name,
                uploadedAt: new Date().toISOString(),
                uploadedBy: validation.user.email
              }
            });
            
            await s3Client.send(command);
            certificateUrl = `/api/files/${filePath}`;
          } catch (uploadError) {
            console.error('Certificate upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload certificate' }, { status: 500 });
          }
        }
      }
      
      result = await db.completeTrainingCertIterations(id, validation.user.email, validation.user.name, completedIterations, certificateUrl, notes, iterationCertificates);
    } else if (action === 'uncomplete') {
      result = await db.uncompleteTrainingCert(id, validation.user.email, validation.user.name);
    } else if (action === 'add' || action === 'remove') {
      result = await db.toggleTrainingCertSignUp(id, validation.user.email, validation.user.name, action, iterations);
    } else {
      // Default toggle behavior
      result = await db.toggleTrainingCertSignUp(id, validation.user.email, validation.user.name, null, iterations);
    }

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        action: result.action,
        signedUp: result.signedUp,
        completed: result.completed,
        iterations: result.iterations,
        completedIterations: result.completedIterations
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