import { getWebexTokens, getWebexCredentials, getSitePrefix } from './ssm.js';

/**
 * Get all configured Webex Meetings sites with their tokens from SSM
 */
export async function getWebexMeetingsSitesWithTokens(sites) {
  return Promise.all(
    sites.map(async (site) => {
      const tokens = await getWebexTokens(site.siteUrl);
      const credentials = await getWebexCredentials(site.siteUrl);
      return {
        ...site,
        accessToken: tokens?.accessToken || '',
        refreshToken: tokens?.refreshToken || '',
        clientId: credentials?.clientId || '',
        clientSecret: credentials?.clientSecret || ''
      };
    })
  );
}

/**
 * Generate App Runner YAML entries for a new site
 */
export function generateAppRunnerEntries(siteUrl, environment = 'dev') {
  const sitePrefix = getSitePrefix(siteUrl);
  const envPath = environment === 'prod' ? '' : '/dev';
  
  return `    - name: ${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN
      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN
    - name: ${sitePrefix}_WEBEX_MEETINGS_REFRESH_TOKEN
      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_REFRESH_TOKEN
    - name: ${sitePrefix}_WEBEX_MEETINGS_CLIENT_ID
      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_CLIENT_ID
    - name: ${sitePrefix}_WEBEX_MEETINGS_CLIENT_SECRET
      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_CLIENT_SECRET`;
}

/**
 * List required SSM parameters for configured sites
 */
export function listRequiredSSMParameters(sites, environment = 'dev') {
  const envPath = environment === 'prod' ? '' : '/dev';
  
  return sites.flatMap(site => {
    const sitePrefix = getSitePrefix(site.siteUrl);
    return [
      `/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN`,
      `/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_REFRESH_TOKEN`,
      `/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_CLIENT_ID`,
      `/PracticeTools${envPath}/${sitePrefix}_WEBEX_MEETINGS_CLIENT_SECRET`
    ];
  });
}