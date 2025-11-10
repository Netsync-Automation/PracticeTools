# Webex Meetings Webhook Fixes

## Issue Summary
The webhooks for Webex Meetings recordings and transcripts are not picking up recordings from the host "mbgriffin@netsync.com". This document outlines the fixes implemented to resolve this issue.

## Root Cause Analysis
1. **Missing Host Filters**: Webhooks were not configured with proper host email filters
2. **Inadequate Host Validation**: The webhook endpoints were only checking `hostUserId` instead of multiple possible host identifiers
3. **Token Management**: Webhooks were using potentially stale access tokens instead of refreshed tokens
4. **Insufficient Debugging**: Limited visibility into webhook activity and validation results

## Fixes Implemented

### 1. Enhanced Webhook Creation (`webhookmgmt/route.js`)
- **Added host email filters**: Webhooks now include `filter: hostEmail=${site.recordingHosts.join(',')}` to target specific recording hosts
- **Improved webhook identification**: Enhanced validation logic to find webhooks by site-specific names
- **Better debugging information**: Added comprehensive logging and webhook details in validation results

### 2. Improved Host Validation (`recordings/route.js`)
- **Multiple host identifier checks**: Now checks `hostUserId`, `hostEmail`, and `creatorId` fields
- **Enhanced error logging**: Detailed logging shows which host identifiers were checked and why validation failed
- **Token manager integration**: Uses `getValidAccessToken()` to ensure fresh tokens for API calls

### 3. Updated Transcripts Webhook (`transcripts/route.js`)
- **Token manager integration**: Uses `getValidAccessToken()` for reliable API access
- **Consistent error handling**: Matches the improved error handling from recordings webhook

### 4. Enhanced Admin Interface (`admin/settings/page.js`)
- **Webhook Logs Modal**: New interface to view webhook activity logs and debug issues
- **Improved Validation Modal**: Enhanced webhook validation results with detailed information
- **Better Error Display**: More comprehensive error messages and debugging information

### 5. Test Endpoint (`webhooks/webexmeetings/test/route.js`)
- **Connectivity Testing**: New endpoint to test webhook connectivity and payload reception
- **Debug Logging**: Comprehensive logging of incoming webhook requests for troubleshooting

### 6. Diagnostic Script (`diagnose-webhook-issue.js`)
- **Configuration Validation**: Checks Webex Meetings configuration and host setup
- **Webhook Status Check**: Validates webhook existence and configuration in Webex
- **Activity Analysis**: Reviews recent webhook logs to identify patterns
- **Actionable Recommendations**: Provides specific steps to resolve issues

## Key Changes Made

### Webhook Filters
```javascript
// Before: No filters
const recordingsPayload = {
  name: `PracticeTools Recordings - ${site.siteName || site.siteUrl}`,
  targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
  resource: 'recordings',
  event: 'created'
};

// After: With host email filters
const recordingsPayload = {
  name: `PracticeTools Recordings - ${site.siteName || site.siteUrl}`,
  targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
  resource: 'recordings',
  event: 'created',
  filter: `hostEmail=${site.recordingHosts.join(',')}`
};
```

### Host Validation
```javascript
// Before: Single identifier check
const matchingSite = config.sites.find(site => 
  data.siteUrl === site.siteUrl && 
  site.recordingHosts.includes(data.hostUserId)
);

// After: Multiple identifier checks
const matchingSite = config.sites.find(site => {
  if (data.siteUrl !== site.siteUrl) return false;
  
  const hostIdentifiers = [
    data.hostUserId,
    data.hostEmail,
    data.creatorId
  ].filter(Boolean);
  
  return hostIdentifiers.some(identifier => 
    site.recordingHosts.includes(identifier)
  );
});
```

## Next Steps

### 1. Immediate Actions
1. **Update Configuration**: Ensure "mbgriffin@netsync.com" is added to the recording hosts list for the appropriate site
2. **Recreate Webhooks**: Delete existing webhooks and create new ones with proper host filters
3. **Test Recording**: Have mbgriffin@netsync.com create a test recording to verify webhook functionality

### 2. Validation Steps
1. **Run Diagnostic Script**: Execute `node diagnose-webhook-issue.js` to check current configuration
2. **Check Webhook Logs**: Use the new Webhook Logs modal in admin settings to monitor activity
3. **Validate Webhooks**: Use the enhanced validation modal to verify webhook configuration

### 3. Monitoring
1. **Regular Log Review**: Check webhook logs periodically for any processing issues
2. **Host Configuration**: Ensure all recording hosts are properly configured in site settings
3. **Token Refresh**: Monitor token refresh operations to ensure API access remains valid

## Configuration Requirements

### Recording Host Setup
- Add "mbgriffin@netsync.com" to the `recordingHosts` array for the appropriate Webex site
- Ensure the email format matches exactly what Webex sends in webhook payloads
- Consider adding both email and user ID formats if available

### Webhook Configuration
- Webhooks must include host email filters to target specific recording hosts
- Both recordings and transcripts webhooks should be created for complete functionality
- Webhook names should include site identification for easier management

### Access Tokens
- Ensure access tokens have the required scopes: `spark:recordings_read`, `spark:recordings_write`
- Implement proper token refresh mechanisms to maintain API access
- Store tokens securely in SSM parameters with environment-specific naming

## Troubleshooting Guide

### If Webhooks Still Don't Work
1. **Check Host Configuration**: Verify "mbgriffin@netsync.com" is in the recording hosts list
2. **Validate Webhook Filters**: Ensure webhooks have proper `hostEmail` filters
3. **Test Connectivity**: Use the test endpoint to verify webhook reachability
4. **Review Logs**: Check webhook logs for any error messages or validation failures
5. **Token Validation**: Ensure access tokens are valid and have required scopes

### Common Issues
- **Host Email Mismatch**: Webex might send different email formats than expected
- **Token Expiration**: Access tokens may expire and need refresh
- **Filter Syntax**: Webhook filters must use exact syntax: `hostEmail=email1,email2`
- **Site Configuration**: Ensure the correct site is configured for the recording host

## Testing Procedure
1. Configure "mbgriffin@netsync.com" as a recording host
2. Create webhooks with proper host filters
3. Have mbgriffin@netsync.com create a test recording
4. Monitor webhook logs for incoming requests
5. Verify recording appears in the system with proper processing

This comprehensive fix addresses the webhook configuration issues and provides better debugging capabilities to prevent similar problems in the future.