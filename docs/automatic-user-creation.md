# Automatic User Creation for SA Assignments

## Overview

When SA assignments are created (either manually or automatically through email processing), the system now automatically checks if the Account Manager (AM) and ISR users exist in the system. If they don't exist, new user accounts are created automatically.

## How It Works

### User Detection
- The system parses AM and ISR fields from SA assignments
- Supports formats like:
  - `John Smith <jsmith@example.com>`
  - `jsmith@example.com`

### User Creation Process
1. **Check Existence**: System checks if user already exists by email
2. **Create if Missing**: If user doesn't exist, creates new user with:
   - **Source**: `SYSTEM` (indicates auto-created)
   - **Auth Method**: `SSO` (Single Sign-On)
   - **Role**: `account_manager` for AM field, `isr` for ISR field
   - **Status**: `active`
   - **Practices**: Empty array (company-wide roles)

### When It Triggers
- **Manual SA Assignment Creation**: Via the web interface
- **Email Processing**: When SA assignments are created from emails
- **API Calls**: When SA assignments are created via API

## Implementation Details

### Files Modified
- `lib/user-manager.js` - New utility for user management
- `app/api/sa-assignments/route.js` - Manual creation flow
- `lib/email-processor.js` - Email processing flow
- `lib/dynamodb.js` - Database layer integration

### Key Functions
- `ensureUserExists(userString, role)` - Ensures a single user exists
- `processAmIsrUsers(am, isr)` - Processes both AM and ISR users
- `parseUserString(userString)` - Parses user strings to extract name/email

## DSR Compliance

This feature follows DSR (Do Shit Right) compliance rules:

✅ **Environment Awareness**: Uses environment-specific table names  
✅ **Security Best Practices**: No hardcoded values, proper validation  
✅ **Code Reusability**: Reuses existing user creation patterns  
✅ **Modern UX**: Seamless user experience with automatic user management  

## Testing

Run the test script to verify functionality:

```bash
node scripts/test-user-creation.js
```

## Logging

The system logs all user creation activities:
- User existence checks
- New user creation
- Processing results
- Any errors encountered

Check application logs for entries with:
- `ensureUserExists`
- `processAmIsrUsers`
- `Created new user from SA assignment`