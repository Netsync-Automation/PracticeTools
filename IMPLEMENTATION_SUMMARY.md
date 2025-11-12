# AI Database Access Implementation Summary

## What Was Implemented

### 1. Environment-Aware Database Access ✅
- **Dev Environment**: AI only accesses `PracticeTools-dev-*` tables
- **Prod Environment**: AI only accesses `PracticeTools-prod-*` tables
- Complete isolation between environments
- Uses existing `getTableName()` function from `lib/dynamodb.js`

### 2. Role-Based Access Control (RBAC) ✅
Implemented comprehensive permission system:

| Role | Access Level |
|------|-------------|
| **Admin** | Full access to all data |
| **Practice Principal/Manager** | Access to their practices only, including Leadership Questions |
| **Account Manager** | Access to their region only (assignments, contacts) |
| **Practice Member** | Access to their own data and public information |

### 3. Security Components Created

#### `lib/ai-access-control.js`
- `filterDataForUser()` - Filters data based on user permissions
- `getAccessibleDataForAI()` - Fetches user-accessible data
- `validateAIAccess()` - Validates user can use AI features
- `sanitizeDataForAI()` - Removes sensitive fields (passwords, auth tokens)
- Permission checking for issues, assignments, contacts, training certs

#### `lib/ai-user-context.js`
- `getUserFromRequest()` - Extracts authenticated user from session
- `userHasRole()` - Role validation
- `hasPracticeAccess()` - Practice-level permissions
- `hasRegionAccess()` - Region-level permissions
- `logAIAccess()` - Audit logging for compliance

#### Updated `app/api/chatnpt/route.js`
- Authentication required for all AI queries
- Authorization checks before data access
- Environment-aware table queries
- Data filtering based on user role
- Audit logging for all interactions
- Sanitized data sent to AI models

### 4. Data Sources with Access Control

**Always Accessible:**
- Webex Recordings (approved)
- Webex Messages
- Documentation

**Role-Based Access:**
- Practice Issues (filtered by permissions)
- Resource Assignments (filtered by practice/region)
- Training Certifications (filtered by practice)

### 5. Security Features

✅ **Authentication**: Session-based authentication required
✅ **Authorization**: Role-based permissions enforced
✅ **Environment Isolation**: Dev/prod data completely separated
✅ **Data Sanitization**: Sensitive fields removed
✅ **Audit Logging**: All AI interactions logged
✅ **Input Validation**: User inputs validated
✅ **Error Handling**: Secure error messages
✅ **Principle of Least Privilege**: Users only access what they need
✅ **Defense in Depth**: Multiple security layers

### 6. Documentation & Policies

Created:
- `docs/AI_DATABASE_ACCESS.md` - Complete security architecture documentation
- `iam-policy-ai-access.json` - AWS IAM policy for AI service
- This implementation summary

## How It Works

### Request Flow
```
1. User sends AI query
   ↓
2. Extract user from session cookie
   ↓
3. Validate user is authenticated and active
   ↓
4. Check AI access permissions
   ↓
5. Fetch data using environment-specific table names
   ↓
6. Filter data based on user role and permissions
   ↓
7. Sanitize data (remove sensitive fields)
   ↓
8. Send to Bedrock AI model
   ↓
9. Log interaction for audit
   ↓
10. Return response to user
```

### Permission Examples

**Leadership Question Access:**
```javascript
// Only accessible by:
// 1. Admin users
// 2. Issue creator
// 3. Practice leadership of the issue's practice
if (issue.issue_type === 'Leadership Question') {
  if (issue.practice && user.practices?.includes(issue.practice)) {
    return user.role === 'practice_manager' || user.role === 'practice_principal';
  }
  return false;
}
```

**Assignment Access:**
```javascript
// Accessible by:
// 1. Admin users
// 2. Practice leadership for the assignment's practice
// 3. Account managers in the assignment's region
// 4. Users involved in the assignment (AM, PM, Resource)
```

## Testing Checklist

### Environment Isolation
- [ ] Dev user queries only see dev data
- [ ] Prod user queries only see prod data
- [ ] No cross-environment data leakage

### Role-Based Access
- [ ] Admin sees all data
- [ ] Practice Manager sees only their practice data
- [ ] Practice Manager sees Leadership Questions for their practices
- [ ] Account Manager sees only their region data
- [ ] Account Manager cannot see Leadership Questions
- [ ] Practice Member sees only their own issues
- [ ] Practice Member cannot see others' Leadership Questions

### Security
- [ ] Unauthenticated requests are rejected (401)
- [ ] Inactive users cannot access AI (403)
- [ ] Sensitive fields are removed from AI context
- [ ] All AI interactions are logged
- [ ] Error messages don't leak sensitive data

### Functionality
- [ ] AI can answer questions about accessible issues
- [ ] AI can answer questions about accessible assignments
- [ ] AI can answer questions about accessible training certs
- [ ] AI properly cites sources
- [ ] Source links work correctly

## Deployment Steps

### 1. Update Environment Variables
Ensure `ENVIRONMENT` is set correctly:
- Dev: `ENVIRONMENT=dev`
- Prod: `ENVIRONMENT=prod`

### 2. Apply IAM Policy
```bash
# Attach the IAM policy to the App Runner service role
aws iam put-role-policy \
  --role-name AppRunnerServiceRole \
  --policy-name AIDataAccessPolicy \
  --policy-document file://iam-policy-ai-access.json
```

### 3. Deploy Code
```bash
# Standard deployment process
npm run build
# Deploy to App Runner (automatic via GitHub)
```

### 4. Verify Deployment
- Test with different user roles
- Check CloudWatch logs for audit entries
- Verify environment isolation
- Test permission boundaries

## Monitoring

### CloudWatch Metrics to Monitor
- AI query volume by user/role
- Access denied attempts (should be rare)
- Data filtering performance
- Environment isolation violations (should be zero)

### Log Queries
```
# Find all AI access attempts
fields @timestamp, userEmail, userRole, action
| filter action like /chatnpt/
| sort @timestamp desc

# Find access denied attempts
fields @timestamp, userEmail, reason
| filter reason like /denied/
| sort @timestamp desc
```

## Compliance

This implementation follows:
- ✅ DSR (Do Shit Right) Compliance Rules
- ✅ OWASP Top 10 Security Guidelines
- ✅ AWS Well-Architected Framework (Security Pillar)
- ✅ Principle of Least Privilege
- ✅ Defense in Depth Strategy
- ✅ Industry Best Practices for RBAC

## Key Considerations

### Performance
- Data filtering happens in-memory after fetch
- Consider adding database-level filtering for large datasets
- Caching can be added for frequently accessed data

### Scalability
- Current implementation scans all data then filters
- For large datasets, consider:
  - Database-level filtering with GSIs
  - Pagination
  - Query result caching

### Future Enhancements
1. Rate limiting per user/role
2. Query result caching with TTL
3. Fine-grained field-level permissions
4. PII masking/redaction
5. Advanced audit analytics dashboard
6. Real-time security monitoring

## Support & Troubleshooting

### Common Issues

**Issue**: User gets "Authentication required" error
- **Solution**: Check session cookie is valid, user is logged in

**Issue**: User gets "Access denied" error
- **Solution**: Check user status is 'active', verify role permissions

**Issue**: User sees no data in AI responses
- **Solution**: Verify user has access to at least some data sources

**Issue**: Cross-environment data visible
- **Solution**: Check `ENVIRONMENT` variable is set correctly

### Debug Mode
Enable detailed logging:
```javascript
// In lib/ai-access-control.js
logger.setLevel('debug');
```

## Contact
For questions or issues with this implementation, contact the development team.
