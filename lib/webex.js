import { formatDateForWebEx } from './webex-notifications.js';

// Import db once at the top level
const { db } = await import('./dynamodb.js');

async function createAdaptiveCard(issue, action) {
  // Get issue types from database for dynamic icon mapping
  let getTypeIcon;
  try {
    const issueTypes = await db.getIssueTypes();
    getTypeIcon = (type) => {
      const issueType = issueTypes.find(it => it.name === type);
      return issueType ? issueType.icon : '📝';
    };
  } catch (error) {
    console.log('Could not load issue types, using fallback icons:', error.message);
    getTypeIcon = (type) => {
      switch (type) {
        case 'Leadership Question': return '👔';
        case 'General Question': return '❓';
        case 'Feature Request': return '✨';
        case 'Practice Question': return '🏢';
        case 'Process Question': return '📋';
        case 'Technical Question': return '🔧';
        case 'Event Question': return '🎉';
        default: return '📝';
      }
    };
  }

  return {
    type: "AdaptiveCard",
    version: "1.3",
    body: [
      {
        type: "Container",
        style: action === 'created' ? 'attention' : (action === 'updated' && issue.status === 'Closed') ? 'good' : 'warning',
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                items: [
                  {
                    type: "TextBlock",
                    text: action === 'created' ? '🆕' : (action === 'updated' && issue.status === 'Closed') ? '✅' : '🔄',
                    size: "Large"
                  }
                ]
              },
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    text: action === 'created' ? 'Issue CREATED' : (action === 'updated' && issue.status === 'Closed') ? 'Issue COMPLETED!' : 'Issue UPDATED',
                    weight: "Bolder",
                    size: "Large",
                    color: "Light"
                  },
                  {
                    type: "TextBlock",
                    text: `Issue #${issue.issue_number}`,
                    size: "Small",
                    color: "Light",
                    isSubtle: true
                  }
                ]
              }
            ]
          }
        ],
        spacing: "None"
      },
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: issue.title,
            weight: "Bolder",
            size: "Large",
            wrap: true,
            color: "Dark"
          },
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "FactSet",
                    facts: [
                      ...(issue.system ? [{
                        title: "System",
                        value: issue.system
                      }] : []),
                      {
                        title: "Practice",
                        value: issue.practice
                      },
                      {
                        title: "Type",
                        value: `${getTypeIcon(issue.issue_type)} ${issue.issue_type}`
                      },
                      {
                        title: "Status",
                        value: issue.status
                      },
                      {
                        title: "Submitted by",
                        value: issue.submittedByName || issue.email
                      },
                      {
                        title: "Created",
                        value: formatDateForWebEx(issue.created_at, process.env.DEFAULT_TIMEZONE)
                      },
                      ...(issue.assigned_to ? [
                        {
                          title: "Assigned to",
                          value: issue.assigned_to
                        }
                      ] : []),
                      ...(issue.updated_at && issue.updated_at !== issue.created_at ? [
                        {
                          title: "Last Updated",
                          value: formatDateForWebEx(issue.updated_at, process.env.DEFAULT_TIMEZONE)
                        }
                      ] : []),
                      ...(action === 'updated' && issue.status_changed_by ? [
                        {
                          title: "Status Changed by",
                          value: issue.status_changed_by
                        },
                        {
                          title: "Status Changed",
                          value: formatDateForWebEx(new Date().toISOString(), process.env.DEFAULT_TIMEZONE)
                        }
                      ] : [])
                    ]
                  }
                ]
              },
              {
                type: "Column",
                width: "auto",
                items: [
                  {
                    type: "Container",
                    style: "emphasis",
                    items: [
                      {
                        type: "TextBlock",
                        text: `👍 ${issue.upvotes || 0}`,
                        horizontalAlignment: "Center",
                        weight: "Bolder",
                        size: "Medium"
                      },
                      {
                        type: "TextBlock",
                        text: "upvotes",
                        horizontalAlignment: "Center",
                        size: "Small",
                        isSubtle: true
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        spacing: "Medium"
      },
      ...(action === 'updated' && issue.previous_status ? [
        {
          type: "Container",
          style: "good",
          items: [
            {
              type: "TextBlock",
              text: "Status Change",
              weight: "Bolder",
              size: "Small",
              color: "Light"
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
                      text: issue.previous_status,
                      weight: "Bolder",
                      color: "Light"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "TextBlock",
                      text: "→",
                      weight: "Bolder",
                      size: "Large",
                      color: "Light"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "TextBlock",
                      text: issue.status,
                      weight: "Bolder",
                      color: "Light"
                    }
                  ]
                }
              ],
              spacing: "Small"
            }
          ],
          spacing: "Medium"
        }
      ] : []),
      {
        type: "Container",
        style: "emphasis",
        items: [
          {
            type: "TextBlock",
            text: "Description",
            weight: "Bolder",
            size: "Small",
            color: "Accent"
          },
          {
            type: "TextBlock",
            text: issue.description,
            wrap: true,
            spacing: "Small"
          }
        ],
        spacing: "Medium"
      },
      ...(issue.resolutionComment && issue.status === 'Closed' ? [
        {
          type: "Container",
          style: "good",
          items: [
            {
              type: "TextBlock",
              text: "✅ Final Resolution",
              weight: "Bolder",
              size: "Small",
              color: "Light"
            },
            {
              type: "TextBlock",
              text: issue.resolutionComment,
              wrap: true,
              spacing: "Small",
              color: "Light"
            }
          ],
          spacing: "Medium"
        }
      ] : [])
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View Issue",
        url: `${(process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')}/issue/${issue.id}`
      },
      {
        type: "Action.OpenUrl",
        title: "View All Issues",
        url: `${(process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')}/`
      }
    ].filter(action => {
      // Validate URL before including action
      try {
        new URL(action.url);
        return true;
      } catch {
        console.error('Invalid URL for WebEx action:', action.url);
        return false;
      }
    })
  };
}

