import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const db = DynamoDBDocumentClient.from(client);

async function checkFollowStatus() {
  try {
    // Check Settings table for practice boards using the correct format
    const settings = await db.send(new ScanCommand({
      TableName: 'PracticeTools-dev-Settings'
    }));
    
    console.log('Found settings:', settings.Items?.length || 0);
    
    // Look for practice board settings with dev_practice_board_ prefix
    let targetBoard = null;
    let targetBoardKey = null;
    let targetTopic = null;
    
    for (const item of settings.Items || []) {
      const key = item.setting_key || '';
      const value = item.setting_value || '';
      
      // Check if this is a practice board setting
      if (key.startsWith('dev_practice_board_')) {
        console.log('\nFound practice board key:', key);
        
        try {
          const boardData = JSON.parse(value);
          
          // Check if this is board metadata or actual board data with columns
          if (boardData.columns) {
            console.log('Found board data with columns for key:', key);
            
            // Look for the specific card in columns
            for (const [columnId, column] of Object.entries(boardData.columns)) {
              if (column.cards) {
                for (const card of column.cards) {
                  if (card.title === 'Fort Worth Singlewire') {
                    targetBoard = boardData;
                    targetBoardKey = key;
                    // Extract topic from key if it exists (format: dev_practice_board_practiceId_topic)
                    const keyParts = key.replace('dev_practice_board_', '').split('_');
                    if (keyParts.length > 1) {
                      targetTopic = keyParts.slice(1).join('_');
                    } else {
                      targetTopic = 'Main Topic';
                    }
                    console.log('Found Fort Worth Singlewire card in board:', key, 'topic:', targetTopic);
                    break;
                  }
                }
              }
              if (targetBoard) break;
            }
          } else if (boardData.practices) {
            console.log('Found board metadata for practices:', boardData.practices);
          }
        } catch (e) {
          console.log('Error parsing board data for key:', key, e.message);
        }
      }
      
      if (targetBoard) break;
    }
    
    if (!targetBoard) {
      console.log('Fort Worth Singlewire card not found.');
      console.log('\nAll settings keys:');
      
      for (const item of settings.Items || []) {
        const key = item.setting_key || '';
        console.log(`- ${key}`);
      }
      
      console.log('\nLooking for any board-related keys:');
      for (const item of settings.Items || []) {
        const key = item.setting_key || '';
        const value = item.setting_value || '';
        if (key.includes('board') || key.includes('practice') || value.includes('Fort Worth') || value.includes('Singlewire')) {
          console.log(`- ${key}: ${value.substring(0, 100)}...`);
        }
      }
      return;
    }
    
    console.log('Found practice board in key:', targetBoardKey);
    console.log('Topic:', targetTopic);
    
    // Extract practice ID from the board key
    const practiceId = targetBoardKey.replace('dev_practice_board_', '').split('_')[0];
    
    // Find the card in the board (already found above, but get details)
    let targetCard = null;
    let targetColumnId = null;
    
    for (const [columnId, column] of Object.entries(targetBoard.columns)) {
      const card = column.cards?.find(card => card.title === 'Fort Worth Singlewire');
      if (card) {
        targetCard = card;
        targetColumnId = columnId;
        break;
      }
    }
    
    console.log('Found card:', targetCard.id, 'in column:', targetColumnId);
    
    // Check followers table using the correct card key format
    const cardKey = `${practiceId}_${targetColumnId}_${targetCard.id}`;
    console.log('Checking followers for card key:', cardKey);
    
    const followers = await db.send(new QueryCommand({
      TableName: 'PracticeTools-dev-Followers',
      KeyConditionExpression: 'issue_id = :issueId',
      ExpressionAttributeValues: {
        ':issueId': cardKey
      }
    }));
    
    console.log('Followers found:', followers.Items?.length || 0);
    
    const mbgriffinFollowing = followers.Items?.find(f => f.user_email === 'mbgriffin@netsync.com');
    
    if (mbgriffinFollowing) {
      console.log('✅ mbgriffin@netsync.com IS following this card');
      console.log('Follow details:', mbgriffinFollowing);
    } else {
      console.log('❌ mbgriffin@netsync.com is NOT following this card');
    }
    
    console.log('All followers:', followers.Items);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFollowStatus();