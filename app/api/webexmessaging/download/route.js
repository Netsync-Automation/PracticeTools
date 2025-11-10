import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { validateUserSession } from '../../../../lib/auth-check';

const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const s3Key = searchParams.get('key');

    if (!s3Key) {
      return NextResponse.json({ error: 'Missing S3 key' }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key
    });

    const response = await s3Client.send(command);
    const fileName = s3Key.split('/').pop();
    
    return new NextResponse(response.Body, {
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
