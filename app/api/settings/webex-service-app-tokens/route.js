import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';

// Helper function to get tokens for a specific site
export async function getTokensForSite(siteUrl) {
  try {
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    const sitesConfig = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_SITES`);
    if (sitesConfig) {
      const sites = JSON.parse(sitesConfig);
      const site = sites.find(s => s.siteUrl === siteUrl);
      if (site) {
        return {
          accessToken: site.accessToken,
          refreshToken: site.refreshToken
        };
      }
    }
    
    // Fallback to legacy format
    const accessToken = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`);
    const refreshToken = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_REFRESH_TOKEN`);
    
    return {
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('Error getting tokens for site:', error);
    return { accessToken: null, refreshToken: null };
  }
}

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    return null;
  }
}

async function putSSMParameter(name, value) {
  try {
    const command = new PutParameterCommand({
      Name: name,
      Value: value,
      Type: 'SecureString',
      Overwrite: true
    });
    await ssmClient.send(command);
    return true;
  } catch (error) {
    console.error(`Error setting SSM parameter ${name}:`, error);
    return false;
  }
}

export async function GET() {
  try {
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    // Get sites configuration
    const sitesConfig = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_SITES`);
    let sites = [];
    let hasTokens = false;
    
    if (sitesConfig) {
      try {
        const parsedSites = JSON.parse(sitesConfig);
        sites = parsedSites.map(site => ({
          siteUrl: site.siteUrl,
          accessToken: site.accessToken ? '••••••••' : '',
          refreshToken: site.refreshToken ? '••••••••' : ''
        }));
        hasTokens = parsedSites.some(site => site.accessToken && site.refreshToken);
      } catch (error) {
        console.error('Error parsing sites config:', error);
      }
    }
    
    // Fallback to legacy single token format if no sites config
    if (sites.length === 0) {
      const accessToken = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`);
      const refreshToken = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_REFRESH_TOKEN`);
      
      if (accessToken && refreshToken) {
        sites = [{
          siteUrl: 'netsync.webex.com', // Default site
          accessToken: '••••••••',
          refreshToken: '••••••••'
        }];
        hasTokens = true;
      }
    }
    
    return NextResponse.json({
      sites,
      hasTokens
    });
  } catch (error) {
    console.error('Error loading Service App tokens:', error);
    return NextResponse.json({ error: 'Failed to load tokens' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { sites } = await request.json();
    
    if (!sites || !Array.isArray(sites)) {
      return NextResponse.json({ error: 'Sites array is required' }, { status: 400 });
    }
    
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    // Filter out sites with masked tokens and prepare for storage
    const sitesToStore = sites
      .filter(site => site.siteUrl && site.siteUrl.trim())
      .map(site => ({
        siteUrl: site.siteUrl.trim(),
        accessToken: site.accessToken === '••••••••' ? null : site.accessToken,
        refreshToken: site.refreshToken === '••••••••' ? null : site.refreshToken
      }));
    
    // Get existing sites to preserve masked tokens
    const existingSitesConfig = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_SITES`);
    let existingSites = [];
    if (existingSitesConfig) {
      try {
        existingSites = JSON.parse(existingSitesConfig);
      } catch (error) {
        console.error('Error parsing existing sites:', error);
      }
    }
    
    // Merge new tokens with existing ones
    const finalSites = sitesToStore.map(newSite => {
      const existingSite = existingSites.find(s => s.siteUrl === newSite.siteUrl);
      return {
        siteUrl: newSite.siteUrl,
        accessToken: newSite.accessToken || existingSite?.accessToken || '',
        refreshToken: newSite.refreshToken || existingSite?.refreshToken || ''
      };
    });
    
    // Store sites configuration
    await putSSMParameter(`${prefix}/WEBEX_MEETINGS_SITES`, JSON.stringify(finalSites));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Service App tokens:', error);
    return NextResponse.json({ error: 'Failed to save tokens' }, { status: 500 });
  }
}