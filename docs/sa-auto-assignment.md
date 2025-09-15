# SA Auto-Assignment Feature

## Overview

The SA Auto-Assignment feature automatically matches SA assignments to Solutions Architects (SAs) based on the SA to AM Mapping database. When an SA assignment has both an Account Manager (AM) and Practice(s) identified, the system can automatically assign the appropriate SAs and update the region based on the mapping configuration.

## How It Works

### 1. Trigger Conditions
The auto-assignment process is triggered when:
- An SA assignment is created via email processing (automatic)
- A user manually triggers auto-assignment via the UI button (manual)

### 2. Matching Logic
The system performs the following steps:

1. **Validation**: Checks if the SA assignment has both AM and Practice(s) identified
2. **Database Query**: Retrieves all SA to AM mappings from the database
3. **Filtering**: Finds mappings where:
   - The AM name matches exactly
   - At least one practice overlaps between the assignment and mapping
4. **Assignment**: Extracts unique SA names and determines the region
5. **Update**: Updates the SA assignment with:
   - Assigned SAs (comma-separated if multiple)
   - Region from the mapping
   - Status changed to "Assigned"
   - Date assigned set to current date

### 3. Multiple SA Handling
- **Multiple Practices**: If an SA assignment has multiple practices, SAs from different practices can be assigned
- **Multiple SAs per Practice**: If multiple SAs are mapped to the same AM and practice, all will be assigned
- **Unique SAs**: Duplicate SA names are automatically removed

## Usage

### Automatic Processing
Auto-assignment runs automatically when SA assignments are created via email processing. The system will:
- Process the email and create the SA assignment
- Immediately attempt auto-assignment if AM and Practice are identified
- Log the results for monitoring

### Manual Triggering
Users can manually trigger auto-assignment from the SA assignment detail page:

1. Navigate to the SA assignment detail page
2. Ensure the assignment has AM and Practice identified
3. Click the "Auto-Assign" button (appears only when conditions are met)
4. Review the results in the alert message
5. The page will refresh to show updated assignment details

### API Endpoint
Auto-assignment can also be triggered via API:

```javascript
POST /api/sa-assignments/auto-assign
Content-Type: application/json

{
  "saAssignmentId": "assignment-id-here"
}
```

## Configuration Requirements

### SA to AM Mapping Database
The feature requires properly configured SA to AM mappings with:
- **SA Name**: Name of the Solutions Architect
- **AM Name**: Name of the Account Manager (must match exactly)
- **Practices**: Array of practice names that the SA supports for this AM
- **Region**: Region associated with this mapping

### Practice Matching
- Practice names must match exactly between SA assignments and mappings
- Multiple practices are supported (comma-separated in assignments)
- At least one practice must overlap for a match

## Error Handling

The system handles various error conditions gracefully:

### No Matching SAs
- **Condition**: No SA to AM mappings found for the given AM and practices
- **Result**: Assignment remains unchanged, informational message logged
- **User Impact**: No automatic assignment occurs, manual assignment still possible

### Missing AM or Practice
- **Condition**: SA assignment lacks AM or Practice information
- **Result**: Auto-assignment skipped, normal processing continues
- **User Impact**: Assignment processed normally without auto-assignment

### Database Errors
- **Condition**: Database connectivity or query issues
- **Result**: Error logged, assignment creation still succeeds
- **User Impact**: Manual assignment required, auto-assignment can be retried

## Monitoring and Logging

The system provides comprehensive logging for troubleshooting:

### Success Logs
```
SA auto-assignment completed successfully
- SA Assignment ID: xxx
- Assigned SAs: [SA1, SA2]
- Region: TX-DAL
- Message: Auto-assigned 2 SA(s) and updated region to TX-DAL
```

### Skip Logs
```
SA assignment missing AM or Practice - skipping auto-assignment
- SA Assignment ID: xxx
- Has AM: true/false
- Has Practice: true/false
```

### Error Logs
```
SA auto-assignment failed but SA assignment was created
- SA Assignment ID: xxx
- Error: [error message]
```

## Testing

### Test Script
Use the provided test script to verify functionality:

```bash
node scripts/test-sa-auto-assignment.js
```

The test script will:
1. Find suitable SA assignments for testing
2. Run auto-assignment process
3. Verify results
4. Test error conditions

### Manual Testing
1. Create SA to AM mappings in the database
2. Create or import SA assignments with matching AM and practices
3. Trigger auto-assignment manually or via email
4. Verify SAs are assigned correctly and region is updated

## DSR Compliance

This feature follows DSR (Do Shit Right) compliance rules:

### 1. Environment Awareness
- Uses environment-specific table names via `getTableName()`
- Works in both dev and prod environments

### 2. Database-Stored Configuration
- All mappings stored in database, not hardcoded
- Dynamic retrieval of SA to AM mappings

### 3. Code Reusability
- Reuses existing database operations and patterns
- Extends existing SA assignment functionality

### 4. Minimal Code Implementation
- Focused utility class with single responsibility
- Minimal changes to existing codebase

### 5. Error Handling
- Graceful degradation when auto-assignment fails
- Comprehensive logging for troubleshooting

## Future Enhancements

Potential improvements for future versions:

1. **Priority-based Assignment**: Assign SAs based on workload or priority
2. **Skill Matching**: Consider SA skills in addition to practice mapping
3. **Notification System**: Notify assigned SAs automatically
4. **Bulk Processing**: Process multiple assignments simultaneously
5. **Analytics**: Track auto-assignment success rates and patterns