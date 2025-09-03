import { NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { db } from '../../../../lib/dynamodb';

const ENV = process.env.ENVIRONMENT || 'prod';
const UPVOTES_TABLE = `PracticeTools-${ENV}-Upvotes`;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    console.log('\n=== UPVOTES API CALLED ===');
    const userCookie = request.cookies.get('user-session');
    
    if (!userCookie) {
      console.log('❌ No user session cookie found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = JSON.parse(userCookie.value);
    console.log('👤 User requesting upvotes:', user.email);
    
    // Get all upvotes by the user
    const command = new ScanCommand({
      TableName: UPVOTES_TABLE,
      FilterExpression: 'user_email = :userEmail',
      ExpressionAttributeValues: {
        ':userEmail': { S: user.email }
      }
    });
    
    const result = await db.client.send(command);
    const upvotes = (result.Items || []).map(item => ({
      issue_id: item.issue_id?.S || '',
      user_email: item.user_email?.S || '',
      created_at: item.created_at?.S || ''
    }));
    
    console.log('📊 Upvotes query returned:', upvotes.length, 'upvotes');
    console.log('📋 Upvote details:', JSON.stringify(upvotes, null, 2));
    console.log('✅ Returning upvotes to frontend');
    return NextResponse.json({ upvotes });
  } catch (error) {
    console.error('Error fetching user upvotes:', error);
    return NextResponse.json({ error: 'Failed to fetch upvotes' }, { status: 500 });
  }
}