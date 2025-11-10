# DSR (Do Shit Right) Compliance Rules

## MANDATORY: New Code DSR Compliance
Implement all new code following DSR rules from the start. Run DSR compliance analysis only when specifically requested.

## 8 Core Requirements:

### 1. Environment Awareness
- All database tables must use environment-specific naming: `PracticeTools-{env}-TableName`
- APIs must work in both dev and prod environments
- Use `getEnvironment()` and `getTableName()` functions from lib/dynamodb.js
- Never hardcode environment-specific values

### 2. Database-Stored Dropdowns
- Store all dropdown options in database tables, not hardcoded arrays
- Create proper CRUD operations for dropdown management
- Use environment-aware table names for dropdown storage

### 3. Security Best Practices
- Use AccessCheck component for page-level authentication
- Implement input sanitization (trim, validation)
- Never hardcode secrets - use process.env or SSM parameters
- Validate user permissions before data access

### 4. Real-time Updates (SSE) - MANDATORY Implementation
- **REQUIRED**: All data that can be modified by multiple users MUST implement Server-Sent Events
- **Examples requiring SSE**: User lists, issue tracking, shared forms, status updates, notifications
- **Implementation checklist**:
  - Add SSE endpoint in API route (e.g., `/api/sse/[feature]`)
  - Emit events on all CREATE, UPDATE, DELETE operations
  - Use EventSource on frontend to consume real-time updates
  - Update UI immediately when SSE events are received
- **No exceptions**: If data can change while a user is viewing it, SSE is mandatory
- **Pattern**: Follow existing SSE implementations in `/api/sse/` directory
- **Testing**: Verify real-time updates work across multiple browser tabs before deployment

### 5. Temporary Script Cleanup
- Delete any temporary files (test-*, debug-*, temp-*) after use
- Remove debugging scripts when troubleshooting is complete

### 6. Debug Code Cleanup
- Remove console.log statements before committing
- Clean up debug comments (// DEBUG, // TODO: REMOVE)
- Disable verbose logging after problem resolution
- **Exception**: Debug statements are allowed during active troubleshooting but must be removed once the issue is resolved

### 7. Code Consistency
- When creating new code, features, functions or APIs, always use the existing codebase as a guide for implementation consistency
- Make new frontend/UI additions or changes look and feel the same as the rest of the application
- Follow existing patterns for component structure, styling, and user interactions

### 8. Code Reusability
- Always look to re-use existing API routes, functions and features if they already exist for what you are trying to accomplish
- Avoid creating duplicate functionality that leads to bloated, unnecessary code
- Extend existing components and utilities rather than creating new ones when possible

### 9. Modern User Experience Design
- All frontend/UI changes must prioritize user-friendly, intuitive design
- Implement modern UI patterns: searchable dropdowns, hover states, smooth transitions
- Ensure accessibility with proper focus handling, keyboard navigation, and visual feedback
- Use consistent styling, spacing, and visual hierarchy throughout the application
- Provide clear user feedback for actions (loading states, success/error messages, tooltips)

## Code Patterns to Follow:
- Database operations: Use existing patterns in `lib/dynamodb.js`
- API routes: Follow structure in `app/api/*/route.js`
- Frontend components: Use hooks from `hooks/` directory
- Authentication: Use `useAuth` hook and `AccessCheck` component

## Enforcement:
This rule is automatically included in every Amazon Q interaction to ensure consistent compliance.