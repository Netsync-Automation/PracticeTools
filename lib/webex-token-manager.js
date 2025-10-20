import { storeWebexTokens, getWebexTokens, getSitePrefix } from './ssm.js';

const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry
const tokenCache = new Map();

/**
 * Decode JWT token to get expiration time
 */
function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    return decoded;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 */
function isTokenExpired(token) {
  const decoded = decodeJWT(token);
  if (!decoded?.exp) return true;
  
  const expiryTime = decoded.exp * 1000;
  const now = Date.now();
  
  return (expiryTime - now) <= TOKEN_REFRESH_BUFFER;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(siteUrl, refreshToken) {
  const response = await fetch('https://webexapis.com/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
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