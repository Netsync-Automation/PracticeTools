import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET || 'netsync-practicetools-bucket';

export async function uploadRecordingToS3(recordingId, recordingBuffer, filename) {
  const key = `webex-recordings/${recordingId}/${filename}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: recordingBuffer,
    ContentType: 'video/mp4',
    Metadata: {
      recordingId,
      uploadedAt: new Date().toISOString()
    }
  });

  await s3Client.send(command);
  return key;
}

export async function getRecordingDownloadUrl(s3Key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}