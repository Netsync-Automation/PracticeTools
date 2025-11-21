import { NextResponse } from 'next/server';
import { UploadPartCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

export async function POST(request) {
  try {
    const { s3Key, uploadId, partNumber } = await request.json();

    const command = new UploadPartCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      UploadId: uploadId,
      PartNumber: partNumber
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error('Presign error:', error);
    return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 });
  }
}
