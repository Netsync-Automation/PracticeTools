import { NextResponse } from 'next/server';
import { formatDateForWebEx } from '../../../../lib/webex-notifications';

export async function POST(request) {
  try {
    const { cardId, columnId, practiceId, action, user, cardData } = await request.json();
    
    if (!cardId || !practiceId || !action || !user) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get practice-specific Webex bot
    const { getTableName } = await import('../../../../lib/dynamodb');
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, GetCommand, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    
    const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const docClient = DynamoDBDocumentClient.from(client);

    // Get board practices from practiceId
    const boardsTable = getTableName('PracticeBoards');
    const boardCommand = new GetCommand({
      TableName: boardsTable,
      Key: { practiceId }
    });
    
    const boardResult = await docClient.send(boardCommand);
    const board = boardResult.Item;
    
    if (!board?.practices?.length) {
      return NextResponse.json({ success: false, message: 'No practices found for board' });
    }

    // Get Webex bot for the first practice (alphabetically)
    const primaryPractice = board.practices.sort()[0];
    
    // Get all Webex bots from Settings table
    const settingsTable = getTableName('Settings');
    const botQuery = new ScanCommand({
      TableName: settingsTable,
      FilterExpression: 'begins_with(setting_key, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': { S: 'webex_bot_' }
      }
    });
    
    const botResult = await docClient.send(botQuery);
    const allBots = (botResult.Items || []).map(item => JSON.parse(item.setting_value?.S || '{}'));
    const webexBot = allBots.find(bot => bot.practices && bot.practices.includes(primaryPractice));
    
    if (!webexBot?.accessToken) {
      console.log(`No Webex bot found for practice: ${primaryPractice}`);
      return NextResponse.json({ success: false, message: 'No Webex bot configured for practice' });
    }

    // Send notifications to followers
    const followers = cardData.followers || [];
    const notificationPromises = followers
      .filter(email => email !== user.email)
      .map(async (followerEmail) => {
        try {
          const adaptiveCard = createCardNotificationCard(action, cardData, user, practiceId, columnId);
          
          const response = await fetch('https://webexapis.com/v1/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${webexBot.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              toPersonEmail: followerEmail,
              text: `Card "${cardData.title}" was ${action}`,
              attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: adaptiveCard
              }]
            })
          });
          
          return response.ok;
        } catch (error) {
          console.error(`Error sending notification to ${followerEmail}:`, error);
          return false;
        }
      });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(Boolean).length;
    
    return NextResponse.json({ 
      success: true, 
      notificationsSent: successCount,
      totalFollowers: followers.length 
    });
  } catch (error) {
    console.error('Card follow notification error:', error);
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }
}

function createCardNotificationCard(action, cardData, user, practiceId, columnId) {
  let baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  baseUrl = baseUrl.replace(/\/$/, '');
  if (!baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl}`;
  }

  const actionEmoji = {
    'updated': '✏️',
    'commented': '💬',
    'labeled': '🏷️',
    'moved': '📋'
  };

  return {
    type: "AdaptiveCard",
    version: "1.3",
    body: [
      {
        type: "TextBlock",
        text: `${actionEmoji[action] || '📝'} Card ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        size: "Large",
        weight: "Bolder",
        color: "Accent"
      },
      {
        type: "TextBlock",
        text: cardData.title,
        size: "Medium",
        weight: "Bolder",
        wrap: true
      },
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock",
                text: "Updated by:",
                weight: "Bolder",
                size: "Small"
              }
            ]
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: user.name || user.email,
                size: "Small"
              }
            ]
          }
        ]
      },
      {
        type: "TextBlock",
        text: formatDateForWebEx(new Date().toISOString(), process.env.DEFAULT_TIMEZONE),
        size: "Small",
        color: "Default"
      }
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View Card",
        url: `${baseUrl}/practice-information?board=${practiceId}&card=${cardData.id}`
      }
    ]
  };
}