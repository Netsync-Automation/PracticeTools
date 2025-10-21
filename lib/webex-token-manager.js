import { storeWebexTokens, getWebexTokens, getSitePrefix } from './ssm.js';

const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry
const tokenCache = new Map();

/**
 * Decode JWT token to get expiration time
 */
function decodeJWT(token) {
  if (!token || typeof token !== 'string') {
    console.error('Invalid token provided to decodeJWT:', typeof token, token?.substring?.(0, 20));
    return null;
  }
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format - expected 3 parts, got:', parts.length);
      return null;
    }
    
    const payload = parts[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    console.log('JWT decoded successfully, exp:', decoded.exp, 'expires:', new Date(decoded.exp * 1000).toISOString());
    return decoded;
  } catch (error) {
    console.error('Failed to decode JWT:', error.message);
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 */
function isTokenExpired(token) {
  if (!token) {
    console.error('No token provided to isTokenExpired');
    return true;
  }
  
  // Webex Meetings API uses simple bearer tokens, not JWTs
  // We can't determine expiration from the token itself
  // Return false to skip expiration check for simple tokens
  const decoded = decodeJWT(token);
  if (!decoded?.exp) {
    console.log('Token is not a JWT or has no expiration claim - assuming valid');
    return false;
  }
  
  const expiryTime = decoded.exp * 1000;
  const now = Date.now();
  const timeUntilExpiry = expiryTime - now;
  const isExpired = timeUntilExpiry <= TOKEN_REFRESH_BUFFER;
  
  console.log('Token expiration check:', {
    expiryTime: new Date(expiryTime).toISOString(),
    now: new Date(now).toISOString(),
    timeUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60) + ' minutes',
    refreshBuffer: Math.round(TOKEN_REFRESH_BUFFER / 1000 / 60) + ' minutes',
    isExpired
  });
  
  return isExpired;
}

/**
 * Refresh access token using refresh token for service apps
 */
async function refreshAccessToken(siteUrl, refreshToken) {
  const response = await fetch('https://webexapis.com/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${refreshToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }
  
  const data = await response.json();
  
  await storeWebexTokens(siteUrl, data.access_token, data.refresh_token);
  
  tokenCache.set(siteUrl, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    lastUpdated: Date.now()
  });
  
  console.log(`✓ Tokens refreshed for ${siteUrl}`);
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token
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
    if (!isTokenExpired(cached.accessToken)) {
      return cached.accessToken;
    }
  }
  
  // Load tokens from SSM
  const tokens = await getWebexTokens(siteUrl);
  if (!tokens) {
    throw new Error(`No tokens found for ${siteUrl}`);
  }
  
  // Check if access token needs refresh
  if (isTokenExpired(tokens.accessToken)) {
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
      if (tokens && isTokenExpired(tokens.accessToken)) {
        await refreshAccessToken(site.siteUrl, tokens.refreshToken);
      }
    } catch (error) {
      console.error(`Failed to refresh tokens for ${site.siteUrl}:`, error);
    }
  });
  
  await Promise.allSettled(refreshPromises);
}