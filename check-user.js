import { db } from './lib/dynamodb.js';

async function checkUser() {
  try {
    const user = await db.getUser('hpugsley@netsync.com');
    if (user) {
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('WebEx Bot Source:', user.webex_bot_source || 'Not set');
      console.log('Created From:', user.created_from);
      console.log('Auth Method:', user.auth_method);
      console.log('Status:', user.status);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUser();