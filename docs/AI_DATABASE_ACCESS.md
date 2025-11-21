# AI Database Access - Security & Architecture

## Overview
This document describes the secure, environment-aware database access implementation for ChatGPT/Bedrock AI features in Practice Tools.

## Security Architecture

### 1. Environment Isolation
- **Dev Environment**: AI only accesses `PracticeTools-dev-*` tables
- **Prod Environment**: AI only accesses `PracticeTools-prod-*` tables
- Environment determined by `process.env.ENVIRONMENT` variable
- No cross-environment data access possible

### 2. Role-Based Access Control (RBAC)

#### Admin
- Full access to all data across all practices and regions
- Can view Leadership Questions from all practices
- Access to all assignments, contacts, and training certifications

#### Practice Principal / Practice Manager
- Access to data for their assigned practices only
- Can view Leadership Questions for their practices
- Access to assignments for their practices
- Access to contacts/companies for their practice groups
- Access to training certifications for their practices

#### Account Manager
- Access to assignments in their assigned region only
- Access to contacts/companies in their region
- Cannot access Leadership Questions
- Limited to region-specific data

#### Practice Member
- Access to their own created issues
- Access to public (non-Leadership) questions
- Access to assignments where they are involved (AM, PM, or Resource)
- Cannot access Leadership Questions unless they created them
- Limited training certification access

### 3. Data Filtering

All database queries are filtered based on user permissions:

```javascript
// Example: Issues filtering
function canAccessIssue(issue, user) {
  if (user.isAdmin) return true;
  if (issue.email === user.email) return true;
  
  if (issue.issue_type === 'Leadership Question') {
    if (issue.practice && user.practices?.includes(issue.practice)) {
      return user.role === 'practice_manager' || user.role === 'practice_principal';
    }
    return false;
  }
  
  return true;
}
```

### 4. Data Sanitization

Before sending data to AI models, sensitive fields are removed:
- `password`
- `auth_method`
- `require_password_change`
- Other PII as needed

## Implementation Components

### 1. Access Control Library (`lib/ai-access-control.js`)
- `filterDataForUser()` - Filters data based on user role
- `getAccessibleDataForAI()` - Fetches all accessible data for a user
- `validateAIAccess()` - Validates user can use AI features
- `sanitizeDataForAI()` - Removes sensitive fields

### 2. User Context Middleware (`lib/ai-user-context.js`)
- `getUserFromRequest()` - Extracts authenticated user from request
- `userHasRole()` - Checks if user has required role
- `hasPracticeAccess()` - Validates practice access
- `hasRegionAccess()` - Validates region access
- `logAIAccess()` - Audit logging for AI interactions

### 3. Updated API Routes
- `/api/chatnpt/route.js` - Main AI query endpoint with access control

## Data Sources Available to AI

### Always Accessible (All Users)
1. **Webex Recordings** - Approved recordings with transcripts
2. **Webex Messages** - Team messages and attachments
3. **Documentation** - Uploaded company documentation

### Role-Based Access
4. **Practice Issues** - Filtered by user permissions
5. **Resource Assignments** - Filtered by practice/region
6. **Training Certifications** - Filtered by practice

## Authentication Flow

```
1. User makes AI query request
   ↓
2. Extract session cookie from request
   ↓
3. Validate session and fetch user from database
   ↓
4. Check user status (must be 'active')
   ↓
5. Validate AI access permissions
   ↓
6. Fetch data with environment-aware table names
   ↓
7. Filter data based on user role and permissions
   ↓
8. Sanitize data (remove sensitive fields)
   ↓
9. Send filtered data to AI model
   ↓
10. Log access for audit trail
   ↓
11. Return AI response to user
```

## Audit Logging

All AI interactions are logged with:
- User email and name
- User role
- Action performed
- Timestamp
- Environment (dev/prod)
- Query details (question length, sources count, etc.)

Logs are written to CloudWatch via `safe-logger.js`.

## AWS IAM Permissions

The application requires the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/PracticeTools-dev-*",
        "arn:aws:dynamodb:us-east-1:*:table/PracticeTools-prod-*"
      ],
      "Condition": {
        "StringEquals": {
          "dynamodb:LeadingKeys": ["${aws:PrincipalTag/Environment}"]
        }
      }
    }
  ]
}
```

## Security Best Practices Implemented

1. ✅ **Principle of Least Privilege** - Users only access data they need
2. ✅ **Environment Isolation** - Dev and prod data completely separated
3. ✅ **Authentication Required** - All AI requests require valid session
4. ✅ **Authorization Checks** - Role-based permissions enforced
5. ✅ **Data Sanitization** - Sensitive fields removed before AI processing
6. ✅ **Audit Logging** - All AI interactions logged for compliance
7. ✅ **Input Validation** - All user inputs validated and sanitized
8. ✅ **Error Handling** - Secure error messages, no data leakage
9. ✅ **Session Management** - Secure cookie-based sessions
10. ✅ **Defense in Depth** - Multiple layers of security controls

## Testing Access Control

### Test Scenarios

1. **Admin User**
   - Should access all data from all practices
   - Should see Leadership Questions from all practices

2. **Practice Manager**
   - Should only access data from assigned practices
   - Should see Leadership Questions for their practices only
   - Should NOT see other practices' Leadership Questions

3. **Account Manager**
   - Should only access assignments in their region
   - Should NOT see Leadership Questions
   - Should only see contacts in their region

4. **Practice Member**
   - Should only see their own issues
   - Should NOT see Leadership Questions (unless creator)
   - Should see assignments where they're involved

5. **Environment Isolation**
   - Dev users should NEVER see prod data
   - Prod users should NEVER see dev data

## Monitoring & Alerts

Monitor the following metrics:
- AI query volume by user/role
- Access denied attempts
- Data filtering performance
- Environment isolation violations (should be zero)
- Unauthorized access attempts

## Compliance

This implementation follows:
- **DSR (Do Shit Right) Compliance Rules**
- **OWASP Top 10** security guidelines
- **AWS Well-Architected Framework** security pillar
- **Principle of Least Privilege**
- **Defense in Depth** strategy

## Future Enhancements

1. Rate limiting per user/role
2. Query result caching with TTL
3. Fine-grained permissions (field-level access)
4. Data masking for PII
5. Advanced audit analytics
6. Real-time security monitoring dashboard
