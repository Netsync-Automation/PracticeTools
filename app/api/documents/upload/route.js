import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET || 'netsync-practicetools-bucket';

export async function POST(request) {
  try {
    const { fileName, fileType, tenantId = 'default' } = await request.json();
    
    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }
    
    // Generate unique key with tenant prefix
    const fileId = uuidv4();
    const fileExtension = fileName.split('.').pop();
    const s3Key = `${tenantId}/documents/${fileId}.${fileExtension}`;
    
    // Generate presigned URL for direct upload
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
      Metadata: {
        originalName: fileName,
        tenantId,
        uploadedAt: new Date().toISOString()
      }
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    return NextResponse.json({
      uploadUrl: presignedUrl,
      s3Key,
      fileId,
      message: 'Upload URL generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}