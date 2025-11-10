# ETA Data Flow Verification

## Complete Data Flow (Verified)

### Frontend Page
```
User visits /projects/resource-assignments
  ↓
fetchPracticeETAs() called
  ↓
fetch('/api/practice-etas')
  ↓
API: db.getPracticeETAs(practiceList)
  ↓
Calculates from AssignmentStatusLog (21-day window)
  ↓
Returns real-time ETAs
  ↓
Frontend displays ETAs
```

### Email Service
```
Status change triggers email
  ↓
sendPendingAssignmentNotification() or sendPracticeAssignedNotification()
  ↓
db.getPracticeETAs() called directly
  ↓
Calculates from AssignmentStatusLog (21-day window)
  ↓
Returns real-time ETAs
  ↓
Email includes fresh ETAs
```

## Verification Checklist

✅ **Frontend**: Calls `/api/practice-etas` → `db.getPracticeETAs()`
✅ **Email Service**: Calls `db.getPracticeETAs()` directly
✅ **API Endpoint**: Calls `db.getPracticeETAs()` with real-time calculation
✅ **Database Function**: Calculates from status log with 21-day window
✅ **No Old Table Usage**: Removed all functions that read/write to PracticeETAs table

## Removed Deprecated Functions

The following functions that used the old PracticeETAs table have been removed:
- `savePracticeAssignmentETA()` - No longer needed
- `saveResourceAssignmentETA()` - No longer needed
- `getPracticeETA()` - No longer needed (singular version)
- `updatePracticeETA()` - No longer needed

The following functions were simplified to no-ops:
- `updatePracticeAssignmentETA()` - Returns true immediately
- `updateResourceAssignmentETA()` - Returns true immediately

## Single Source of Truth

**Function**: `db.getPracticeETAs(practiceList)`
**Location**: `lib/dynamodb.js`
**Data Source**: `AssignmentStatusLog` table (21-day rolling window)
**Used By**: 
- Frontend page (via API endpoint)
- Email service (direct call)

Both systems now use the **exact same calculation logic** with **real-time data**.
