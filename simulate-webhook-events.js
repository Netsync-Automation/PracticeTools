#!/usr/bin/env node

/**
 * Webhook Event Simulator
 * Simulates actual webhook events to test endpoint processing
 */

import fetch from 'node-fetch';

const DEV_BASE_URL = 'http://localhost:3000';

// Sample webhook payloads based on Webex API documentation
const sampleRecordingEvent = {
  id: "test-event-recording-123",
  name: "recording.created",
  targetUrl: `${DEV_BASE_URL}/api/webhooks/webexmeetings/recordings`,
  resource: "recordings",
  event: "created",
  orgId: "test-org-123",
  createdBy: "test-user-123",
  appId: "test-app-123",
  ownedBy: "org",
  status: "active",
  created: new Date().toISOString(),
  actorId: "test-actor-123",
  data: {
    id: "test-recording-456",
    meetingId: "test-meeting-789",
    hostEmail: "test@example.com",
    topic: "Test Meeting Recording",
    createTime: new Date().toISOString(),
    timeRecorded: 3600,
    format: "MP4",
    serviceType: "MeetingCenter",
    status: "available",
    downloadUrl: "https://example.webex.com/recording/download/test-recording-456",
    playbackUrl: "https://example.webex.com/recording/play/test-recording-456"
  }
};

const sampleTranscriptEvent = {
  id: "test-event-transcript-123",
  name: "meetingTranscript.created",
  targetUrl: `${DEV_BASE_URL}/api/webhooks/webexmeetings/transcripts`,
  resource: "meetingTranscripts",
  event: "created",
  orgId: "test-org-123",
  createdBy: "test-user-123",
  appId: "test-app-123",
  ownedBy: "org",
  status: "active",
  created: new Date().toISOString(),
  actorId: "test-actor-123",
  data: {
    id: "test-transcript-456",
    meetingId: "test-meeting-789",
    hostEmail: "test@example.com",
    meetingTopic: "Test Meeting Transcript",
    created: new Date().toISOString(),
    format: "vtt",
    serviceType: "MeetingCenter",
    status: "available",
    downloadUrl: "https://example.webex.com/transcript/download/test-transcript-456"
  }
};

async function simulateWebhookEvents() {
  console.log('🎭 Simulating Webex Meetings Webhook Events');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Simulate recording webhook
    console.log('\n📹 Testing Recording Webhook...');
    console.log('Sending sample recording.created event...');
    
    const recordingResponse = await fetch(`${DEV_BASE_URL}/api/webhooks/webexmeetings/recordings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Webex-Webhook-Simulator/1.0'
      },
      body: JSON.stringify(sampleRecordingEvent)
    });
    
    console.log(`Response Status: ${recordingResponse.status}`);
    if (recordingResponse.ok) {
      const recordingResult = await recordingResponse.json();
      console.log('✅ Recording webhook processed successfully');
      console.log('Response:', JSON.stringify(recordingResult, null, 2));
    } else {
      console.log('❌ Recording webhook failed');
      const errorText = await recordingResponse.text();
      console.log('Error:', errorText);
    }
    
    // Test 2: Simulate transcript webhook
    console.log('\n📝 Testing Transcript Webhook...');
    console.log('Sending sample meetingTranscript.created event...');
    
    const transcriptResponse = await fetch(`${DEV_BASE_URL}/api/webhooks/webexmeetings/transcripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Webex-Webhook-Simulator/1.0'
      },
      body: JSON.stringify(sampleTranscriptEvent)
    });
    
    console.log(`Response Status: ${transcriptResponse.status}`);
    if (transcriptResponse.ok) {
      const transcriptResult = await transcriptResponse.json();
      console.log('✅ Transcript webhook processed successfully');
      console.log('Response:', JSON.stringify(transcriptResult, null, 2));
    } else {
      console.log('❌ Transcript webhook failed');
      const errorText = await transcriptResponse.text();
      console.log('Error:', errorText);
    }
    
    // Test 3: Test with invalid payload
    console.log('\n🚫 Testing Error Handling...');
    console.log('Sending invalid payload...');
    
    const invalidResponse = await fetch(`${DEV_BASE_URL}/api/webhooks/webexmeetings/recordings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalid: 'payload' })
    });
    
    console.log(`Invalid Payload Response: ${invalidResponse.status}`);
    if (!invalidResponse.ok) {
      console.log('✅ Error handling working correctly');
    } else {
      console.log('⚠️  Webhook accepted invalid payload - check validation');
    }
    
    // Test 4: Test connectivity
    console.log('\n🔗 Testing Basic Connectivity...');
    
    const testResponse = await fetch(`${DEV_BASE_URL}/api/webhooks/webexmeetings/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test: 'connectivity-check',
        timestamp: new Date().toISOString()
      })
    });
    
    if (testResponse.ok) {
      const testResult = await testResponse.json();
      console.log('✅ Test endpoint reachable');
      console.log('Test Response:', JSON.stringify(testResult, null, 2));
    } else {
      console.log('❌ Test endpoint failed');
    }
    
    console.log('\n🎉 Webhook simulation completed!');
    console.log('\n📊 Summary:');
    console.log('   - Check server logs for detailed processing information');
    console.log('   - Verify database entries were created (if applicable)');
    console.log('   - Monitor for any error messages in the console');
    console.log('\n💡 Next Steps:');
    console.log('   - Create an actual meeting to test real webhook delivery');
    console.log('   - Check webhook logs in admin settings');
    console.log('   - Verify SSE events are triggered (if implemented)');
    
  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    console.error('Stack trace:', error.stack);
    console.log('\n💡 Troubleshooting:');
    console.log('   - Ensure dev server is running: npm run dev');
    console.log('   - Check if webhook endpoints exist');
    console.log('   - Verify network connectivity');
  }
}

// Run the simulation
simulateWebhookEvents().catch(console.error);