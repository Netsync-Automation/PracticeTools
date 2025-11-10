# WebexMeetings API Documentation

## Overview
This document outlines the implementation of WebexMeetings recording and transcript webhooks based on the official Webex API documentation.

## Key Resources

### 1. Recordings Resource
- **Webhook Event**: `recordings`
- **Triggers**: When a new recording is created
- **Key Data**:
  - `id`: Recording ID
  - `meetingId`: Meeting ID (required for transcript matching)
  - `meetingInstanceId`: Meeting instance ID (required for transcripts)
  - `hostUserId`: Host user ID (for matching configured recording hosts)
  - `siteUrl`: Site URL (for matching configured sites)
  - `downloadUrl`: Direct download URL for MP4 file
  - `createTime`: When recording was created
  - `topic`: Meeting topic/title

### 2. Meeting Transcripts Resource
- **Webhook Event**: `meetingTranscripts`
- **Triggers**: When a new transcript is available
- **Key Data**:
  - `id`: Transcript ID
  - `meetingId`: Meeting ID (matches recording)
  - `meetingInstanceId`: Meeting instance ID (matches recording)
  - `downloadUrl`: Transcript download URL
  - `createTime`: When transcript was created

## Implementation Flow

### Recording Webhook Flow:
1. Receive webhook notification for new recording
2. Validate recording matches configured site URL and recording hosts
3. Download MP4 file from WebexMeetings API
4. Store MP4 in S3 bucket
5. Store recording metadata in DynamoDB
6. Check if transcript is immediately available
7. If transcript available, download and store
8. If transcript not available, wait for transcript webhook

### Transcript Webhook Flow:
1. Receive webhook notification for new transcript
2. Match transcript to existing recording in database using meetingId/meetingInstanceId
3. Download transcript file
4. Update recording record with transcript information

## Database Schema

### WebexMeetingsRecordings Table:
```
{
  id: string (recording ID),
  meetingId: string,
  meetingInstanceId: string,
  hostUserId: string,
  siteUrl: string,
  topic: string,
  createTime: string,
  s3Key: string (S3 object key for MP4),
  s3Url: string (presigned URL for download),
  transcriptId: string (optional),
  transcriptS3Key: string (optional),
  transcriptS3Url: string (optional),
  status: string (processing|completed|failed),
  created_at: string,
  updated_at: string
}
```

## API Endpoints Implemented

### Webhook Endpoints:
- `POST /api/webhooks/webexmeetings/recordings` - Handle recording notifications
- `POST /api/webhooks/webexmeetings/transcripts` - Handle transcript notifications

### Management Endpoints:
- `GET /api/webexmeetings/recordings` - List recordings
- `GET /api/webexmeetings/recordings/[id]` - Get specific recording
- `POST /api/webexmeetings/transcripts` - Poll for missing transcripts

## Security Considerations
- Webhook signature verification
- Access token refresh handling
- S3 presigned URL expiration
- Recording host validation

## S3 Storage Structure
- Recordings: `webexmeetings-recordings/{recordingId}.mp4`
- Transcripts: `webexmeetings-transcripts/{transcriptId}.vtt`