import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

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

    let fileName, fileType, expirationDate;
    
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const body = await request.json();
      fileName = body.fileName;
      fileType = body.fileType;
      expirationDate = body.expirationDate;
    } else {
      // Handle FormData from file upload
      const formData = await request.formData();
      const file = formData.get('file');
      if (file) {
        fileName = file.name;
        fileType = file.type;
        expirationDate = formData.get('expirationDate');
      }
    }
    
    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }

    const fileExt = fileName.toLowerCase().split('.').pop();
    const allowedExts = [
      // Documents
      'pdf', 'doc', 'docx', 'rtf', 'odt',
      // Spreadsheets  
      'xls', 'xlsx', 'csv', 'ods',
      // Presentations
      'ppt', 'pptx', 'odp',
      // Text
      'txt', 'md', 'xml', 'html', 'htm',
      // Images
      'png', 'jpg', 'jpeg', 'tiff', 'tif', 'gif', 'bmp',
      // Archives
      'zip', 'tar', 'gz',
      // Email
      'msg', 'eml'
    ];
    
    if (!allowedExts.includes(fileExt)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Supported formats: PDF, Word, Excel, PowerPoint, images, text files, and more.' 
      }, { status: 400 });
    }

    const id = uuidv4();
    const s3Key = `documentation/${id}/${fileName}`;

    // Generate presigned URL for direct upload
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      ContentType: fileType,
      Metadata: {
        originalName: fileName,
        uploadedBy: validation.user.email,
        uploadedAt: new Date().toISOString(),
        ...(expirationDate && { expirationDate })
      }
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    const documentItem = {
      id,
      fileName,
      s3Key,
      uploadedBy: validation.user.email,
      uploadedAt: new Date().toISOString(),
      contentType: fileType,
      extractionStatus: 'pending'
    };
    
    if (expirationDate) {
      documentItem.expirationDate = expirationDate;
    }

    const tableName = getTableName('Documentation');
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: documentItem
    }));

    return NextResponse.json({ 
      success: true, 
      id,
      uploadUrl: presignedUrl,
      s3Key
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Document processing is now handled by S3 event triggers to Lambda
// The Lambda function will process documents using Textract and store chunks in DynamoDB
