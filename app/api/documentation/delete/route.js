import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

export async function DELETE(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const tableName = getTableName('Documentation');
    const docResult = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { id }
    }));

    if (!docResult.Item) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const isOwner = docResult.Item.uploadedBy === validation.user.email;
    const isAdmin = validation.user.isAdmin;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to delete this document' }, { status: 403 });
    }

    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: docResult.Item.s3Key
    }));

    await docClient.send(new DeleteCommand({
      TableName: tableName,
      Key: { id }
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
