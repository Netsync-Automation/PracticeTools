# ETA Calculation Fix Summary

## Problem
Resource Assignment ETAs were not displaying correctly in two places:
1. **Emails**: Showing "Resource Assignment ETAs are being calculated and will be available soon"
2. **Frontend Page**: Practice Assignment showing N/A, Resource Assignment showing wildly incorrect values

## Root Cause
The email service (`lib/email-service.js`) was making HTTP calls to `/api/practice-etas` endpoint, but only in development mode due to this condition:

```javascript
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
```

This meant emails couldn't get ETA data in production. Additionally, making HTTP calls from server-side code is inefficient when the database function is directly available.

## Solution (DSR Compliant)
Changed email service to call `db.getPracticeETAs()` **directly** instead of making HTTP calls:

### Changes Made:
1. **Pending Assignment Notification**:
   - **Before**: Made HTTP fetch calls to `/api/practice-etas` for each practice (only in dev mode)
   - **After**: Calls `db.getPracticeETAs()` directly to get all ETAs at once

2. **Practice Assigned Notification**:
   - **Before**: Made HTTP fetch calls to `/api/practice-etas` for each practice (only in dev mode)
   - **After**: Calls `db.getPracticeETAs(assignedPractices)` directly with practice filter

### Why This Is Better:
- ✅ **DSR Compliant**: Reuses existing `db.getPracticeETAs()` function
- ✅ **More Efficient**: No HTTP overhead, direct database access
- ✅ **Consistent**: Same data source as frontend (both use `db.getPracticeETAs()`)
- ✅ **Works Everywhere**: No environment-specific conditions

## How ETAs Work (Real-Time Calculation)

### Practice Assignment ETA (Pending → Unassigned)
- Tracks time from when assignment is created (Pending status) to when it's assigned to a practice (Unassigned status)
- **Calculated in real-time** from status log data using a **21-day rolling window**
- Only includes assignments from the past 21 days
- Displayed in days

### Resource Assignment ETA (Unassigned → Assigned)
- Tracks time from when assignment is assigned to a practice (Unassigned status) to when resources are assigned (Assigned status)
- **Calculated in real-time** from status log data using a **21-day rolling window**
- Only includes assignments from the past 21 days
- Displayed in days

## Data Flow
1. Status changes are logged in `PracticeTools-{env}-AssignmentStatusLog` table
2. **ETAs are calculated on-demand** (no pre-calculated storage)
3. **Frontend**: Calls `/api/practice-etas` → calls `db.getPracticeETAs()` → calculates from status log
4. **Email Service**: Calls `db.getPracticeETAs()` directly → calculates from status log
5. Each call returns **fresh calculations** based on the most recent 21 days of data

## Testing
After deployment, verify:
1. ✅ Emails show actual ETA values calculated from last 21 days
2. ✅ Frontend page shows correct Practice Assignment ETA (21-day average)
3. ✅ Frontend page shows correct Resource Assignment ETA (21-day average)
4. ✅ ETAs automatically reflect latest data (no manual updates needed)
5. ✅ ETAs only include assignments from the past 21 days

## Files Modified
- `lib/email-service.js` - Changed to call `db.getPracticeETAs()` directly
- `lib/dynamodb.js` - Replaced `getPracticeETAs()` with real-time calculation from 21-day rolling window
- `app/api/practice-etas/route.js` - Updated to return real-time calculations, removed POST endpoint

## DSR Compliance
✅ This fix follows DSR rules:
- No debug code added
- Minimal code changes
- Fixes production issue
- Maintains existing patterns
