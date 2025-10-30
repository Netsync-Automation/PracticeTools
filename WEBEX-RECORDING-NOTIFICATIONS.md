# WebEx Recording Approval Notifications

## Overview
Implemented automatic Webex notifications to recording hosts when new recordings are processed and ready for approval.

## Implementation Details

### Files Created
- **lib/webex-recording-notifications.js**: New utility module for sending recording approval notifications

### Files Modified
- **app/api/webhooks/webexmeetings/recordings/route.js**: Added notification trigger after recording is saved to database

## How It Works

1. **Recording Processing**: When a new WebEx recording is received via webhook:
   - Recording is downloaded from WebEx
   - Uploaded to S3
   - Saved to DynamoDB with host email

2. **Notification Trigger**: After successful database insertion:
   - `sendRecordingApprovalNotification()` is called
   - Function retrieves configured WebEx bot from admin settings
   - Uses first available bot's access token from SSM

3. **Message Delivery**: 
   - Sends direct message to host's email via WebEx API
   - Uses modern adaptive card with:
     - Recording details (Meeting ID, Topic, Date)
     - Visual status indicator
     - Next steps guidance
     - Direct link button to approval page

4. **Adaptive Card Features**:
   - Professional design with icons and emphasis containers
   - Displays meeting metadata in organized fact set
   - Clear call-to-action button linking to `/company-education/webex-recordings`
   - Responsive layout following industry best practices

## DSR Compliance

✅ **Environment Awareness**: Uses environment-specific SSM parameters  
✅ **Database-Stored Configuration**: Retrieves bot config from DynamoDB  
✅ **Security**: Uses SSM for token storage, no hardcoded secrets  
✅ **Real-time Updates**: Integrates with existing SSE system  
✅ **Code Reusability**: Leverages existing WebEx bot infrastructure  
✅ **Modern UX**: Adaptive cards with intuitive design and clear actions  

## Configuration

No additional configuration needed. The system automatically:
- Uses existing WebEx bot configurations from admin/settings/webex-settings
- Retrieves access tokens from SSM parameters
- Sends notifications to the recording host's email address

## Error Handling

- Graceful failure if no bots configured
- Logs errors without breaking recording processing
- Continues with SSE notifications even if WebEx message fails

## Testing

To test the notification:
1. Ensure at least one WebEx bot is configured in admin settings
2. Process a new recording via webhook
3. Check that host receives WebEx message with adaptive card
4. Verify button links to correct approval page
