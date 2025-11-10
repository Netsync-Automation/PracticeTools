import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const textractClient = new TextractClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settingsTable = getTableName('Settings');
    const settingsResult = await docClient.send(new GetCommand({
      TableName: settingsTable,
      Key: { setting_key: 'webex-meetings' }
    }));

    if (!settingsResult.Item?.setting_value) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const config = JSON.parse(settingsResult.Item.setting_value);
    const userEmail = validation.user.email.toLowerCase();
    
    const isHost = validation.user.isAdmin || config.sites?.some(site => 
      site.recordingHosts?.some(host => host.email.toLowerCase() === userEmail)
    );

    if (!isHost) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileExt = file.name.toLowerCase().split('.').pop();
    const allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'doc', 'docx'];
    
    if (!allowedExts.includes(fileExt)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF, PNG, JPEG, TIFF, or Word documents.' 
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = uuidv4();
    const s3Key = `documentation/${id}/${file.name}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream'
    }));

    const tableName = getTableName('Documentation');
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        id,
        fileName: file.name,
        s3Key,
        uploadedBy: validation.user.email,
        uploadedAt: new Date().toISOString(),
        fileSize: buffer.length,
        contentType: file.type || 'application/octet-stream'
      }
    }));

    // Extract text asynchronously
    extractTextFromDocument(id, s3Key, tableName, fileExt, buffer).catch(err => 
      console.error('Text extraction failed:', err)
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function extractTextFromDocument(id, s3Key, tableName, fileExt, buffer) {
  try {
    let extractedText = '';

    if (fileExt === 'docx' || fileExt === 'doc') {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      const result = await textractClient.send(new DetectDocumentTextCommand({
        Document: {
          S3Object: {
            Bucket: process.env.S3_BUCKET,
            Name: s3Key
          }
        }
      }));

      extractedText = result.Blocks
        ?.filter(block => block.BlockType === 'LINE')
        .map(block => block.Text)
        .join('\n') || '';
    }

    if (extractedText) {
      await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET extractedText = :text, extractionStatus = :status',
        ExpressionAttributeValues: { 
          ':text': extractedText,
          ':status': 'completed'
        }
      }));
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET extractionStatus = :status, extractionError = :error',
      ExpressionAttributeValues: { 
        ':status': 'failed',
        ':error': error.message || 'Text extraction failed'
      }
    })).catch(err => console.error('Failed to update extraction status:', err));
  }
}
