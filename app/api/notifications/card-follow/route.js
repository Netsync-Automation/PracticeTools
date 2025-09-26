import { NextResponse } from 'next/server';
import { formatDateForWebEx } from '../../../../lib/webex-notifications';

// Helper function to resolve label names from IDs
async function resolveLabelNames(labelIds, practiceId) {
  if (!Array.isArray(labelIds) || labelIds.length === 0) return [];
  
  try {
    const { DynamoDBDocumentClient, GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { getTableName } = await import('../../../../lib/dynamodb');
    
    const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const docClient = DynamoDBDocumentClient.from(client);
    
    const tableName = getTableName('PracticeBoardLabels');
    const command = new GetCommand({
      TableName: tableName,
      Key: { practiceId }
    });
    
    const result = await docClient.send(command);
    const labels = result.Item?.labels || [];
    
    return labelIds.map(id => {
      const label = labels.find(l => l.id === id);
      return label ? label.name : id;
    });
  } catch (error) {
    console.error('Error resolving label names:', error);
    return labelIds; // Fallback to IDs
  }
}

export async function POST(request) {
  try {
    const { cardId, columnId, practiceId, topic, action, user, cardData, changes } = await request.json();
    
    // Resolve label names for changes if needed
    let resolvedChanges = changes;
    if (changes && changes.labels) {
      const fromLabels = await resolveLabelNames(changes.labels.from, practiceId);
      const toLabels = await resolveLabelNames(changes.labels.to, practiceId);
      resolvedChanges = {
        ...changes,
        labels: {
          from: fromLabels,
          to: toLabels
        }
      };
    }
    
    console.log('🔔 [WEBEX NOTIFICATION] Received notification request:', {
      cardId,
      columnId,
      practiceId,
      topic,
      action,
      userEmail: user?.email,
      cardTitle: cardData?.title,
      followers: cardData?.followers,
      followersCount: cardData?.followers?.length || 0
    });
    
    if (!cardId || !practiceId || !action || !user) {
      console.log('🔔 [WEBEX NOTIFICATION] Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch the latest followers from the dedicated followers table using new API approach
    const { db, getEnvironment } = await import('../../../../lib/dynamodb');
    const environment = getEnvironment();
    
    // Get latest followers from dedicated followers table
    const cardKey = `${practiceId}_${columnId}_${cardId}`;
    console.log('🔔 [WEBEX NOTIFICATION] Fetching followers for card key:', cardKey);
    
    let latestFollowers = [];
    try {
      latestFollowers = await db.getCardFollowers(cardKey);
      console.log('🔔 [WEBEX NOTIFICATION] Latest followers from database:', latestFollowers);
    } catch (dbError) {
      console.log('🔔 [WEBEX NOTIFICATION] Database error fetching followers:', dbError.message);
      // Fallback to followers from cardData if database unavailable
      latestFollowers = cardData.followers || [];
    }
    
    // Fetch board data to get practices for Webex bot configuration
    const boardKey = topic === 'Main Topic' 
      ? `${environment}_practice_board_${practiceId}` 
      : `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    console.log('🔔 [WEBEX NOTIFICATION] Fetching board practices with key:', boardKey);
    
    let boardData;
    try {
      const boardDataString = await db.getSetting(boardKey);
      boardData = boardDataString ? JSON.parse(boardDataString) : null;
    } catch (dbError) {
      console.log('🔔 [WEBEX NOTIFICATION] Database error fetching board:', dbError.message);
      const filteredFollowers = latestFollowers.filter(email => email !== user.email);
      
      if (filteredFollowers.length === 0) {
        return NextResponse.json({ success: true, notificationsSent: 0, totalFollowers: 0, message: 'No followers to notify' });
      }
      
      return NextResponse.json({ success: true, notificationsSent: 0, totalFollowers: latestFollowers.length, message: 'Database unavailable, skipped notifications' });
    }
    
    console.log('🔔 [WEBEX NOTIFICATION] Board fetch result:', {
      found: !!boardData,
      practices: boardData?.practices,
      followersFromDatabase: latestFollowers.length,
      followersFromCardData: cardData.followers?.length || 0
    });
    
    if (!boardData) {
      console.log('🔔 [WEBEX NOTIFICATION] Board not found:', practiceId);
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    if (!boardData?.practices?.length) {
      console.log('🔔 [WEBEX NOTIFICATION] No practices found for board:', practiceId);
      return NextResponse.json({ success: false, message: 'No practices found for board' });
    }
    
    console.log('🔔 [WEBEX NOTIFICATION] Board practices:', boardData.practices);

    // Get Webex bot for board practices from admin settings
    const webexBots = await db.getWebexBots();
    
    // Find bot that matches any of the board's practices
    let webexBot = null;
    for (const bot of webexBots) {
      if (bot.practices && bot.practices.some(practice => boardData.practices.includes(practice))) {
        webexBot = bot;
        break;
      }
    }
    
    if (!webexBot?.accessToken) {
      console.log(`🔔 [WEBEX NOTIFICATION] No Webex bot found for practices: ${boardData.practices.join(', ')}`);
      console.log('🔔 [WEBEX NOTIFICATION] Available bots:', webexBots.map(bot => ({ practices: bot.practices })));
      return NextResponse.json({ success: false, message: 'No Webex bot configured for board practices' });
    }
    
    console.log('🔔 [WEBEX NOTIFICATION] Found Webex bot for practices:', webexBot.practices);

    // Send notifications to followers using latest followers from database
    const filteredFollowers = latestFollowers.filter(email => email !== user.email);
    
    console.log('🔔 [WEBEX NOTIFICATION] Notification targets:', {
      allFollowers: latestFollowers,
      filteredFollowers,
      currentUser: user.email,
      usingDatabaseFollowers: true
    });
    
    const notificationPromises = filteredFollowers.map(async (followerEmail) => {
        try {
          console.log(`🔔 [WEBEX NOTIFICATION] Sending to ${followerEmail}...`);
          const adaptiveCard = createCardNotificationCard(action, cardData, user, practiceId, columnId, resolvedChanges);
          
          const webexPayload = {
            toPersonEmail: followerEmail,
            text: `Card "${cardData.title}" was ${action}`,
            attachments: [{
              contentType: "application/vnd.microsoft.card.adaptive",
              content: adaptiveCard
            }]
          };
          
          console.log(`🔔 [WEBEX NOTIFICATION] Webex API payload:`, JSON.stringify(webexPayload, null, 2));
          
          const response = await fetch('https://webexapis.com/v1/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${webexBot.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webexPayload)
          });
          
          const responseText = await response.text();
          console.log(`🔔 [WEBEX NOTIFICATION] Webex API response for ${followerEmail}:`, {
            status: response.status,
            ok: response.ok,
            response: responseText
          });
          
          return response.ok;
        } catch (error) {
          console.error(`🔔 [WEBEX NOTIFICATION] Error sending notification to ${followerEmail}:`, error);
          return false;
        }
      });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(Boolean).length;
    
    return NextResponse.json({ 
      success: true, 
      notificationsSent: successCount,
      totalFollowers: latestFollowers.length 
    });
  } catch (error) {
    console.error('🔔 [WEBEX NOTIFICATION] Card follow notification error:', error);
    console.error('🔔 [WEBEX NOTIFICATION] Error stack:', error.stack);
    return NextResponse.json({ error: 'Failed to send notifications', details: error.message }, { status: 500 });
  }
}

function createCardNotificationCard(action, cardData, user, practiceId, columnId, changes) {
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

  // Build change details
  const changeDetails = [];
  if (changes && Object.keys(changes).length > 0) {
    Object.entries(changes).forEach(([field, change]) => {
      if (field === 'comment') {
        // Special handling for comments
        const commentText = change.to ? (change.to.length > 100 ? change.to.substring(0, 100) + '...' : change.to) : 'Added attachment(s)';
        changeDetails.push(`**New Comment:** "${commentText}"`);
      } else if (field === 'title' && change.from !== change.to) {
        changeDetails.push(`**Title:** "${change.from}" → "${change.to}"`);
      } else if (field === 'description' && change.from !== change.to) {
        const fromText = change.from ? (change.from.length > 50 ? change.from.substring(0, 50) + '...' : change.from) : '(empty)';
        const toText = change.to ? (change.to.length > 50 ? change.to.substring(0, 50) + '...' : change.to) : '(empty)';
        changeDetails.push(`**Description:** "${fromText}" → "${toText}"`);
      } else if (field === 'labels' && JSON.stringify(change.from) !== JSON.stringify(change.to)) {
        const fromLabels = Array.isArray(change.from) ? change.from.join(', ') : 'None';
        const toLabels = Array.isArray(change.to) ? change.to.join(', ') : 'None';
        changeDetails.push(`**Labels:** ${fromLabels} → ${toLabels}`);
      } else if (field === 'assignedTo' && JSON.stringify(change.from) !== JSON.stringify(change.to)) {
        const fromUsers = Array.isArray(change.from) ? change.from.join(', ') : 'None';
        const toUsers = Array.isArray(change.to) ? change.to.join(', ') : 'None';
        changeDetails.push(`**Assigned:** ${fromUsers} → ${toUsers}`);
      } else if (field === 'dueDate' && change.from !== change.to) {
        const fromDate = change.from ? new Date(change.from).toLocaleDateString() : 'None';
        const toDate = change.to ? new Date(change.to).toLocaleDateString() : 'None';
        changeDetails.push(`**Due Date:** ${fromDate} → ${toDate}`);
      } else if (field === 'startDate' && change.from !== change.to) {
        const fromDate = change.from ? new Date(change.from).toLocaleDateString() : 'None';
        const toDate = change.to ? new Date(change.to).toLocaleDateString() : 'None';
        changeDetails.push(`**Start Date:** ${fromDate} → ${toDate}`);
      } else if (field === 'checklists') {
        changeDetails.push(`**Checklist:** Updated checklist items`);
      } else if (field === 'projectUrl') {
        const fromUrl = change.from ? 'Project linked' : 'No project';
        const toUrl = change.to ? 'Project linked' : 'No project';
        changeDetails.push(`**Project Link:** ${fromUrl} → ${toUrl}`);
      }
    });
  }

  const cardBody = [
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
    }
  ];

  // Add change details if available
  if (changeDetails.length > 0) {
    if (action === 'commented') {
      // For comments, show the comment content directly
      changeDetails.forEach(detail => {
        cardBody.push({
          type: "TextBlock",
          text: detail,
          size: "Small",
          wrap: true,
          spacing: "Medium",
          color: "Good"
        });
      });
    } else {
      // For other updates, show changes section
      cardBody.push({
        type: "TextBlock",
        text: "**Changes Made:**",
        weight: "Bolder",
        size: "Small",
        spacing: "Medium"
      });
      
      changeDetails.forEach(detail => {
        cardBody.push({
          type: "TextBlock",
          text: detail,
          size: "Small",
          wrap: true,
          spacing: "Small"
        });
      });
    }
  }

  cardBody.push(
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
      ],
      spacing: "Medium"
    },
    {
      type: "TextBlock",
      text: formatDateForWebEx(new Date().toISOString(), process.env.DEFAULT_TIMEZONE),
      size: "Small",
      color: "Default"
    }
  );

  return {
    type: "AdaptiveCard",
    version: "1.3",
    body: cardBody,
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View Card",
        url: `${baseUrl}/practice-information?board=${practiceId}&card=${cardData.id}`
      }
    ]
  };
}