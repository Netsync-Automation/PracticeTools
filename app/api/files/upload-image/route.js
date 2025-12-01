import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.S3_BUCKET || 'netsync-practicetools-bucket';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');
    
    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process image with sharp for optimization
    const processedBuffer = await sharp(buffer)
      .resize(1200, 1200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const fileExtension = 'jpg'; // Always convert to jpg for consistency
    const fileName = `images/${uuidv4()}.${fileExtension}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: processedBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });

    await s3Client.send(uploadCommand);

    // Return the image URL
    const imageUrl = `/api/files/${fileName}`;
    
    return NextResponse.json({ 
      imageUrl,
      s3Key: fileName,
      originalName: file.name,
      size: processedBuffer.length
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' }, 
      { status: 500 }
    );
  }
}