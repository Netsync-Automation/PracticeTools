#!/usr/bin/env node
import { getValidAccessToken } from './lib/webex-token-manager.js';

const roomId = 'Y2lzY29zcGFyazovL3VzL1JPT00vNDkwNmJhNDAtYjVhZS0xMWYwLWJkNmItYzU0NTEwMGE3OTU5';
const siteUrl = 'netsync.webex.com';

const accessToken = await getValidAccessToken(siteUrl);

const response = await fetch(`https://webexapis.com/v1/rooms/${roomId}`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

const room = await response.json();

console.log('\n=== Room Details ===');
console.log(`ID: ${room.id}`);
console.log(`Title: ${room.title}`);
console.log(`Type: ${room.type}`);
console.log(`Created: ${room.created}`);
console.log('');
