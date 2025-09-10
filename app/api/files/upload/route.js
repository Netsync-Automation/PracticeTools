import { NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('attachments');
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const bucketName = process.env.S3_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
    }

    const uploadedFiles = [];

    for (const file of files) {
      if (file.size === 0) continue;

      const fileId = uuidv4();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${fileId}.${fileExtension}`;
      const filePath = `practice-board/${fileName}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString()
        }
      });

      await s3Client.send(command);

      uploadedFiles.push({
        id: fileId,
        filename: file.name,
        size: file.size,
        type: file.type,
        url: `/api/files/${filePath}`,
        s3Key: filePath,
        created_at: new Date().toISOString()
      });
    }

    return NextResponse.json({ attachments: uploadedFiles });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}