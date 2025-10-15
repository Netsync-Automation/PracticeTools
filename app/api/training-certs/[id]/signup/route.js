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
    let jsonBody = null;
    
    if (contentType && contentType.includes('multipart/form-data')) {
      // Handle form data for completion with file upload
      formData = await request.formData();
      action = formData.get('action') || 'toggle';
      certificateFile = formData.get('certificate');
      notes = formData.get('notes') || '';
      completedIterations = parseInt(formData.get('completedIterations')) || 1;
    } else {
      // Handle JSON data for other actions
      jsonBody = await request.json();
      action = jsonBody.action || 'toggle';
      iterations = jsonBody.iterations || 1;
    }
    
    let result;
    
    if (action === 'editIteration') {
      // Handle editing an existing completed iteration
      const iterationNumber = parseInt(formData.get('iteration'));
      let certificateUrl = null;
      
      if (certificateFile && certificateFile.size > 0) {
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
              uploadedBy: validation.user.email,
              iteration: iterationNumber.toString()
            }
          });
          
          await s3Client.send(command);
          certificateUrl = `/api/files/${filePath}`;
        } catch (uploadError) {
          console.error('Certificate upload error:', uploadError);
          return NextResponse.json({ error: 'Failed to upload certificate' }, { status: 500 });
        }
      }
      
      result = await db.editTrainingCertIteration(id, validation.user.email, iterationNumber, certificateUrl, notes);
    } else if (action === 'complete') {
      let certificateUrl = null;
      let iterationCertificates = [];
      
      if (formData) {
        // Get current user signup to determine already completed iterations
        const trainingCert = await db.getTrainingCertById(id);
        const userSignup = trainingCert?.signUps?.find(signup => signup.email === validation.user.email);
        const currentCompleted = userSignup?.completedIterations || 0;
        
        // Process per-iteration uploads
        for (let i = 0; i < completedIterations; i++) {
          const iterationFile = formData.get(`certificate_${i}`);
          const iterationNotes = formData.get(`iterationNotes_${i}`) || '';
          let iterationCertUrl = null;
          const actualIterationNumber = currentCompleted + i + 1;
          
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
                  iteration: actualIterationNumber.toString()
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
            iteration: actualIterationNumber,
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
    } else if (action === 'editSignup') {
      let body;
      if (contentType && contentType.includes('multipart/form-data')) {
        // Already parsed formData above
        body = {
          iterations: parseInt(formData.get('iterations')) || 1,
          force: formData.get('force') === 'true'
        };
      } else {
        // Use the already parsed JSON body
        body = jsonBody;
      }
      
      const newIterations = body.iterations || 1;
      const force = body.force || false;
      
      if (force) {
        result = await db.editTrainingCertSignupIterationsForce(id, validation.user.email, newIterations);
      } else {
        result = await db.editTrainingCertSignupIterations(id, validation.user.email, newIterations);
      }
      
      if (!result.success && result.error === 'ITERATIONS_CONFLICT') {
        return NextResponse.json({
          success: false,
          error: 'ITERATIONS_CONFLICT',
          completedIterations: result.completedIterations,
          newIterations: result.newIterations,
          affectedIterations: result.affectedIterations
        });
      }
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