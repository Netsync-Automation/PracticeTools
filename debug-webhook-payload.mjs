// Debug script to examine webhook payload structure
import { readFileSync } from 'fs';

// From the logs, we can see the webhook data structure
// Let's examine what fields are actually available

const sampleWebhookData = {
  "resource": "recordings",
  "event": "created", 
  "data": {
    "id": "e4cc7b99c75445ce81f35220c213d81b",
    // Add other fields we expect to see
  }
};

console.log('Expected webhook structure:');
console.log(JSON.stringify(sampleWebhookData, null, 2));

console.log('\nLooking for downloadUrl field...');
console.log('downloadUrl:', sampleWebhookData.data.downloadUrl);

console.log('\nNeed to check Webex API documentation for correct field names');
console.log('Possible field names for download URL:');
console.log('- downloadUrl');
console.log('- downloadLink'); 
console.log('- url');
console.log('- recordingUrl');
console.log('- mp4Url');