export async function sendWebexCard(issue, action = 'created') {
  console.log('\n=== WEBEX CARD NOTIFICATION DEBUG ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Environment:', process.env.ENVIRONMENT);
  console.log('AWS Region:', process.env.AWS_DEFAULT_REGION);
  console.log('Issue ID:', issue.id);
  console.log('Issue Number:', issue.issue_number);
  console.log('Action:', action);
  console.log('Issue Title:', issue.title);
  
  // Validate WebEx bot configuration before proceeding
  const { validateWebexBotConfiguration, logWebexNotificationStatus } = await import('./webex-validation.js');
  const validation = await validateWebexBotConfiguration(issue.practice, action);
  
  logWebexNotificationStatus(issue, action, validation);
  
  if (!validation.hasValidBot) {
    console.error('❌ WEBEX NOTIFICATION BLOCKED: No valid WebEx bot configuration found');
    console.error(`   Issue practice "${issue.practice}" requires WebEx bot setup`);
    console.error('   Admin action required: Configure WebEx bot in Settings > WebEx Settings');
    return { 
      success: false, 
      error: `No WebEx bot configured for practice: ${issue.practice}`,
      warnings: validation.warnings
    };
  }
  
  // Get WebEx settings from SSM parameters based on issue practice
  const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
  const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
  const ENV = process.env.ENVIRONMENT || 'dev';
  
  let token, roomId;
  
  // Get practice-specific WebEx bot configuration
  const practiceBot = await db.getPracticeWebexBot(issue.practice);
  
  // This should always be true due to validation above, but defensive check
  if (practiceBot && practiceBot.ssmPrefix) {
    try {
      const tokenParam = ENV === 'prod' ? `/PracticeTools/WEBEX_${practiceBot.ssmPrefix}_ACCESS_TOKEN` : `/PracticeTools/${ENV}/WEBEX_${practiceBot.ssmPrefix}_ACCESS_TOKEN`;
      const tokenCommand = new GetParameterCommand({ Name: tokenParam });
      const tokenResult = await ssmClient.send(tokenCommand);
      token = tokenResult.Parameter?.Value;
    } catch (error) {
      console.log(`WebEx token not found for practice ${issue.practice}:`, error.message);
    }
    
    try {
      const roomIdParam = ENV === 'prod' ? `/PracticeTools/WEBEX_${practiceBot.ssmPrefix}_ROOM_ID_1` : `/PracticeTools/${ENV}/WEBEX_${practiceBot.ssmPrefix}_ROOM_ID_1`;
      const roomIdCommand = new GetParameterCommand({ Name: roomIdParam });
      const roomIdResult = await ssmClient.send(roomIdCommand);
      roomId = roomIdResult.Parameter?.Value;
    } catch (error) {
      console.log(`WebEx room ID not found for practice ${issue.practice}:`, error.message);
    }
  } else {
    console.log(`No WebEx bot configured for practice: ${issue.practice}`);
    return { success: false, error: `No WebEx bot configured for practice: ${issue.practice}` };
  }
  
  const baseUrl = process.env.NEXTAUTH_URL;
  
  console.log('Environment Variables Status:');
  console.log('  - WEBEX_SCOOP_ACCESS_TOKEN:', token ? `Present (${token.length} chars)` : 'MISSING');
  console.log('  - WEBEX_SCOOP_ROOM_ID_1:', roomId ? `Present (${roomId.substring(0, 15)}...)` : 'MISSING');
  console.log('  - WEBEX_SCOOP_ROOM_NAME:', 'Not loaded from SSM');
  console.log('  - NEXTAUTH_URL:', baseUrl || 'MISSING');
  
  if (!token) {
    console.error('❌ CRITICAL: WEBEX_SCOOP_ACCESS_TOKEN not found in environment variables');
    console.error('This indicates App Runner has not loaded SSM parameters yet or they don\'t exist');
    return { success: false, error: 'Missing access token - check SSM parameters and restart App Runner' };
  }
  
  if (!roomId) {
    console.error('❌ CRITICAL: WEBEX_SCOOP_ROOM_ID_1 not found in environment variables');
    console.error('This indicates App Runner has not loaded SSM parameters yet or they don\'t exist');
    return { success: false, error: 'Missing room ID - check SSM parameters and restart App Runner' };
  }

  // Look up user name for submitted by field
  const submittedByUser = await db.getUser(issue.email);
  const submittedByName = submittedByUser?.name || issue.email;
  
  const enhancedIssue = { ...issue, submittedByName };
  const card = await createAdaptiveCard(enhancedIssue, action);

  // Add problem link if it exists
  if (issue.problem_link) {
    card.body.push({
      type: "Container",
      style: "emphasis",
      items: [
        {
          type: "TextBlock",
          text: "🔗 Problem Link",
          weight: "Bolder",
          size: "Small",
          color: "Accent"
        },
        {
          type: "TextBlock",
          text: `[View Problem](${issue.problem_link})`,
          wrap: true,
          spacing: "Small"
        }
      ],
      spacing: "Medium"
    });
  }

  // Add attachments info if they exist
  try {
    const attachments = JSON.parse(issue.attachments || '[]');
    if (attachments.length > 0) {
      card.body.push({
        type: "Container",
        style: "emphasis",
        items: [
          {
            type: "TextBlock",
            text: "📎 Attachments",
            weight: "Bolder",
            size: "Small",
            color: "Accent"
          },
          {
            type: "TextBlock",
            text: `${attachments.length} attachment${attachments.length > 1 ? 's' : ''} available - Click 'View Issue' to access`,
            wrap: true,
            spacing: "Small"
          }
        ],
        spacing: "Medium"
      });
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  // Check if notifications are enabled
  try {
    console.log('🔍 Checking if Webex notifications are enabled...');
    const { isWebexNotificationsEnabled } = await import('./webex-check.js');
    const notificationsEnabled = await isWebexNotificationsEnabled();
    console.log('Webex notifications enabled:', notificationsEnabled);
    
    if (!notificationsEnabled) {
      console.log('⚠️  Webex notifications are disabled - skipping card send');
      return { success: false, error: 'Webex notifications disabled' };
    }
  } catch (error) {
    console.error('❌ Error checking notification settings:', error.message);
    // Continue anyway - default to enabled
  }
  
  try {
    console.log('🚀 Preparing Webex card notification...');
    console.log('Card generation for issue:', issue.id);
    
    // Look up user name for submitted by field
    let submittedByName = issue.email;
    try {
      const submittedByUser = await db.getUser(issue.email);
      submittedByName = submittedByUser?.name || issue.email;
      console.log('Issue submitter:', submittedByName);
    } catch (error) {
      console.log('Could not look up user name:', error.message);
    }
    
    const enhancedIssue = { ...issue, submittedByName };
    const card = await createAdaptiveCard(enhancedIssue, action);
    
    const payload = {
      roomId,
      text: `Issue ${action.toUpperCase()} - #${issue.issue_number}: ${issue.title}`,
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card
      }]
    };
    
    console.log('Payload prepared:');
    console.log('  - Room ID:', roomId.substring(0, 15) + '...');
    console.log('  - Text preview:', payload.text.substring(0, 50) + '...');
    console.log('  - Payload size:', JSON.stringify(payload).length, 'characters');
    console.log('  - Card sections:', card.body?.length || 0);
    console.log('  - Card actions:', card.actions?.length || 0);
    
    // Debug all URLs in the card
    if (card.actions) {
      console.log('🔗 Card Action URLs:');
      card.actions.forEach((action, index) => {
        if (action.type === 'Action.OpenUrl') {
          console.log(`  ${index + 1}. ${action.title}: ${action.url}`);
          try {
            new URL(action.url);
            console.log(`     ✅ Valid URL`);
          } catch (error) {
            console.log(`     ❌ Invalid URL: ${error.message}`);
          }
        }
      });
    }
    console.log('  - Card actions:', card.actions?.length || 0);
    
    // Debug all URLs in the card
    if (card.actions) {
      console.log('🔗 Card Action URLs:');
      card.actions.forEach((action, index) => {
        if (action.type === 'Action.OpenUrl') {
          console.log(`  ${index + 1}. ${action.title}: ${action.url}`);
          try {
            new URL(action.url);
            console.log(`     ✅ Valid URL`);
          } catch (error) {
            console.log(`     ❌ Invalid URL: ${error.message}`);
          }
        }
      });
    }
    
    console.log('🚀 Sending to Webex API...');
    const startTime = Date.now();
    
    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const duration = Date.now() - startTime;
    console.log('API Response received in', duration, 'ms');
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Webex card sent successfully!');
      console.log('Message ID:', responseData.id);
      console.log('Room ID confirmed:', responseData.roomId);
      console.log('Created timestamp:', responseData.created);
      console.log('=== WEBEX CARD NOTIFICATION COMPLETED ===\n');
      return { success: true, messageId: responseData.id };
    } else {
      const errorText = await response.text();
      console.error('❌ WebEx API Error Details:');
      console.error('  - Status:', response.status);
      console.error('  - Status Text:', response.statusText);
      console.error('  - Error Response:', errorText);
      console.error('  - Token Preview:', token.substring(0, 20) + '...');
      console.error('  - Room ID:', roomId);
      console.log('=== WEBEX CARD NOTIFICATION FAILED ===\n');
      return { success: false, error: `API Error: ${response.status} - ${errorText}` };
    }
  } catch (error) {
    console.error('❌ WEBEX CARD NOTIFICATION EXCEPTION:');
    console.error('  - Error Type:', error.name);
    console.error('  - Error Message:', error.message);
    console.error('  - Stack Trace:', error.stack);
    console.log('=== WEBEX CARD NOTIFICATION FAILED ===\n');
    return { success: false, error: error.message };
  }
}

