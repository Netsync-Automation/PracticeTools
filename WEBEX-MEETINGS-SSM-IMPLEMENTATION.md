# Webex Meetings SSM Implementation

## Overview
Webex Meetings access and refresh tokens are now stored securely in AWS Systems Manager (SSM) Parameter Store instead of DynamoDB, following DSR compliance requirements.

## SSM Parameter Naming Convention

### Pattern
- Site URL: `https://netsync.webex.com` → Site Prefix: `NETSYNC`
- Access Token: `{SITE_PREFIX}_WEBEX_MEETINGS_ACCESS_TOKEN`
- Refresh Token: `{SITE_PREFIX}_WEBEX_MEETINGS_REFRESH_TOKEN`

### Environment-Aware Paths
- **Production**: `/PracticeTools/{PARAMETER_NAME}`
- **Development**: `/PracticeTools/dev/{PARAMETER_NAME}`

### Example for netsync.webex.com
- **Dev Access Token**: `/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN`
- **Dev Refresh Token**: `/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_REFRESH_TOKEN`
- **Prod Access Token**: `/PracticeTools/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN`
- **Prod Refresh Token**: `/PracticeTools/NETSYNC_WEBEX_MEETINGS_REFRESH_TOKEN`

## Implementation Details

### Files Modified
1. **lib/ssm.js** - SSM utility functions
2. **lib/webex-meetings-utils.js** - Helper utilities
3. **app/api/settings/webex-meetings/route.js** - API updated to use SSM
4. **apprunner-dev.yaml** - Added NETSYNC SSM parameters
5. **apprunner-prod.yaml** - Added NETSYNC SSM parameters

### Key Functions
- `getSitePrefix(siteUrl)` - Extract site prefix from URL
- `getSSMPath(parameterName)` - Generate environment-aware SSM path
- `storeWebexTokens(siteUrl, accessToken, refreshToken)` - Store tokens in SSM
- `getWebexTokens(siteUrl)` - Retrieve tokens from SSM

### Parameter Type
- **Type**: `String` (not SecureString for App Runner compatibility)
- **Encryption**: Handled at the infrastructure level

## App Runner Configuration

### Current Configuration (NETSYNC site)
Both dev and prod configurations include:
```yaml
- name: NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN
  value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools[/dev]/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN
- name: NETSYNC_WEBEX_MEETINGS_REFRESH_TOKEN
  value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools[/dev]/NETSYNC_WEBEX_MEETINGS_REFRESH_TOKEN
```

### Adding New Sites
When configuring a new site (e.g., `example.webex.com`):

1. **Extract prefix**: `example.webex.com` → `EXAMPLE`
2. **Add to App Runner configs**:
   ```yaml
   - name: EXAMPLE_WEBEX_MEETINGS_ACCESS_TOKEN
     value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools[/dev]/EXAMPLE_WEBEX_MEETINGS_ACCESS_TOKEN
   - name: EXAMPLE_WEBEX_MEETINGS_REFRESH_TOKEN
     value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools[/dev]/EXAMPLE_WEBEX_MEETINGS_REFRESH_TOKEN
   ```

## API Behavior

### GET /api/settings/webex-meetings
- Retrieves site configurations from DynamoDB
- Loads tokens from SSM for each configured site
- Returns complete configuration with tokens

### POST /api/settings/webex-meetings
- Validates site configurations
- Stores tokens in SSM using site-specific parameter names
- Stores site configurations (without tokens) in DynamoDB
- Sends SSE notifications for real-time updates

## Security Benefits
1. **Separation of Concerns**: Configuration in DynamoDB, secrets in SSM
2. **Environment Isolation**: Dev and prod tokens are completely separate
3. **Access Control**: SSM parameters can have fine-grained IAM policies
4. **Audit Trail**: SSM provides detailed access logging
5. **Runtime Security**: Tokens loaded fresh from SSM on each API call

## DSR Compliance
✅ **Environment Awareness**: Uses environment-specific SSM paths  
✅ **Security Best Practices**: Tokens stored in SSM, not hardcoded  
✅ **Real-time Updates**: SSE notifications implemented  
✅ **Code Consistency**: Follows existing patterns  
✅ **Database-Stored Config**: Site configurations in DynamoDB  

## Migration Status
- ✅ Existing NETSYNC site tokens migrated to SSM
- ✅ Database updated to remove tokens
- ✅ API updated to use SSM
- ✅ App Runner configurations updated
- ✅ SSM parameters created as String type for App Runner compatibility