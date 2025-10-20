let cachedToken = null;
let tokenExpiry = null;

async function getValidAccessToken() {
  console.log('[WEBEX-TOKEN] Getting access token');
  
  // Return cached token if still valid (with 5 minute buffer)
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    console.log('[WEBEX-TOKEN] Using cached token');
    return cachedToken;
  }
  
  // Use SSM stored tokens from Service App OAuth flow
  const ssmAccessToken = process.env.WEBEX_MEETINGS_ACCESS_TOKEN;
  const ssmRefreshToken = process.env.WEBEX_MEETINGS_REFRESH_TOKEN;
  
  if (ssmAccessToken && ssmRefreshToken) {
    console.log('[WEBEX-TOKEN] Using Service App OAuth tokens from SSM');
    cachedToken = ssmAccessToken;
    tokenExpiry = Date.now() + (3600 * 1000); // Assume 1 hour validity
    return cachedToken;
  }
  
  throw new Error('No Service App OAuth tokens configured. Configure access and refresh tokens via admin settings.');
}

export { getValidAccessToken };