export async function sendDirectMessage(issue, action = 'updated') {
  console.log('\n=== WEBEX DIRECT MESSAGE DEBUG ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Issue ID:', issue.id);
  console.log('Issue Number:', issue.issue_number);
  console.log('Action:', action);
  console.log('Recipient Email:', issue.email);
  console.log('Issue Title:', issue.title);
  
  // Get WebEx token from SSM parameters based on issue practice
  const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
  const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
  const ENV = process.env.ENVIRONMENT || 'dev';
  
  let token;
  
  // Get practice-specific WebEx bot configuration
  const practiceBot = await db.getPracticeWebexBot(issue.practice);
  
  if (practiceBot && practiceBot.ssmPrefix) {
    try {
      const tokenParam = ENV === 'prod' ? `/PracticeTools/WEBEX_${practiceBot.ssmPrefix}_ACCESS_TOKEN` : `/PracticeTools/${ENV}/WEBEX_${practiceBot.ssmPrefix}_ACCESS_TOKEN`;
      const tokenCommand = new GetParameterCommand({ Name: tokenParam });
      const tokenResult = await ssmClient.send(tokenCommand);
      token = tokenResult.Parameter?.Value;
    } catch (error) {
      console.log(`WebEx token not found for practice ${issue.practice}:`, error.message);
    }
  } else {
    // This should not happen due to validation above, but defensive fallback
    console.error('❌ CRITICAL: WebEx bot validation passed but bot not found in database');
    console.error(`   This indicates a data consistency issue for practice: ${issue.practice}`);
    return { 
      success: false, 
      error: `WebEx bot configuration error for practice: ${issue.practice}`,
      warnings: [`Data consistency error: Bot validation passed but configuration not found`]
    };
  }
  
  const baseUrl = process.env.NEXTAUTH_URL;
  
  console.log('Environment Variables:');
  console.log('  - WEBEX_SCOOP_ACCESS_TOKEN:', token ? `Present (${token.length} chars)` : 'MISSING');
  console.log('  - NEXTAUTH_URL:', baseUrl || 'MISSING');
  
  if (!token) {
    console.error('❌ CRITICAL: WEBEX_SCOOP_ACCESS_TOKEN not found for direct message');
    console.error('Direct messages require the same token as room messages');
    return { success: false, error: 'Missing access token for direct message' };
  }

  // Look up user name for submitted by field
  const submittedByUser = await db.getUser(issue.email);
  const submittedByName = submittedByUser?.name || issue.email;
  
  const enhancedIssue = { ...issue, submittedByName };
  // Create the same adaptive card as room notification
  const card = await createAdaptiveCard(enhancedIssue, action);

  // Check if notifications are enabled
  try {
    console.log('🔍 Checking if Webex notifications are enabled for DM...');
    const { isWebexNotificationsEnabled } = await import('./webex-check.js');
    const notificationsEnabled = await isWebexNotificationsEnabled();
    console.log('Webex notifications enabled:', notificationsEnabled);
    
    if (!notificationsEnabled) {
      console.log('⚠️  Webex notifications are disabled - skipping direct message');
      return { success: false, error: 'Webex notifications disabled' };
    }
  } catch (error) {
    console.error('❌ Error checking notification settings for DM:', error.message);
    // Continue anyway - default to enabled
  }
  
  try {
    console.log('🚀 Preparing Webex direct message...');
    
    // Look up user name for submitted by field
    let submittedByName = issue.email;
    try {
      const submittedByUser = await db.getUser(issue.email);
      submittedByName = submittedByUser?.name || issue.email;
      console.log('Message recipient user name:', submittedByName);
    } catch (error) {
      console.log('Could not look up recipient user name:', error.message);
    }
    
    const enhancedIssue = { ...issue, submittedByName };
    const card = await createAdaptiveCard(enhancedIssue, action);
    
    const payload = {
      toPersonEmail: issue.email,
      text: `Your issue has been ${action.toUpperCase()} - #${issue.issue_number}: ${issue.title}`,
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card
      }]
    };
    
    console.log('Direct Message Payload:');
    console.log('  - Recipient:', issue.email);
    console.log('  - Text preview:', payload.text.substring(0, 50) + '...');
    console.log('  - Payload size:', JSON.stringify(payload).length, 'characters');
    console.log('  - Card sections:', card.body?.length || 0);
    
    console.log('🚀 Sending direct message to Webex API...');
    const startTime = Date.now();
    
    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const duration = Date.now() - startTime;
    console.log('DM API Response received in', duration, 'ms');
    console.log('DM Response status:', response.status);
    console.log('DM Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Webex direct message sent successfully!');
      console.log('DM Message ID:', responseData.id);
      console.log('DM Recipient confirmed:', responseData.toPersonEmail);
      console.log('DM Created timestamp:', responseData.created);
      console.log('=== WEBEX DIRECT MESSAGE COMPLETED ===\n');
      return { success: true, messageId: responseData.id };
    } else {
      const errorText = await response.text();
      console.error('❌ WebEx DM API Error Details:');
      console.error('  - Status:', response.status);
      console.error('  - Status Text:', response.statusText);
      console.error('  - Error Response:', errorText);
      console.error('  - Token Preview:', token.substring(0, 20) + '...');
      console.error('  - Recipient Email:', issue.email);
      console.log('=== WEBEX DIRECT MESSAGE FAILED ===\n');
      return { success: false, error: `DM API Error: ${response.status} - ${errorText}` };
    }
  } catch (error) {
    console.error('❌ WEBEX DIRECT MESSAGE EXCEPTION:');
    console.error('  - Error Type:', error.name);
    console.error('  - Error Message:', error.message);
    console.error('  - Stack Trace:', error.stack);
    console.log('=== WEBEX DIRECT MESSAGE FAILED ===\n');
    return { success: false, error: error.message };
  }
}