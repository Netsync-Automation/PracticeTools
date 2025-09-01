import { TimezoneManager } from './timezone.js';

export async function sendWebexNotification(message, type = 'info') {
  const token = process.env.WEBEX_ACCESS_TOKEN;
  const roomId = process.env.WEBEX_ROOM_ID;
  
  if (!token || !roomId) {
    console.log('WebEx credentials not configured, skipping notification');
    return { success: false, error: 'Missing credentials' };
  }

  try {
    const payload = {
      roomId,
      text: message,
      markdown: message
    };
    
    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const responseData = await response.json();
      return { success: true, messageId: responseData.id };
    } else {
      const errorText = await response.text();
      console.error('WebEx API Error:', response.status, errorText);
      return { success: false, error: `API Error: ${response.status}` };
    }
  } catch (error) {
    console.error('WebEx notification error:', error);
    return { success: false, error: error.message };
  }
}

export async function sendDirectMessage(email, message) {
  const token = process.env.WEBEX_ACCESS_TOKEN;
  
  if (!token) {
    console.log('WebEx token not configured, skipping direct message');
    return { success: false, error: 'Missing token' };
  }

  try {
    const payload = {
      toPersonEmail: email,
      text: message,
      markdown: message
    };
    
    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const responseData = await response.json();
      return { success: true, messageId: responseData.id };
    } else {
      const errorText = await response.text();
      console.error('WebEx DM API Error:', response.status, errorText);
      return { success: false, error: `API Error: ${response.status}` };
    }
  } catch (error) {
    console.error('WebEx direct message error:', error);
    return { success: false, error: error.message };
  }
}