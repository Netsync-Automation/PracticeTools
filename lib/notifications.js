import { getEnvironment, getTableName } from './dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function sendCardReminder(cardData, practiceId, columnId, allUsers, followers, assignedUsers) {
  try {
    const webexBot = await getWebexBot(practiceId);
    if (!webexBot) return false;

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const dueDateTime = new Date(`${cardData.dueDate}T${cardData.dueTime || '23:59'}`);
    const timezone = process.env.DEFAULT_TIMEZONE || 'America/Chicago';
    const formattedTime = cardData.dueTime 
      ? dueDateTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true, 
          timeZone: timezone,
          timeZoneName: 'short'
        })
      : 'End of day';
    
    const notificationPromises = allUsers.map(async (userEmail) => {
      const userType = followers.includes(userEmail) && assignedUsers.includes(userEmail) 
        ? 'following and assigned to' 
        : followers.includes(userEmail) 
          ? 'following' 
          : 'assigned to';

      const adaptiveCard = {
        type: "AdaptiveCard",
        version: "1.3",
        body: [
          {
            type: "Container",
            style: "warning",
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "auto",
                    items: [{ type: "TextBlock", text: "⏰", size: "Large" }]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: "Card Due Date Reminder",
                        size: "Large",
                        weight: "Bolder",
                        color: "Warning"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            type: "Container",
            items: [
              {
                type: "TextBlock",
                text: cardData.title,
                size: "Medium",
                weight: "Bolder",
                wrap: true
              },
              {
                type: "FactSet",
                facts: [
                  { title: "Due Date:", value: dueDateTime.toLocaleDateString() },
                  { title: "Due Time:", value: formattedTime },
                  { title: "Your Role:", value: userType.charAt(0).toUpperCase() + userType.slice(1) }
                ],
                spacing: "Medium"
              }
            ]
          }
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "View Card",
            url: `${baseUrl}/practice-information`,
            style: "positive"
          }
        ]
      };

      const response = await fetch('https://webexapis.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${webexBot.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toPersonEmail: userEmail,
          text: `Card Due Date Reminder: ${cardData.title}`,
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            content: adaptiveCard
          }]
        })
      });

      return response.ok;
    });

    const results = await Promise.all(notificationPromises);
    return results.filter(Boolean).length;
  } catch (error) {
    console.error('Error sending card reminder:', error);
    return 0;
  }
}

export async function sendChecklistReminder(userEmail, cardData, checklistItem) {
  try {
    console.log('📨 [WEBEX] Sending checklist reminder to:', userEmail, 'for item:', checklistItem.text);
    const webexBot = await getWebexBot(cardData.practiceId);
    if (!webexBot) {
      console.log('📨 [WEBEX] No webex bot found for practice:', cardData.practiceId);
      return false;
    }
    console.log('📨 [WEBEX] Found webex bot, sending message...');

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const dueDateTime = new Date(`${checklistItem.dueDate}T${checklistItem.dueTime || '23:59'}`);
    const timezone = process.env.DEFAULT_TIMEZONE || 'America/Chicago';
    const formattedTime = checklistItem.dueTime 
      ? dueDateTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true, 
          timeZone: timezone,
          timeZoneName: 'short'
        })
      : 'End of day';
    
    const adaptiveCard = {
      type: "AdaptiveCard",
      version: "1.3",
      body: [
        {
          type: "Container",
          style: "attention",
          items: [
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [{ type: "TextBlock", text: "⏰", size: "Large" }]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: "Checklist Item Reminder",
                      size: "Large",
                      weight: "Bolder",
                      color: "Attention"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: cardData.title,
              size: "Medium",
              weight: "Bolder",
              wrap: true
            },
            {
              type: "TextBlock",
              text: checklistItem.text,
              wrap: true,
              spacing: "Medium"
            },
            {
              type: "FactSet",
              facts: [
                { title: "Due Date:", value: dueDateTime.toLocaleDateString() },
                { title: "Due Time:", value: formattedTime }
              ],
              spacing: "Medium"
            }
          ]
        }
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "View Card",
          url: `${baseUrl}/practice-information`,
          style: "positive"
        }
      ]
    };

    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${webexBot.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toPersonEmail: userEmail,
        text: `Checklist Item Reminder: ${checklistItem.text}`,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: adaptiveCard
        }]
      })
    });

    console.log('📨 [WEBEX] Message sent, response:', response.status, response.ok);
    return response.ok;
  } catch (error) {
    console.error('Error sending checklist reminder:', error);
    return false;
  }
}

async function getWebexBot(practiceId) {
  const settingsTable = getTableName('Settings');
  const environment = getEnvironment();
  const boardKey = `${environment}_practice_board_${practiceId}`;
  
  const boardCommand = new GetCommand({
    TableName: settingsTable,
    Key: { setting_key: boardKey }
  });
  
  const boardResult = await docClient.send(boardCommand);
  const boardData = boardResult.Item?.setting_value ? JSON.parse(boardResult.Item.setting_value) : null;
  
  let practices = boardData?.practices;
  if (!practices) {
    practices = practiceId.split('-').filter(p => p.length > 0);
  }
  
  if (!practices?.length) return null;

  const settingsQuery = new ScanCommand({
    TableName: settingsTable,
    FilterExpression: 'begins_with(setting_key, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'webex_bot_' }
  });
  
  const settingsResult = await docClient.send(settingsQuery);
  const webexBots = (settingsResult.Items || []).map(item => ({
    key: item.setting_key,
    value: JSON.parse(item.setting_value || '{}')
  }));
  
  for (const bot of webexBots) {
    if (bot.value.practices && bot.value.practices.some(practice => practices.includes(practice))) {
      return bot.value;
    }
  }
  
  return null;
}