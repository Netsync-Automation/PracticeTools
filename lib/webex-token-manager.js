import { storeWebexTokens, getWebexTokens, getSitePrefix, getWebexCredentials } from './ssm.js';

const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry
const tokenCache = new Map();

/**
 * Check if token is a JWT format (3 parts separated by dots)
 */
function isJWT(token) {
  return token && typeof token === 'string' && token.split('.').length === 3;
}

/**
 * Decode JWT token to get expiration time
 */
function decodeJWT(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  if (!isJWT(token)) {
    return null;
  }
  
  try {
    const parts = token.split('.');
    const payload = parts[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Check if token is expired by testing it with a simple API call
 * Service apps typically use long-lived tokens that rarely expire
 */
async function isTokenExpired(token) {
  if (!token) {
    return true;
  }
  
  // For JWT tokens, check expiration time first
  if (isJWT(token)) {
    const decoded = decodeJWT(token);
    if (decoded?.exp) {
      const expiryTime = decoded.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      if (timeUntilExpiry <= TOKEN_REFRESH_BUFFER) {
        return true;
      }
    }
  }
  
  // For service app tokens, test with API call
  try {
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 401) {
      return true; // Token is expired or invalid
    }
    
    return !response.ok; // Other errors might not be token-related
  } catch (error) {
    console.error('Error testing token validity:', error);
    return false; // Don't assume expired on network errors
  }
}

/**
 * Refresh access token using refresh token for service apps
 */
async function refreshAccessToken(siteUrl, refreshToken) {
  const credentials = await getWebexCredentials(siteUrl);
  
  if (!credentials?.clientId || !credentials?.clientSecret) {
    throw new Error(`Missing client credentials for ${siteUrl}. Please configure client ID and secret in admin settings.`);
  }
  
  const response = await fetch('https://webexapis.com/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`Token refresh failed for ${siteUrl}:`, {
      status: response.status,
      statusText: response.statusText,
      error
    });
    throw new Error(`Token refresh failed (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  
  await storeWebexTokens(siteUrl, data.access_token, data.refresh_token || refreshToken);
  
  tokenCache.set(siteUrl, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    lastUpdated: Date.now()
  });
  
  console.log(`✓ Tokens refreshed for ${siteUrl}`);
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken
  };
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(siteUrl) {
  const cacheKey = siteUrl;
  const cached = tokenCache.get(cacheKey);
  
  // Check cache first (valid for 1 minute)
  if (cached && (Date.now() - cached.lastUpdated) < 60000) {
    if (!await isTokenExpired(cached.accessToken)) {
      return cached.accessToken;
    }
  }
  
  // Load tokens from SSM
  const tokens = await getWebexTokens(siteUrl);
  if (!tokens) {
    throw new Error(`No tokens found for ${siteUrl}`);
  }
  
  // Check if access token needs refresh
  const tokenExpired = await isTokenExpired(tokens.accessToken);
  if (tokenExpired) {
    console.log(`Access token expired for ${siteUrl}, refreshing...`);
    const refreshed = await refreshAccessToken(siteUrl, tokens.refreshToken);
    return refreshed.accessToken;
  }
  
  // Update cache with current tokens
  tokenCache.set(cacheKey, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    lastUpdated: Date.now()
  });
  
  return tokens.accessToken;
}

/**
 * Preemptively refresh tokens for all configured sites
 */
export async function refreshAllTokens(sites) {
  const refreshPromises = sites.map(async (site) => {
    try {
      const tokens = await getWebexTokens(site.siteUrl);
      if (tokens && await isTokenExpired(tokens.accessToken)) {
        await refreshAccessToken(site.siteUrl, tokens.refreshToken);
      }
    } catch (error) {
      console.error(`Failed to refresh tokens for ${site.siteUrl}:`, error);
    }
  });
  
  await Promise.allSettled(refreshPromises);
}