export async function sendTranscriptFailureNotification(recording) {
  try {
    const hostEmail = recording.hostEmail;
    if (!hostEmail) {
      console.log('No host email available for transcript failure notification');
      return false;
    }

    const { db } = await import('./dynamodb.js');
    
    const user = await db.getUser(hostEmail);
    if (!user || !user.practices || user.practices.length === 0) {
      console.log(`No practice found for user: ${hostEmail}`);
      return false;
    }

    const userPractice = user.practices[0];
    const matchingBot = await db.getPracticeWebexBot(userPractice);

    if (!matchingBot || !matchingBot.ssmPrefix) {
      console.log(`No WebEx bot configured for practice: ${userPractice}`);
      return false;
    }

    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const ENV = process.env.ENVIRONMENT || 'dev';
    
    let token;
    try {
      const tokenParam = ENV === 'prod' 
        ? `/PracticeTools/WEBEX_${matchingBot.ssmPrefix}_ACCESS_TOKEN`
        : `/PracticeTools/${ENV}/WEBEX_${matchingBot.ssmPrefix}_ACCESS_TOKEN`;
      const tokenCommand = new GetParameterCommand({ Name: tokenParam });
      const tokenResult = await ssmClient.send(tokenCommand);
      token = tokenResult.Parameter?.Value;
    } catch (error) {
      console.log(`WebEx token not found for bot ${matchingBot.ssmPrefix}:`, error.message);
      return false;
    }

    if (!token) {
      console.log(`No WebEx token available for bot: ${matchingBot.ssmPrefix}`);
      return false;
    }

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
                  items: [
                    {
                      type: "Image",
                      url: "https://img.icons8.com/fluency/96/error.png",
                      size: "Medium",
                      width: "40px"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: "⚠️ Transcript Processing Failed",
                      size: "Large",
                      weight: "Bolder",
                      color: "Attention",
                      wrap: true
                    }
                  ],
                  verticalContentAlignment: "Center"
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          spacing: "Medium",
          items: [
            {
              type: "TextBlock",
              text: "The transcript for your WebEx recording could not be generated after multiple retry attempts. The recording is available, but cannot be approved for public access without a transcript.",
              wrap: true,
              color: "Default",
              spacing: "Small"
            }
          ]
        },
        {
          type: "Container",
          style: "emphasis",
          spacing: "Medium",
          items: [
            {
              type: "FactSet",
              facts: [
                {
                  title: "Meeting ID:",
                  value: recording.meetingId || 'N/A'
                },
                {
                  title: "Topic:",
                  value: recording.topic || 'Untitled Meeting'
                },
                {
                  title: "Recorded:",
                  value: new Date(recording.createTime).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                },
                {
                  title: "Status:",
                  value: "❌ Transcript Failed"
                }
              ]
            }
          ]
        }
      ]
    };

    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toPersonEmail: hostEmail,
        text: `Transcript processing failed for recording: ${recording.topic || 'Untitled Meeting'}`,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: adaptiveCard
        }]
      })
    });

    if (response.ok) {
      console.log(`Transcript failure notification sent to ${hostEmail}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Failed to send transcript failure notification: ${response.status} ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending transcript failure notification:', error);
    return false;
  }
}

export async function sendRecordingApprovalNotification(recording) {
  try {
    const hostEmail = recording.hostEmail;
    if (!hostEmail) {
      console.log('No host email available for recording notification');
      return false;
    }

    const { db } = await import('./dynamodb.js');
    
    // Get user to find their practice
    const user = await db.getUser(hostEmail);
    if (!user || !user.practices || user.practices.length === 0) {
      console.log(`No practice found for user: ${hostEmail}`);
      return false;
    }

    // Get bot for user's first practice
    const userPractice = user.practices[0];
    const matchingBot = await db.getPracticeWebexBot(userPractice);

    if (!matchingBot || !matchingBot.ssmPrefix) {
      console.log(`No WebEx bot configured for practice: ${userPractice}`);
      return false;
    }

    // Get WebEx token from SSM
    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const ENV = process.env.ENVIRONMENT || 'dev';
    
    let token;
    try {
      const tokenParam = ENV === 'prod' 
        ? `/PracticeTools/WEBEX_${matchingBot.ssmPrefix}_ACCESS_TOKEN`
        : `/PracticeTools/${ENV}/WEBEX_${matchingBot.ssmPrefix}_ACCESS_TOKEN`;
      const tokenCommand = new GetParameterCommand({ Name: tokenParam });
      const tokenResult = await ssmClient.send(tokenCommand);
      token = tokenResult.Parameter?.Value;
    } catch (error) {
      console.log(`WebEx token not found for bot ${matchingBot.ssmPrefix}:`, error.message);
      return false;
    }

    if (!token) {
      console.log(`No WebEx token available for bot: ${matchingBot.ssmPrefix}`);
      return false;
    }

    // Build base URL
    let baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    baseUrl = baseUrl.replace(/\/$/, '');
    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }

    const approveUrl = `${baseUrl}/company-education/webex-recordings`;

    // Create adaptive card
    const adaptiveCard = {
      type: "AdaptiveCard",
      version: "1.3",
      body: [
        {
          type: "Container",
          style: "emphasis",
          items: [
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "Image",
                      url: "https://img.icons8.com/fluency/96/video-message.png",
                      size: "Medium",
                      width: "40px"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: "🎥 New Recording Ready for Approval",
                      size: "Large",
                      weight: "Bolder",
                      color: "Accent",
                      wrap: true
                    }
                  ],
                  verticalContentAlignment: "Center"
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          spacing: "Medium",
          items: [
            {
              type: "TextBlock",
              text: "A new WebEx recording has been processed and is awaiting your approval before it becomes publicly available.",
              wrap: true,
              color: "Default",
              spacing: "Small"
            }
          ]
        },
        {
          type: "Container",
          style: "emphasis",
          spacing: "Medium",
          items: [
            {
              type: "FactSet",
              facts: [
                {
                  title: "Meeting ID:",
                  value: recording.meetingId || 'N/A'
                },
                {
                  title: "Topic:",
                  value: recording.topic || 'Untitled Meeting'
                },
                {
                  title: "Recorded:",
                  value: new Date(recording.createTime).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                },
                {
                  title: "Status:",
                  value: "✅ Ready for Approval"
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          spacing: "Medium",
          items: [
            {
              type: "TextBlock",
              text: "📋 **Next Steps:**",
              weight: "Bolder",
              size: "Medium",
              spacing: "Small"
            },
            {
              type: "TextBlock",
              text: "• Review the recording content\n• Ensure transcript is available\n• Approve to make it publicly accessible",
              wrap: true,
              spacing: "Small"
            }
          ]
        }
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "📝 Review & Approve Recording",
          url: approveUrl,
          style: "positive"
        }
      ]
    };

    // Send direct message to host
    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toPersonEmail: hostEmail,
        text: `New WebEx recording ready for approval: ${recording.topic || 'Untitled Meeting'}`,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: adaptiveCard
        }]
      })
    });

    if (response.ok) {
      console.log(`Recording approval notification sent to ${hostEmail}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Failed to send recording notification: ${response.status} ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending recording approval notification:', error);
    return false;
  }
}
