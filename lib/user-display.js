// Utility functions for displaying user names instead of emails

let userCache = new Map();
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getUserDisplayName(email) {
  if (!email) return 'Unknown User';
  
  // Check cache first
  const now = Date.now();
  if (now < cacheExpiry && userCache.has(email)) {
    return userCache.get(email);
  }
  
  try {
    const response = await fetch('/api/users/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (response.ok) {
      const data = await response.json();
      const displayName = data.name || email;
      
      // Update cache
      if (now >= cacheExpiry) {
        userCache.clear();
        cacheExpiry = now + CACHE_DURATION;
      }
      userCache.set(email, displayName);
      
      return displayName;
    }
  } catch (error) {
    console.error('Error looking up user name:', error);
  }
  
  return email; // Fallback to email
}

export async function getUserDisplayNames(emails) {
  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  const results = {};
  
  for (const email of uniqueEmails) {
    results[email] = await getUserDisplayName(email);
  }
  
  return results;
}