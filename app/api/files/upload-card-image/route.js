import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { getEnvironment } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.S3_BUCKET || 'netsync-practicetools-bucket';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('cardImage');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Process image with Sharp - resize to fit header height while maintaining aspect ratio
    const metadata = await sharp(buffer).metadata();
    const headerHeight = 60;
    const maxWidth = 400;
    
    // Calculate dimensions to fit within header height while maintaining aspect ratio
    let targetWidth = Math.min(maxWidth, Math.round((metadata.width * headerHeight) / metadata.height));
    let targetHeight = headerHeight;
    
    // If image is very wide, limit width and adjust height accordingly
    if (targetWidth === maxWidth) {
      targetHeight = Math.round((metadata.height * maxWidth) / metadata.width);
    }
    
    const processedBuffer = await sharp(buffer)
      .resize(targetWidth, targetHeight, { 
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const fileExtension = 'jpg'; // Always convert to JPG for consistency
    const fileName = `card-images/${uuidv4()}.${fileExtension}`;
    const env = getEnvironment();
    const s3Key = `${env}/${fileName}`;

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: processedBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'max-age=31536000', // 1 year cache
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    return NextResponse.json({
      success: true,
      s3Key,
      originalName: file.name,
      size: processedBuffer.length,
      contentType: 'image/jpeg'
    });

  } catch (error) {
    console.error('Error uploading card image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}