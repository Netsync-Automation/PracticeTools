#!/usr/bin/env node
import { getValidAccessToken } from './lib/webex-token-manager.js';

const webhookId = 'Y2lzY29zcGFyazovL3VzL1dFQkhPT0svYjhlYjUzNzAtMzVjNC00M2Y3LWI4ZTgtNTA2ODUxYmNmN2Yy';
const siteUrl = 'netsync.webex.com';

const accessToken = await getValidAccessToken(siteUrl);

const response = await fetch(`https://webexapis.com/v1/webhooks/${webhookId}`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

const webhook = await response.json();

console.log('\n=== Webhook Details ===');
console.log(`ID: ${webhook.id}`);
console.log(`Name: ${webhook.name}`);
console.log(`Target URL: ${webhook.targetUrl}`);
console.log(`Resource: ${webhook.resource}`);
console.log(`Event: ${webhook.event}`);
console.log(`Filter: ${webhook.filter}`);
console.log(`Status: ${webhook.status}`);
console.log(`Created: ${webhook.created}`);
console.log(`OwnedBy: ${webhook.ownedBy}`);
console.log('');
