# Issues Tracker - Complete Feature Inventory

**Last Updated:** 2025-08-26
**Version:** 1.2.0 - Corrected Semantic Versioning with Enhanced Classification System

## CRITICAL: Breaking Change Prevention Protocol
Before making ANY code change whatsoever (features, bug fixes, refactoring, optimization, etc.):
1. **READ THIS ENTIRE DOCUMENT** to understand all existing features
2. **IDENTIFY ALL AFFECTED SYSTEMS** for your planned change
3. **ANALYZE POTENTIAL BREAKING POINTS** across all integration layers
4. **🌐 ENSURE INDUSTRY BEST PRACTICES FOR WEB DEVELOPMENT** including:
   - Performance optimization and scalability
   - Accessibility compliance (WCAG guidelines)
   - Cross-browser compatibility and responsive design
   - SEO optimization and semantic HTML
   - Code maintainability and documentation
   - Error handling and graceful degradation
5. **🔒 ENSURE INDUSTRY BEST PRACTICES FOR SECURITY** across all affected technology stacks:
   - OWASP Top 10 vulnerability prevention
   - Input validation and output encoding
   - Authentication and authorization controls
   - Data encryption and secure transmission
   - Secure coding practices (React, Node.js, AWS, DynamoDB)
   - Privacy protection and data handling compliance
6. **TEST ALL RELATED FEATURES** after implementation
7. **MANDATORY: UPDATE THIS DOCUMENT** with ANY new/changed/deleted features - NO EXCEPTIONS

---

## Core Issue Management Features

