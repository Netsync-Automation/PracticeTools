# Webex Service App Webhook Solution

## Current Status ✅ IDENTIFIED

The webhook configuration has been **fixed** but the **tokens are expired** and need manual refresh.

### Issues Fixed:
1. ✅ **Webhook Creation Parameters** - Added `ownedBy: "org"` and `siteUrl` parameters
2. ✅ **NEXTAUTH_URL Configuration** - Now retrieves from SSM first
3. ✅ **Token Manager** - Properly configured for service apps
4. ✅ **Error Handling** - Comprehensive logging and debugging

### Current Problem: **Expired Service App Tokens**

**Analysis Results:**
- Token Type: Non-JWT bearer tokens (106 characters)
- Access Token: ❌ Expired (401 status)
- Refresh Token: ✅ Available but separate from access token
- Token Refresh: ❌ Requires `client_id` (service app configuration)

## Solution: Manual Token Refresh Required

### Option 1: Update Tokens via Admin Settings (Recommended)
1. Go to **Admin → Settings → Company Education tab**
2. Navigate to **Webex Meetings** section
3. Update the **Access Token** and **Refresh Token** with fresh tokens from your service app
4. Save the configuration

### Option 2: Update Tokens via SSM (Advanced)
```bash
# Update access token
aws ssm put-parameter --name "/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN" --value "NEW_ACCESS_TOKEN" --overwrite

# Update refresh token  
aws ssm put-parameter --name "/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_REFRESH_TOKEN" --value "NEW_REFRESH_TOKEN" --overwrite
```

### Option 3: Add Client ID for Automatic Refresh (Future Enhancement)
To enable automatic token refresh, add the service app client_id to SSM:
```bash
aws ssm put-parameter --name "/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_CLIENT_ID" --value "YOUR_SERVICE_APP_CLIENT_ID" --type "String"
```

## How to Get Fresh Tokens

### From Webex Developer Portal:
1. Go to https://developer.webex.com/my-apps
2. Select your **Service App**
3. Go to the **Scopes** or **Authentication** section
4. Generate new access/refresh tokens
5. Copy the tokens and update them in the application

### Required Scopes for Webhooks:
- `spark:kms` (for meetings)
- `meeting:recordings_read` (for recordings)
- `meeting:transcripts_read` (for transcripts)

## Testing After Token Update

1. **Validate Tokens:**
   ```bash
   node validate-webex-service-app.js
   ```

2. **Test Webhook Creation:**
   - Go to Admin Settings → Webex Meetings
   - Use "Create Webhooks" button
   - Check webhook logs for success

3. **Verify Webhook Endpoints:**
   ```bash
   node diagnose-webex-webhooks.js
   ```

## Expected Webhook Configuration

After token refresh, webhooks will be created with:

### Recordings Webhook:
```json
{
  "name": "PracticeTools Recordings - netsync",
  "targetUrl": "https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/webexmeetings/recordings",
  "resource": "recordings",
  "event": "created",
  "ownedBy": "org",
  "siteUrl": "netsync.webex.com"
}
```

### Transcripts Webhook:
```json
{
  "name": "PracticeTools Transcripts - netsync", 
  "targetUrl": "https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/webexmeetings/transcripts",
  "resource": "meetingTranscripts",
  "event": "created", 
  "ownedBy": "org",
  "siteUrl": "netsync.webex.com"
}
```

## Webhook Flow After Fix

1. **Recording Created** → Webex sends webhook to `/api/webhooks/webexmeetings/recordings`
2. **Application Filters** → Checks if recording host matches configured hosts
3. **Download & Store** → Downloads recording, uploads to S3, stores in DynamoDB
4. **SSE Notification** → Real-time update sent to frontend
5. **Transcript Available** → Webex sends webhook to `/api/webhooks/webexmeetings/transcripts`
6. **Update Recording** → Downloads transcript, updates existing recording record

## Files Modified for Service App Support

1. `app/api/webexmeetings/settings/webhookmgmt/route.js` - Fixed webhook creation
2. `lib/webex-token-manager.js` - Service app token handling
3. `app/api/webhooks/webexmeetings/recordings/route.js` - Already properly configured
4. `app/api/webhooks/webexmeetings/transcripts/route.js` - Already properly configured

## Next Steps

1. **Update tokens** using Option 1 (Admin Settings) above
2. **Create webhooks** via admin interface
3. **Test with actual recording** from configured recording hosts
4. **Monitor webhook logs** for successful processing

The webhook infrastructure is now properly configured for service apps and will work once fresh tokens are provided.