import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

const BUCKET = process.env.S3_BUCKET || 'netsync-practicetools-bucket';

export async function uploadFileToS3(fileBuffer, filename) {
  const key = `attachments/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  
  console.log('Uploading to S3:', { bucket: BUCKET, key, size: fileBuffer.length });
  
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: 'application/octet-stream'
  });
  
  try {
    const result = await s3Client.send(command);
    console.log('S3 upload successful:', { key, etag: result.ETag });
    return key;
  } catch (error) {
    console.error('S3 upload error:', {
      error: error.message,
      bucket: BUCKET,
      key,
      region: process.env.AWS_DEFAULT_REGION
    });
    throw new Error(`Failed to upload ${filename}: ${error.message}`);
  }
}

export async function generatePresignedUrl(key, filename) {
  console.log('Generating presigned URL for:', { key, filename, bucket: BUCKET });
  
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`
  });
  
  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    console.log('Successfully generated presigned URL for:', key);
    return url;
  } catch (error) {
    console.error('S3 presigned URL error:', {
      error: error.message,
      key,
      filename,
      bucket: BUCKET
    });
    return null;
  }
}