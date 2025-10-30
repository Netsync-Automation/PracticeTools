# ETA Calculation - Real-Time Implementation

## Overview
Changed from **pre-calculated stored ETAs** to **real-time calculation** using a **21-day rolling window**.

## Key Changes

### 1. Real-Time Calculation Logic (`lib/dynamodb.js`)
**Function**: `getPracticeETAs(practiceList)`

**How it works**:
1. Queries `AssignmentStatusLog` table for all status changes in the last 21 days
2. Gets all assignments to find creation timestamps
3. For each practice, calculates:
   - **Practice Assignment ETA**: Average time from assignment creation to Pending→Unassigned transition
   - **Resource Assignment ETA**: Average time from Unassigned→Assigned transition
4. Returns fresh calculations every time it's called

**Benefits**:
- ✅ Always reflects most recent data
- ✅ Automatically excludes old data (21-day window)
- ✅ No manual updates needed
- ✅ No stale data in database

### 2. Email Service (`lib/email-service.js`)
**Changed from**: Making HTTP calls to `/api/practice-etas` (only in dev mode)
**Changed to**: Calling `db.getPracticeETAs()` directly

**Benefits**:
- ✅ Works in all environments (dev and prod)
- ✅ No HTTP overhead
- ✅ Gets fresh calculations before each email
- ✅ DSR compliant (reuses existing function)

### 3. API Endpoint (`app/api/practice-etas/route.js`)
**Changes**:
- GET endpoint now returns real-time calculations with `calculatedAt` timestamp
- Removed POST endpoint (no longer needed since we don't store ETAs)

## Data Flow

### Before (Broken):
```
Status Change → Update stored ETA → Frontend/Email reads stored ETA
                     ↑ (only in dev mode for emails)
```

### After (Fixed):
```
Status Change → Logged to AssignmentStatusLog
                         ↓
Frontend/Email → Calculate ETA from last 21 days of status log data
```

## Calculation Details

### Practice Assignment ETA (Pending → Unassigned)
```javascript
For each assignment in last 21 days:
  - Find status change: Pending → Unassigned
  - Calculate: (change timestamp - assignment.created_at)
  - Average all durations for the practice
```

### Resource Assignment ETA (Unassigned → Assigned)
```javascript
For each assignment in last 21 days:
  - Find status change: Unassigned → Assigned
  - Find when it became Unassigned
  - Calculate: (Assigned timestamp - Unassigned timestamp)
  - Average all durations for the practice
```

## Performance Considerations
- Calculation happens on-demand (not pre-computed)
- Uses DynamoDB FilterExpression to limit data to 21 days
- Efficient for typical workloads (hundreds of assignments)
- Results are calculated fresh each time (no caching)

## DSR Compliance
✅ **Reuses existing code**: Uses existing `getAllAssignments()` and status log queries
✅ **Minimal changes**: Only modified necessary functions
✅ **No debug code**: Clean implementation
✅ **Follows patterns**: Matches existing DynamoDB query patterns

## Migration Notes
- Old `PracticeETAs` table is no longer used (can be deleted if desired)
- No data migration needed - calculations work from existing status log
- Backward compatible - old stored ETAs are simply ignored
