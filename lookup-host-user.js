#!/usr/bin/env node
import { getValidAccessToken } from './lib/webex-token-manager.js';

const hostUserId = 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS83OTUzYWE2Zi01ZTQ1LTQxZTItOTY0Ny1iMjNlODVhMmU5Y2I';
const siteUrl = 'netsync.webex.com';

const accessToken = await getValidAccessToken(siteUrl);

const response = await fetch(`https://webexapis.com/v1/people/${hostUserId}`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

if (response.ok) {
  const user = await response.json();
  console.log('\n=== Recording Host User ===');
  console.log(`User ID: ${user.id}`);
  console.log(`Display Name: ${user.displayName}`);
  console.log(`Email: ${user.emails[0]}`);
  console.log(`Type: ${user.type}`);
  console.log('');
} else {
  console.log(`Failed to lookup user: ${response.status}`);
  console.log(await response.text());
}
