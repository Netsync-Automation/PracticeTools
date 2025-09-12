# Practice Board Permissions Troubleshooting Guide

## Issue Description
Users authenticated via SAML are not loading their correct practice board by default and cannot add topics, while local users work correctly.

## Debugging Steps

### 1. **Access Debug Analysis**
- Navigate to Practice Information page
- Click the debug button (circle with checkmark) next to the settings gear
- This will show detailed user and board analysis

### 2. **Check User Data Integrity**
Compare the debug output between working local user and non-working SAML user:

**Key Fields to Compare:**
- `user.practices` - Should contain user's assigned practices
- `user.role` - Should be 'practice_principal' for topic creation
- `practiceBoards.expectedBoardId` - Generated board ID based on practices
- `practiceBoards.hasExpectedBoard` - Whether the expected board exists
- `permissions.canAddTopics` - Should be true for practice principals

### 3. **Verify User Database Record**
Check the user record in DynamoDB:
```bash
# Access debug endpoint directly
curl https://your-app-url/api/debug/user-analysis
```

### 4. **Check Practice Board Generation**
The system generates board IDs using this logic:
```javascript
// Expected format: practices sorted, joined with '-', lowercased, cleaned
userPractices.sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '')
```

### 5. **Common Issues & Solutions**

#### **Issue: User has no practices assigned**
- **Symptom**: `user.practices` is empty or null
- **Solution**: Update user record in User Management to assign correct practices

#### **Issue: Practice board doesn't exist**
- **Symptom**: `hasExpectedBoard` is false
- **Solution**: Run "Create Practice Boards" in Admin Settings → Practice Information

#### **Issue: Board ID mismatch**
- **Symptom**: Expected board ID doesn't match any existing boards
- **Solution**: Check practice name formatting (case sensitivity, special characters)

#### **Issue: Role permissions incorrect**
- **Symptom**: `canAddTopics` is false despite being practice principal
- **Solution**: Verify user role is exactly 'practice_principal' (not 'Practice Principal')

### 6. **SAML vs Local User Differences**
Check these specific areas:

**User Creation Source:**
- Local users: `created_from: 'manual'`
- SAML users: `created_from: 'saml'` or `created_from: 'webex_sync'`

**Practice Assignment:**
- Ensure SAML users have practices properly assigned during sync
- Check WebEx bot configuration includes correct practices

**Role Mapping:**
- Verify SAML attribute mapping assigns correct roles
- Check if role is being overridden during SAML login

### 7. **Manual Verification Steps**

1. **Check User Record:**
   - Go to Admin → Settings → User Management
   - Find the SAML user (rloge@netsync.com)
   - Verify practices and role are correct

2. **Check Available Boards:**
   - Use debug analysis to see all available boards
   - Verify expected board exists with correct practice names

3. **Test Board Selection:**
   - Manually select the correct board from dropdown
   - Check if topic creation works after manual selection

### 8. **Console Logging**
Enhanced logging has been added to track:
- User data loading
- Board matching logic
- Default board selection
- Permission calculations

Check browser console for detailed logs prefixed with `🔍 [FRONTEND]` and `🔍 [API]`

### 9. **Expected Behavior**
For user `rloge@netsync.com` with Data Center practice:
- Should load board with ID: `datacenter` or `data-center`
- Should have `canAddTopics: true` as practice principal
- Should default to Data Center board, not first alphabetical board

### 10. **Quick Fixes**

**If user has correct practices but wrong board loads:**
```javascript
// Check if board ID generation matches existing boards
// Expected: user.practices = ['Data Center']
// Generated ID: 'data-center'
// Existing board might be: 'datacenter'
```

**If permissions are wrong:**
- Verify user.role === 'practice_principal'
- Check user.practices includes the board's practices
- Ensure user.isAdmin is not interfering

## Next Steps
1. Run debug analysis on both working and non-working users
2. Compare the output to identify differences
3. Focus on user.practices, role, and board matching logic
4. Check database records for data integrity issues