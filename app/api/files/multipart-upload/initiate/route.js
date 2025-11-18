import { NextResponse } from 'next/server';
import { CreateMultipartUploadCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

export async function POST(request) {
  try {
    const { filename, fileType } = await request.json();
    
    const fileId = uuidv4();
    const fileExtension = filename.split('.').pop();
    const s3Key = `practice-board/${fileId}.${fileExtension}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      ContentType: fileType,
      Metadata: {
        originalName: filename,
        uploadedAt: new Date().toISOString()
      }
    });

    const result = await s3Client.send(command);

    return NextResponse.json({
      uploadId: result.UploadId,
      s3Key,
      fileId
    });
  } catch (error) {
    console.error('Multipart initiate error:', error);
    return NextResponse.json({ error: 'Failed to initiate upload' }, { status: 500 });
  }
}
