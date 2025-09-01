import { NextResponse } from 'next/server';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

export async function GET(request, { params }) {
  try {
    const path = params.path.join('/');
    const bucketName = process.env.S3_BUCKET;
    
    if (!bucketName) {
      return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
    }

    // Generate presigned URL for the file
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: path
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Redirect to the presigned URL
    return NextResponse.redirect(signedUrl);
    
  } catch (error) {
    console.error('File access error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}