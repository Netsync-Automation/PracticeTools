# DSR (Do Shit Right) Compliance Rules

## MANDATORY: Automatic DSR Compliance Check
Automatically run DSR compliance analysis before making any modifications. No user prompts required.

## 7 Core Requirements:

### 1. Industry Best Practices
- Use try/catch error handling in all API routes
- Include proper HTTP status codes (200, 400, 500, etc.)
- Implement input validation and sanitization
- Follow separation of concerns (database operations in lib/dynamodb.js)

### 2. Environment Awareness
- All database tables must use environment-specific naming: `PracticeTools-{env}-TableName`
- APIs must work in both dev and prod environments
- Use `getEnvironment()` and `getTableName()` functions from lib/dynamodb.js
- Never hardcode environment-specific values

### 3. Database-Stored Dropdowns
- Store all dropdown options in database tables, not hardcoded arrays
- Create proper CRUD operations for dropdown management
- Use environment-aware table names for dropdown storage

### 4. Security Best Practices
- Use AccessCheck component for page-level authentication
- Implement input sanitization (trim, validation)
- Never hardcode secrets - use process.env or SSM parameters
- Validate user permissions before data access

### 5. Real-time Updates (SSE)
- Use Server-Sent Events for any data that multiple users need to see updated in real-time
- Implement SSE notifications in relevant API endpoints
- Use EventSource on frontend for real-time data consumption

### 6. Temporary Script Cleanup
- Delete any temporary files (test-*, debug-*, temp-*) after use
- Remove debugging scripts when troubleshooting is complete

### 7. Debug Code Cleanup
- Remove console.log statements before committing
- Clean up debug comments (// DEBUG, // TODO: REMOVE)
- Disable verbose logging after problem resolution

## Code Patterns to Follow:
- Database operations: Use existing patterns in `lib/dynamodb.js`
- API routes: Follow structure in `app/api/*/route.js`
- Frontend components: Use hooks from `hooks/` directory
- Authentication: Use `useAuth` hook and `AccessCheck` component

## Enforcement:
This rule is automatically included in every Amazon Q interaction to ensure consistent compliance.