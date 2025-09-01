import { db } from './dynamodb.js';

export class WeeklyAnalytics {
  static async generateWeeklyReport(adminName = null) {
    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Get all issues
      const allIssues = await db.getAllIssues();
      
      // Calculate analytics
      const analytics = {
        totalOpen: allIssues.filter(issue => ['Open', 'In Progress', 'Pending Testing', 'Backlog'].includes(issue.status)).length,
        totalClosed: allIssues.filter(issue => issue.status === 'Closed').length,
        newThisWeek: allIssues.filter(issue => new Date(issue.created_at) >= oneWeekAgo).length,
        closedThisWeek: allIssues.filter(issue => 
          issue.status === 'Closed' && 
          new Date(issue.last_updated_at) >= oneWeekAgo
        ).length,
        totalIssues: allIssues.length,
        byType: {
          bugReports: allIssues.filter(issue => issue.issue_type === 'Bug Report').length,
          featureRequests: allIssues.filter(issue => issue.issue_type === 'Feature Request').length,
          questions: allIssues.filter(issue => issue.issue_type === 'General Question').length
        },
        topUpvoted: allIssues
          .filter(issue => issue.status !== 'Closed')
          .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
          .slice(0, 3)
      };
      
      // Add assigned issues count for specific admin
      if (adminName) {
        analytics.assignedToMe = allIssues.filter(issue => 
          issue.assigned_to === adminName && 
          ['Open', 'In Progress', 'Pending Testing', 'Backlog'].includes(issue.status)
        ).length;
      }
      
      return analytics;
    } catch (error) {
      console.error('Error generating weekly report:', error);
      throw error;
    }
  }

  static createWeeklyReportCard(analytics) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date();
    
    return {
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
                      type: "TextBlock",
                      text: "📊",
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
                      text: "Weekly Issue Tracker Analytics",
                      weight: "Bolder",
                      size: "Large",
                      color: "Accent"
                    },
                    {
                      type: "TextBlock",
                      text: `Week of ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
                      size: "Small",
                      color: "Default",
                      isSubtle: true
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
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "Container",
                      style: "attention",
                      items: [
                        {
                          type: "TextBlock",
                          text: analytics.totalOpen.toString(),
                          size: "ExtraLarge",
                          weight: "Bolder",
                          color: "Light",
                          horizontalAlignment: "Center"
                        },
                        {
                          type: "TextBlock",
                          text: "Open Issues",
                          size: "Small",
                          color: "Light",
                          horizontalAlignment: "Center"
                        }
                      ]
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "Container",
                      style: "good",
                      items: [
                        {
                          type: "TextBlock",
                          text: analytics.newThisWeek.toString(),
                          size: "ExtraLarge",
                          weight: "Bolder",
                          color: "Light",
                          horizontalAlignment: "Center"
                        },
                        {
                          type: "TextBlock",
                          text: "New This Week",
                          size: "Small",
                          color: "Light",
                          horizontalAlignment: "Center"
                        }
                      ]
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "Container",
                      style: "accent",
                      items: [
                        {
                          type: "TextBlock",
                          text: analytics.closedThisWeek.toString(),
                          size: "ExtraLarge",
                          weight: "Bolder",
                          color: "Light",
                          horizontalAlignment: "Center"
                        },
                        {
                          type: "TextBlock",
                          text: "Closed This Week",
                          size: "Small",
                          color: "Light",
                          horizontalAlignment: "Center"
                        }
                      ]
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
              text: "Issue Breakdown by Type",
              weight: "Bolder",
              size: "Medium"
            },
            {
              type: "FactSet",
              facts: [
                {
                  title: "🐛 Bug Reports",
                  value: analytics.byType.bugReports.toString()
                },
                {
                  title: "✨ Feature Requests", 
                  value: analytics.byType.featureRequests.toString()
                },
                {
                  title: "❓ Questions",
                  value: analytics.byType.questions.toString()
                },
                {
                  title: "📈 Total Issues",
                  value: analytics.totalIssues.toString()
                },
                ...(analytics.assignedToMe !== undefined ? [
                  {
                    title: "👤 Assigned to Me",
                    value: analytics.assignedToMe.toString()
                  }
                ] : [])
              ]
            }
          ]
        },
        ...(analytics.topUpvoted.length > 0 ? [
          {
            type: "Container",
            items: [
              {
                type: "TextBlock",
                text: "🔥 Top Upvoted Open Issues",
                weight: "Bolder",
                size: "Medium"
              },
              ...analytics.topUpvoted.map(issue => ({
                type: "Container",
                style: "emphasis",
                items: [
                  {
                    type: "TextBlock",
                    text: `#${issue.issue_number}: ${issue.title}`,
                    weight: "Bolder",
                    wrap: true
                  },
                  {
                    type: "TextBlock",
                    text: `👍 ${issue.upvotes || 0} upvotes • ${issue.issue_type}`,
                    size: "Small",
                    color: "Accent"
                  }
                ]
              }))
            ]
          }
        ] : [])
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "View All Issues",
          url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/`
        },
        {
          type: "Action.OpenUrl", 
          title: "Admin Dashboard",
          url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin`
        }
      ]
    };
  }

  static async sendWeeklyReport() {
    try {
      // Get WebEx settings from database
      const webexSettings = await db.getSetting('webex_integration');
      let token = null;
      
      if (webexSettings) {
        try {
          const settings = JSON.parse(webexSettings);
          token = settings.accessToken;
        } catch (error) {
          console.error('Error parsing WebEx settings:', error);
        }
      }
      
      // Fallback to environment variable
      if (!token) {
        token = process.env.WEBEX_SCOOP_ACCESS_TOKEN;
      }
      
      if (!token) {
        console.log('No WebEx token found in database or environment - skipping weekly report');
        return false;
      }

      // Get all admin users
      const users = await db.getAllUsers();
      const admins = users.filter(user => user.role === 'admin');
      
      if (admins.length === 0) {
        console.log('No admin users found - skipping weekly report');
        return false;
      }

      console.log(`📊 Sending weekly analytics to ${admins.length} admin(s)`);
      
      let successCount = 0;
      for (const admin of admins) {
        try {
          // Generate personalized analytics for each admin
          const analytics = await this.generateWeeklyReport(admin.name);
          const card = this.createWeeklyReportCard(analytics);
          
          const response = await fetch('https://webexapis.com/v1/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              toPersonEmail: admin.email,
              text: `Weekly Issue Tracker Analytics - ${analytics.totalOpen} open issues, ${analytics.assignedToMe || 0} assigned to you`,
              attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: card
              }]
            })
          });
          
          if (response.ok) {
            console.log(`✅ Weekly report sent to: ${admin.email}`);
            successCount++;
          } else {
            const errorText = await response.text();
            console.error(`❌ Failed to send weekly report to ${admin.email}:`, response.status, errorText);
          }
        } catch (error) {
          console.error(`❌ Error sending weekly report to ${admin.email}:`, error);
        }
      }
      
      console.log(`📊 Weekly analytics sent to ${successCount}/${admins.length} admins`);
      return successCount > 0;
    } catch (error) {
      console.error('❌ Error sending weekly report:', error);
      return false;
    }
  }
}