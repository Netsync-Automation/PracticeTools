# ChatNPT Practice Boards Integration Fix

## Problem
The ChatNPT AI assistant was unable to find information about practice board cards, columns, and topics (like the "3rd party SoWs" information in the Audio/Visual practice board). This was because:

1. Practice board data is stored in the `Settings` table with environment-specific keys like `{env}_practice_board_{practiceId}`
2. ChatNPT was only fetching from the `PracticeInfoPages` table, which is for static pages, not the dynamic board data
3. The actual card content, descriptions, comments, and metadata were not being indexed for AI search

## Solution
Modified the ChatNPT API to fetch and index practice board data from the Settings table:

### Changes Made

#### 1. `/app/api/chatnpt/route.js`
- Added `Settings` table to the data fetching Promise.all array
- Implemented practice board data extraction logic that:
  - Filters Settings entries for practice board keys
  - Parses board JSON data
  - Extracts all columns and cards
  - Indexes card titles, descriptions, comments, assignments, labels, checklists, and due dates
  - Creates searchable chunks with board name, topic, column, and card information

#### 2. `/app/api/chatnpt/sources/route.js`
- Added "Practice Boards" as a data source
- Implemented card counting logic that:
  - Scans Settings table for practice board entries
  - Counts total cards across all boards and topics
  - Displays the count in the data sources modal

## Data Structure Indexed
For each card in practice boards, ChatNPT now indexes:
- Board name (e.g., "Audio Visual, Collaboration, Contact Center, IoT, Physical Security")
- Topic name (e.g., "Main Topic")
- Column name (e.g., "To Do", "In Progress", "Done")
- Card title
- Card description (full text)
- Assigned users
- Due dates
- Labels
- Checklist names and item counts
- All comments with author names

## Example Query
Now when a user asks: "What is the process for 3rd party SoWs?"

ChatNPT will:
1. Search through all practice board cards
2. Find the "Test" card in the "To Do" column
3. Under the "Audio/Visual, Collaboration, Contact Center, IoT, Physical Security" practice board
4. Within the "Main Topic" topic
5. Return the card's description and any relevant information

## DSR Compliance
✅ All changes follow DSR rules:
- Uses environment-aware table names via `getTableName()`
- No hardcoded values
- Follows existing code patterns
- Minimal code additions
- No debug code left in production

## Testing
To verify the fix works:
1. Open ChatNPT in the application
2. Ask: "What is the process for 3rd party SoWs?"
3. ChatNPT should now find and return information from the practice board card
4. Check "Data Sources" modal to see "Practice Boards" listed with card count

## Files Modified
- `/app/api/chatnpt/route.js` - Added practice board data indexing
- `/app/api/chatnpt/sources/route.js` - Added practice boards to data sources list
