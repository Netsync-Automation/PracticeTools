import { NextResponse } from 'next/server';
import { CompleteMultipartUploadCommand, S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

export async function POST(request) {
  try {
    const { s3Key, uploadId, parts, filename, fileSize, fileType, fileId } = await request.json();

    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });

    await s3Client.send(command);

    return NextResponse.json({
      attachments: [{
        id: fileId,
        filename,
        size: fileSize,
        type: fileType,
        s3Key,
        created_at: new Date().toISOString()
      }]
    });
  } catch (error) {
    console.error('Complete multipart error:', error);
    return NextResponse.json({ error: 'Failed to complete upload' }, { status: 500 });
  }
}
