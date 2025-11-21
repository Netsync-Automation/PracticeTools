#!/usr/bin/env node
import { getValidAccessToken } from './lib/webex-token-manager.js';

const roomId = 'Y2lzY29zcGFyazovL3VzL1JPT00vNDkwNmJhNDAtYjVhZS0xMWYwLWJkNmItYzU0NTEwMGE3OTU5';
const siteUrl = 'netsync.webex.com';

const accessToken = await getValidAccessToken(siteUrl);

// Get service app user ID
const meResponse = await fetch('https://webexapis.com/v1/people/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const me = await meResponse.json();

console.log('\n=== Service App ===');
console.log(`ID: ${me.id}`);
console.log(`Email: ${me.emails[0]}`);
console.log(`Display Name: ${me.displayName}`);

// Get room members
const membersResponse = await fetch(`https://webexapis.com/v1/memberships?roomId=${roomId}`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const membersData = await membersResponse.json();

console.log('\n=== Room Members ===');
membersData.items.forEach(m => {
  const isServiceApp = m.personId === me.id ? ' ← SERVICE APP' : '';
  console.log(`${m.personDisplayName} (${m.personEmail})${isServiceApp}`);
});

const serviceAppInRoom = membersData.items.some(m => m.personId === me.id);
console.log(`\n${serviceAppInRoom ? '✅' : '❌'} Service app is ${serviceAppInRoom ? '' : 'NOT '}in the room\n`);