### Issue Creation & Management
- **Create Issues**: Bug Report, Feature Request, General Question types
- **Duplicate Detection**: TF-IDF + Cosine Similarity algorithm for accurate duplicate detection
- **Duplicate Resolution**: Modal showing similar issues with upvote option
- **Issue Numbering**: Sequential auto-incrementing numbers (#1, #2, etc.)
- **Issue Status System**: Open → In Progress → Pending Testing → Backlog → Rejected → Closed
- **Issue Assignment System**: Admin-only dropdown to assign issues to admin users
- **Assignment Requirement**: Issues must be assigned before status can change from "Open"
- **Assignment Modal**: Friendly popup to assign admin when status change is attempted
- **Issue Content**: Title (100 chars), Description (1000 chars), Problem Links
- **File Attachments**: Images, PDFs, DOC, TXT, ZIP (5MB max, 5 files max)
- **Issue Editing**: Title/description editing by creator, status/assignment by admin only

### Issue Viewing & Navigation
- **Homepage Views**: Table view and Card view modes (localStorage preference)
- **Individual Issue Pages**: Full detail view with all information
- **Breadcrumb Navigation**: Context-aware navigation paths
- **Pagination**: 50 issues per page with navigation controls
- **Search & Filtering**: By type, status, search terms, sort by date/upvotes
- **User Filter Dropdown**: My Issues, My Follows, My Upvotes filtering
- **Column Sorting**: Clickable ID, Type, Status headers with asc/desc sorting
- **Clear Sort**: User-friendly clear button for column sorting
- **Clear Search**: X button to clear search input

### Issue Interaction Features
- **Upvoting System**: Users can upvote issues they agree with
- **Following System**: Auto-follow (creators/commenters) + manual follow/unfollow
- **Status History**: Complete audit trail of all status changes with timestamps
- **Upvoters Display**: Shows first 3 upvoters with full list on hover in issue details

---

## User Authentication & Authorization

### Authentication Methods
- **SAML SSO**: Primary authentication method
- **Local Auth**: Username/password with bcrypt hashing
- **Session Management**: HTTP-only cookies with validation
- **Multi-auth Support**: Handles both SSO and local users seamlessly

### Authorization & Roles
- **User Roles**: 'admin' and 'user' roles
- **Permission System**: 
  - Admins: Can change issue status, manage users, access admin features
  - Users: Can create issues, edit own content, comment, upvote, follow
- **Access Control**: Role-based UI hiding and API endpoint protection

---

## Real-time Communication (SSE)

### Server-Sent Events Implementation
- **Homepage SSE**: Live updates for all issues on homepage
- **Issue Page SSE**: Live updates for specific issue pages
- **Auto-reconnection**: Automatic reconnection on connection loss
- **Connection Health**: Heartbeat monitoring and status tracking

### Real-time Notifications
- **Issue Updates**: Status changes, content updates
- **New Comments**: Instant comment notifications with audio alerts
- **Upvote Updates**: Live upvote count updates
- **Browser Integration**: Tab flashing when page not visible
- **Audio Notifications**: Pleasant sound alerts for new comments

---

## Comment System

### Comment Features
- **Text Comments**: Rich text with emoji support
- **File Attachments**: Same file types as issues
- **Image Pasting**: Ctrl+V paste functionality for screenshots
- **Emoji Picker**: Quick emoji insertion interface
- **Admin Comments**: Special highlighting for admin responses

### Comment Management
- **Real-time Updates**: Instant comment appearance via SSE
- **Auto-scroll**: Automatic scroll to new comments
- **Comment Locking**: Comments disabled when issues are closed
- **Attachment Previews**: Inline image display and file download links

---

## Resolution Comments Feature

### Mandatory Resolution System
- **Closure Requirement**: Resolution comment required when closing issues
- **Modal Interface**: Dedicated modal for resolution comment entry
- **Character Limits**: 1000 character limit with counter
- **Database Storage**: Stored in `resolution_comment` field
- **Display Integration**: Shows in WebEx notifications and issue history

### Resolution Comment Integration Points
- **Database Layer**: `resolution_comment` field in issues table
- **API Layer**: `resolutionComment` parameter in PUT requests
- **WebEx Integration**: Resolution comments in adaptive cards
- **UI Layer**: Resolution modal and display components

---

## WebEx Integration

### Adaptive Card Notifications
- **New Issue Cards**: Full issue details with attachments info
- **Status Update Cards**: Before/after status with resolution comments
- **Card Styling**: Color-coded by status and issue type
- **Action Buttons**: Direct links to view issues

### Direct Messaging
- **Issue Creator Notifications**: Direct messages for status changes
- **Follower Notifications**: Messages to all followers when issues close
- **Resolution Comments**: Included in closure notifications
- **Auto-sync**: WebEx user synchronization after notifications

---

## Admin Features

### User Management
- **User CRUD**: Create, read, update, delete users
- **Role Management**: Assign admin/user roles
- **Authentication Method**: Support for both SAML and local users
- **Password Reset**: Admin can reset user passwords

### System Administration
- **Issue Renumbering**: Resequence all issue numbers
- **Settings Management**: App-wide configuration
- **Manual Releases**: Create release notes manually
- **Comprehensive Automated Versioning**: Full feature tracking with baseline initialization
- **Semantic Version Detection**: Automatic major/minor/patch determination based on changes
- **Intelligent Code Analysis Engine**: Advanced semantic versioning classification using code diff analysis
  - **Pattern Recognition**: Analyzes actual code changes (function signatures, API endpoints, error handling)
  - **Context-Aware Classification**: Understands the purpose and impact of code changes
  - **Confidence Scoring**: Provides confidence levels for classification decisions
  - **Reasoning Engine**: Explains why changes are classified as MAJOR/MINOR/PATCH
- **Industry-Standard Semantic Versioning Compliance**: Full adherence to SemVer 2.0.0 standards
  - **Breaking Change Validation**: Only true API/config/schema breaking changes trigger MAJOR versions
  - **Feature Classification**: New functionality and enhancements properly classified as MINOR
  - **Bug Fix Detection**: Error corrections and patches properly classified as PATCH
  - **Maintenance Recognition**: Documentation, refactoring, and style changes as NO VERSION
- **Interactive Commit Approval System**: Preview and approve commits before execution
  - **Version Preview**: Shows expected version number before committing
  - **Release Notes Preview**: Generates preview of release notes for user review
  - **User Approval**: Requires explicit approval before any commits are made
  - **Cancellation Support**: Allows users to cancel and modify changes
  - **SemVer Compliance Check**: Validates all commits against industry standards
- **Comprehensive Version Classification**: Enhanced detection for all semantic version types:
  - **Breaking Changes (MAJOR)**: API changes, authentication updates, schema modifications, deprecated removals
  - **New Features (MINOR)**: New functionality, UI enhancements, integrations, performance improvements
  - **Bug Fixes (PATCH)**: Error handling, issue resolution, validation fixes, security patches
  - **Maintenance (NO VERSION)**: Documentation, code style, refactoring, testing, build updates
- **Enhanced Pattern Matching**: 50+ patterns for accurate change classification across all version types
- **Feature Change Tracking**: Database-driven feature lifecycle management with proper semantic versioning
- **Post-Deployment Processing**: App Runner integration for automatic versioning
- **Enhanced Release Notes Generation**: Visually appealing, non-technical release notes with emojis and user-friendly language
- **Custom Release Templates**: Handlebars templates for consistent, professional release note formatting
- **Commit Message Humanization**: Automatic conversion of technical commits to user-friendly descriptions
- **Categorized Release Notes**: Organized by feature type with visual icons and clear sections
- **Dynamic Help Content Generation**: Automatically generated help documentation based on feature inventory
- **UI Version Display**: Automatic version updates in navbar and help pages
- **Status Override**: Admin can change any issue status
- **Assigned Issues Dashboard**: Full-featured table showing issues assigned to admin
- **Admin Issue Management**: Search, filter, paginate assigned issues with all homepage features

---

## Database Layer (DynamoDB)

### Table Structure
- **PracticeTools-Issues**: Main issues with resolution_comment field
- **PracticeTools-Users**: User accounts and roles
- **PracticeTools-Upvotes**: Issue upvote tracking
- **PracticeTools-Followers**: Follow status tracking
- **PracticeTools-StatusLog**: Status change audit trail
- **PracticeTools-Settings**: Application configuration
- **PracticeTools-Releases**: Release notes storage

### Critical Database Methods
- **addIssue()**: Creates issues with resolution_comment and assigned_to fields
- **updateIssueStatus()**: Updates status + resolution_comment + admin + timestamp
- **updateIssueAssignment()**: Updates assigned_to field (admin only)
- **formatIssueItem()**: Includes resolution_comment and assigned_to in returned data
- **getIssueUpvoters()**: Gets list of users who upvoted a specific issue
- **getUserFollows()**: Gets issues a user is following with proper status filtering
- **All methods**: Must handle resolution_comment and assigned_to fields consistently

---

## API Endpoints

### Issue Management APIs
- **GET /api/issues**: List all issues with pagination
- **POST /api/issues**: Create new issue with attachments
- **POST /api/issues/check-duplicates**: Check for similar existing issues
- **POST /api/issues/upvote-duplicate**: Upvote existing issue when duplicate found
- **GET /api/issues/[id]**: Get single issue details
- **PUT /api/issues/[id]**: Update issue (status/content/assignment) with resolutionComment support
- **GET /api/admin/get-admins**: Get list of admin users for assignment dropdown
- **POST /api/issues/[id]/comments**: Add comments with attachments
- **POST /api/issues/[id]/follow**: Follow/unfollow issues
- **GET /api/issues/[id]/status-history**: Get status change history
- **GET /api/issues/[id]/upvoters**: Get list of users who upvoted an issue
- **GET /api/user/follows**: Get issues the current user is following
- **GET /api/user/upvotes**: Get issues the current user has upvoted

### Authentication APIs
- **POST /api/auth/login**: Local authentication
- **GET /api/auth/check-session**: Session validation with isAdmin property
- **POST /api/auth/logout**: Session termination
- **SAML endpoints**: SSO authentication flow

### Admin APIs
- **GET /api/admin/list-users**: User management
- **GET /api/admin/assigned-issues**: Get issues assigned to current admin
- **POST /api/admin/renumber-issues**: Issue renumbering
- **POST /api/auto-release**: Automated release creation with versioning
- **GET /api/auto-release**: Get current version information
- **Settings APIs**: Configuration management

---

## Timezone Management System

### User Timezone Detection
- **Automatic Detection**: Browser timezone detection using Intl.DateTimeFormat API
- **Fallback Support**: Environment variable DEFAULT_TIMEZONE for server-side operations
- **Client Persistence**: localStorage caching for consistent timezone across sessions
- **Cross-Platform**: Works in both local development and AWS App Runner production

### Timestamp Conversion
- **TimezoneManager Class**: Centralized timezone handling with comprehensive formatting options
- **TimestampDisplay Component**: Reusable React component for consistent timestamp display
- **useTimezone Hook**: React hook for timezone management in client components
- **Relative Time**: Smart relative formatting ("2h ago", "3d ago") with full timestamp tooltips
- **WebEx Integration**: Consistent timezone formatting in all WebEx notifications

### Implementation Coverage
- **Homepage**: All issue timestamps converted to user timezone
- **Issue Pages**: Creation dates, update times, and comment timestamps
- **Comment System**: Real-time comment timestamps in user timezone
- **WebEx Notifications**: All notification timestamps in consistent format
- **Status History**: Complete audit trail with timezone-aware timestamps
- **Admin Dashboard**: All administrative timestamps converted

## UI/UX Components

### Core Components
- **Navbar**: Navigation with user info and logout
- **AccessCheck**: Role-based access control wrapper
- **Breadcrumb**: Navigation context
- **Pagination**: Page navigation controls
- **AttachmentViewer/Preview**: File handling components
- **TimestampDisplay**: Timezone-aware timestamp component with tooltips

### Issue Components
- **IssueTable**: Tabular issue display with timezone-converted timestamps
- **IssueCard**: Card-based issue display with relative time formatting
- **FollowButton**: Issue following interface
- **ConversationSection**: Comment system with SSE integration and timezone support

### Modal Components
- **Assignment Modal**: Required assignment selection before status changes
- **Resolution Modal**: Mandatory resolution comment interface
- **Status History Modal**: Status change timeline with timezone-aware timestamps
- **Attachment Modals**: File viewing interfaces

---

## File Storage & Management

### S3 Integration
- **File Upload**: Multi-file upload with validation
- **File Storage**: S3 bucket with presigned URLs
- **File Types**: Images, PDFs, documents, archives
- **Size Limits**: 5MB per file, 5 files per upload
- **File Serving**: Secure file access via API endpoints

---

## Critical Integration Points

### SSE + Resolution Comments
- **Status Updates**: Must include resolution comments in SSE messages
- **WebEx Integration**: Resolution comments must flow to WebEx cards
- **Database Consistency**: All update methods must handle resolution_comment

### Authentication + Admin Features
- **isAdmin Property**: Must be set in auth validation for admin features to work
- **Role Checking**: All admin endpoints must verify user.isAdmin
- **UI Permissions**: Admin-only UI elements must check user.isAdmin

### Real-time + Database
- **SSE Triggers**: All database updates must trigger appropriate SSE notifications
- **Data Consistency**: SSE updates must reflect actual database state
- **Connection Management**: SSE must handle reconnections gracefully

---

## Breaking Change Prevention Checklist

Before ANY code change (no matter how small):
- [ ] Read this entire feature inventory
- [ ] Identify all systems affected by your change
- [ ] Check parameter compatibility across all method calls
- [ ] **🌐 Web Development Best Practices Compliance:**
  - [ ] Performance: No blocking operations, optimized rendering
  - [ ] Accessibility: ARIA labels, keyboard navigation, screen reader support
  - [ ] Responsive: Mobile-first design, cross-browser compatibility
  - [ ] SEO: Semantic HTML, proper meta tags, structured data
  - [ ] Maintainability: Clean code, proper documentation, error handling
- [ ] **🔒 Security Best Practices Compliance:**
  - [ ] OWASP: No injection, broken auth, sensitive data exposure vulnerabilities
  - [ ] Input Validation: All user inputs sanitized and validated
  - [ ] Authorization: Proper role-based access controls maintained
  - [ ] Data Protection: Encryption in transit/rest, secure storage
  - [ ] Secure Coding: No hardcoded secrets, proper error handling
  - [ ] Privacy: GDPR/CCPA compliance, data minimization
- [ ] Verify SSE integration points remain intact
- [ ] Ensure WebEx integration continues working
- [ ] Test database consistency
- [ ] Verify UI components receive required props
- [ ] Test admin vs user permission boundaries
- [ ] Check React hooks and dependency arrays
- [ ] Verify API endpoint compatibility
- [ ] Test real-time features (SSE, notifications)
- [ ] **MANDATORY: Update this document with ANY new/changed/deleted features**
- [ ] **MANDATORY: Update version number and last updated date**

---

**CRITICAL ENFORCEMENT: This document MUST be consulted before EVERY SINGLE CODE CHANGE (features, bug fixes, refactoring, optimization, logging changes, etc.) and MUST be updated with EVERY new/changed/deleted feature - NO EXCEPTIONS. Failure to update this inventory is a breaking change prevention protocol violation.**