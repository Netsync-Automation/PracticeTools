# WebEx Recording Transcript System

## Overview
Automatically fetches and stores transcripts for WebEx meeting recordings with retry logic.

## How It Works

### 1. New Recording Webhook
When a new recording is received via webhook (`/api/webhooks/webexmeetings/recordings`):
- Recording is saved to database with `transcriptStatus: 'pending'`
- Immediate transcript fetch is attempted
- If transcript not available, retry logic begins

### 2. Transcript Fetch Process
Endpoint: `/api/webexmeetings/recordings/[id]/transcript` (POST)
- Fetches recording details from WebEx API
- Attempts to download transcript from `temporaryDirectDownloadLinks.transcriptDownloadLink`
- If successful:
  - Stores transcript text in database
  - Uploads to S3
  - Sets `transcriptStatus: 'available'`
  - Sends SSE notification
- If not available:
  - Increments `transcriptRetryCount`
  - Sets `nextTranscriptRetry` to 5 minutes from now
  - After 288 retries (24 hours): sets `transcriptStatus: 'No Transcript'`

### 3. Automated Retry System
**Vercel Cron Job** (runs every 5 minutes):
- Endpoint: `/api/cron/transcript-retry`
- Scans database for recordings without transcripts
- Retries recordings where `nextTranscriptRetry` time has passed
- Stops retrying after 288 attempts or when transcript is found

### 4. Frontend Display
Page: `/company-education/scoop`
- Shows transcript status: "pending", "Available", or "No Transcript"
- "Available" status is clickable to view transcript in modal
- Real-time updates via SSE

## Environment Variables
```
CRON_SECRET=<secret-key-for-cron-authentication>
```

## Vercel Configuration
File: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/transcript-retry",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Database Schema
Table: `WebexMeetingsRecordings`
- `transcriptStatus`: "pending" | "available" | "No Transcript"
- `transcriptText`: Full transcript content (WebVTT format)
- `transcriptS3Key`: S3 storage key
- `transcriptS3Url`: S3 URL
- `transcriptRetryCount`: Number of retry attempts
- `nextTranscriptRetry`: ISO timestamp for next retry

## Manual Trigger
To manually trigger transcript fetch for all recordings:
```bash
node trigger-transcript-fetch.js
```
