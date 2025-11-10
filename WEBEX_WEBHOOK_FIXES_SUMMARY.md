# Webex Webhooks Fix Summary

## Issues Identified and Fixed

### 1. **Webhook Creation Parameters** ✅ FIXED
- **Issue**: Webhooks were missing required `ownedBy: "org"` parameter
- **Issue**: Webhooks were missing `siteUrl` parameter for site-specific webhooks
- **Fix**: Updated `webhookmgmt/route.js` to include both parameters in webhook creation payload

### 2. **NEXTAUTH_URL Configuration** ✅ FIXED
- **Issue**: Using environment variable instead of SSM parameter
- **Fix**: Updated webhook management to retrieve NEXTAUTH_URL from SSM first, with fallback to environment variable

### 3. **Token Refresh Mechanism** ✅ FIXED
- **Issue**: Refresh token was being sent in Authorization header instead of request body
- **Issue**: Missing `client_id` and `client_secret` parameters required for service apps
- **Fix**: Updated `webex-token-manager.js` to properly format refresh requests with all required parameters

### 4. **Token Expiration Detection** ✅ FIXED
- **Issue**: Webex Meetings API tokens are not JWTs, so expiration couldn't be determined from token
- **Fix**: Added API call testing to determine if tokens are expired

### 5. **Error Handling and Logging** ✅ IMPROVED
- **Issue**: Limited error information for debugging webhook creation failures
- **Fix**: Added comprehensive logging and error details throughout webhook management

## Current Status

### ✅ **Working Components**
- Webhook endpoint handlers (`/api/webhooks/webexmeetings/recordings` and `/api/webhooks/webexmeetings/transcripts`)
- SSE notifications for real-time updates
- S3 upload functionality for recordings and transcripts
- Database storage with environment-aware table names
- Webhook validation and management API
- Diagnostic and testing scripts

### ⚠️ **Requires Manual Setup**
- **Client Credentials**: Need to be added to SSM for token refresh to work
- **Valid Tokens**: Current tokens are expired and need refresh after client credentials are set up

## Next Steps to Complete Setup

### 1. **Add Client Credentials to SSM**
You need to add the Webex service app client credentials to SSM:

```bash
# For dev environment
aws ssm put-parameter --name "/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_CLIENT_ID" --value "YOUR_CLIENT_ID" --type "String"
aws ssm put-parameter --name "/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_CLIENT_SECRET" --value "YOUR_CLIENT_SECRET" --type "SecureString"
```

Or use the setup script after updating it with your credentials:
```bash
node setup-webex-credentials.js
```

### 2. **Refresh Tokens**
After adding client credentials, refresh the expired tokens:
```bash
node refresh-webex-tokens.js
```

### 3. **Create/Recreate Webhooks**
Use the admin settings page or API to create webhooks:
- Go to Admin → Settings → Company Education tab
- Configure Webex Meetings settings
- Use webhook management to create webhooks

### 4. **Validate Setup**
Run the diagnostic script to verify everything is working:
```bash
node diagnose-webex-webhooks.js
```

## Webhook Configuration Details

### **Recordings Webhook**
```json
{
  "name": "PracticeTools Recordings - {siteName}",
  "targetUrl": "{NEXTAUTH_URL}/api/webhooks/webexmeetings/recordings",
  "resource": "recordings",
  "event": "created",
  "ownedBy": "org",
  "siteUrl": "{site.siteUrl}"
}
```

### **Transcripts Webhook**
```json
{
  "name": "PracticeTools Transcripts - {siteName}",
  "targetUrl": "{NEXTAUTH_URL}/api/webhooks/webexmeetings/transcripts",
  "resource": "meetingTranscripts", 
  "event": "created",
  "ownedBy": "org",
  "siteUrl": "{site.siteUrl}"
}
```

## Key DSR Compliance Features

### ✅ **Environment Awareness**
- All table names use environment-specific naming: `PracticeTools-{env}-TableName`
- SSM parameters use environment-aware paths
- Configuration works in both dev and prod environments

### ✅ **Real-time Updates (SSE)**
- SSE notifications implemented for all webhook activities
- Real-time updates for recording and transcript processing
- WebexMeetings SSE endpoint: `/api/sse/webex-meetings`

### ✅ **Security Best Practices**
- Client secrets stored as SecureString in SSM
- No hardcoded credentials in code
- Input validation and sanitization
- Proper error handling without exposing sensitive data

### ✅ **Database-Stored Configuration**
- All webhook settings stored in database
- Recording hosts configuration stored in database
- No hardcoded configuration values

## Files Modified

1. `app/api/webexmeetings/settings/webhookmgmt/route.js` - Fixed webhook creation
2. `lib/webex-token-manager.js` - Fixed token refresh mechanism
3. `lib/ssm.js` - Added client credential storage functions
4. `app/api/settings/webex-meetings/route.js` - Added client credential handling

## Files Created

1. `diagnose-webex-webhooks.js` - Diagnostic script
2. `refresh-webex-tokens.js` - Token refresh script  
3. `setup-webex-credentials.js` - Credential setup script
4. `WEBEX_WEBHOOK_FIXES_SUMMARY.md` - This summary

## Testing

After completing the setup steps above, test the webhooks by:

1. Creating a Webex meeting with recording enabled
2. Having the meeting recorded by one of the configured recording hosts
3. Checking the webhook logs: `/api/webexmeetings/settings/webhooklogs`
4. Verifying recordings appear in the WebexMeetings section of the application
5. Confirming transcripts are processed when available

The webhooks should now properly capture recordings and transcripts from Cisco Webex according to the configured recording hosts and site settings.