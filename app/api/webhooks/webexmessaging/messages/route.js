import { NextResponse } from 'next/server';
import { getValidAccessToken } from '../../../../../../lib/webex-token-manager.js';
import { getTableName } from '../../../../../../lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { notifyWebexMessagesUpdate } from '../../../../sse/webex-messages/route.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSiteUrlFromRoomId(roomId) {
  const tableName = getTableName('Settings');
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  if (result.Item?.setting_value) {
    const config = JSON.parse(result.Item.setting_value);
    for (const site of config.sites || []) {
      if (site.monitoredRooms?.find(r => r.id === roomId)) {
        return site.siteUrl;
      }
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const messageId = payload.data?.id;
    const roomId = payload.data?.roomId;
    
    if (!messageId || !roomId) {
      return NextResponse.json({ success: true });
    }
    
    const siteUrl = await getSiteUrlFromRoomId(roomId);
    if (!siteUrl) {
      console.log('📨 [WEBEX-MESSAGING] Room not monitored:', roomId);
      return NextResponse.json({ success: true });
    }
    
    const accessToken = await getValidAccessToken(siteUrl);
    
    const messageResponse = await fetch(`https://webexapis.com/v1/messages/${messageId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!messageResponse.ok) {
      throw new Error(`Failed to fetch message: ${messageResponse.status}`);
    }
    
    const message = await messageResponse.json();
    const attachments = [];
    
    if (message.files && message.files.length > 0) {
      for (const fileUrl of message.files) {
        const fileResponse = await fetch(fileUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (fileResponse.ok) {
          const fileBuffer = await fileResponse.arrayBuffer();
          const fileName = fileUrl.split('/').pop() || `file-${uuidv4()}`;
          const s3Key = `webex-messages/${siteUrl}/${roomId}/${messageId}/${fileName}`;
          
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: s3Key,
            Body: Buffer.from(fileBuffer),
            ContentType: fileResponse.headers.get('content-type') || 'application/octet-stream'
          }));
          
          attachments.push({ fileName, s3Key });
        }
      }
    }
    
    const tableName = getTableName('WebexMessages');
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        message_id: messageId,
        room_id: roomId,
        site_url: siteUrl,
        person_email: message.personEmail,
        person_id: message.personId,
        text: message.text || '',
        html: message.html || '',
        created: message.created,
        attachments,
        timestamp: new Date().toISOString()
      }
    }));
    
    notifyWebexMessagesUpdate();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('📨 [WEBEX-MESSAGING] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
