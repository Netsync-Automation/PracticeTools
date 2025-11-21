#!/usr/bin/env node
import { getValidAccessToken } from './lib/webex-token-manager.js';

const siteUrl = 'netsync.webex.com';
const hostEmail = 'mbgriffin@netsync.com';

const accessToken = await getValidAccessToken(siteUrl);

const response = await fetch(`https://webexapis.com/v1/recordings?hostEmail=${encodeURIComponent(hostEmail)}&max=5`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

if (response.ok) {
  const data = await response.json();
  console.log(`\n=== Recent Recordings for ${hostEmail} ===\n`);
  
  if (data.items && data.items.length > 0) {
    data.items.forEach(rec => {
      console.log(`Recording ID: ${rec.id}`);
      console.log(`Topic: ${rec.topic}`);
      console.log(`Created: ${rec.createTime}`);
      console.log(`Host User ID: ${rec.hostUserId || 'N/A'}`);
      console.log(`Host Email: ${rec.hostEmail || 'N/A'}`);
      console.log(`Site URL: ${rec.siteUrl}`);
      console.log('');
    });
  } else {
    console.log('No recordings found');
  }
} else {
  console.log(`Failed: ${response.status}`);
  console.log(await response.text());
}
