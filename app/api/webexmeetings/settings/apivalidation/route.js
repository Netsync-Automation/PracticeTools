import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getSecureParameter } from '../../../../../lib/ssm-config';
import { getEnvironment } from '../../../../../lib/dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function getWebexMeetingsConfig() {
  const tableName = getTableName('Settings');
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  return result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
}

const REQUIRED_SCOPES = [
  'spark:webhooks_read',
  'spark:webhooks_write', 
  'meeting:recordings_read',
  'meeting:transcripts_read',
  'meeting:admin_transcripts_read'
];

const API_TESTS = [
  {
    name: 'Token Info',
    endpoint: 'https://webexapis.com/v1/people/me',
    method: 'GET',
    requiredScopes: [],
    description: 'Validates token and gets user info'
  },
  {
    name: 'Webhooks List',
    endpoint: 'https://webexapis.com/v1/webhooks',
    method: 'GET', 
    requiredScopes: ['spark:webhooks_read'],
    description: 'Lists existing webhooks'
  },
  {
    name: 'Recordings Access',
    endpoint: 'https://webexapis.com/v1/recordings',
    method: 'GET',
    requiredScopes: ['meeting:recordings_read'],
    description: 'Tests recordings API access'
  },
  {
    name: 'Admin Transcripts Access',
    endpoint: 'https://webexapis.com/v1/admin/meetingTranscripts',
    method: 'GET',
    requiredScopes: ['meeting:admin_transcripts_read'],
    description: 'Tests admin transcripts API access'
  },
  {
    name: 'Meeting Transcripts Access',
    endpoint: 'https://webexapis.com/v1/meetingTranscripts',
    method: 'GET',
    requiredScopes: ['meeting:transcripts_read'],
    description: 'Tests meeting transcripts API used after webhook notifications'
  }
];

export async function POST(request) {
  try {
    const config = await getWebexMeetingsConfig();
    
    if (!config?.enabled || !config.sites?.length) {
      return NextResponse.json({ error: 'WebexMeetings not configured' }, { status: 400 });
    }

    const results = [];

    for (const site of config.sites) {
      const env = getEnvironment();
      const siteName = site.siteUrl.split('.')[0].toUpperCase();
      const basePath = env === 'prod' ? '/PracticeTools' : '/PracticeTools/dev';
      const accessTokenParam = `${basePath}/${siteName}_WEBEX_MEETINGS_ACCESS_TOKEN`;
      
      const accessToken = await getSecureParameter(accessTokenParam);
      
      if (!accessToken) {
        results.push({
          site: site.siteUrl,
          status: 'error',
          error: `Access token not found: ${accessTokenParam}`,
          tests: []
        });
        continue;
      }

      const siteResult = {
        site: site.siteUrl,
        status: 'success',
        tests: [],
        scopes: {
          required: REQUIRED_SCOPES,
          missing: []
        }
      };

      for (const test of API_TESTS) {
        try {
          let testEndpoint = test.endpoint;
          
          // For site-specific endpoints, use the site URL
          if (test.name === 'Meeting Transcripts Access') {
            testEndpoint = `${site.siteUrl}/v1/meetingTranscripts`;
          }
          
          const response = await fetch(testEndpoint, {
            method: test.method,
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          const testResult = {
            name: test.name,
            endpoint: testEndpoint,
            status: response.ok ? 'success' : 'error',
            statusCode: response.status,
            description: test.description,
            requiredScopes: test.requiredScopes
          };

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            testResult.error = errorData.message || `HTTP ${response.status}`;
            
            if (response.status === 403 || response.status === 401) {
              siteResult.scopes.missing.push(...test.requiredScopes);
            }
          } else {
            if (test.name === 'Token Info') {
              const data = await response.json();
              siteResult.actualScopes = data.scopes || [];
              
              const actualScopes = data.scopes || [];
              siteResult.scopes.missing = REQUIRED_SCOPES.filter(scope => 
                !actualScopes.includes(scope)
              );
            }
          }

          siteResult.tests.push(testResult);
        } catch (error) {
          siteResult.tests.push({
            name: test.name,
            endpoint: test.endpoint,
            status: 'error',
            error: error.message,
            description: test.description,
            requiredScopes: test.requiredScopes
          });
        }
      }

      const hasErrors = siteResult.tests.some(t => t.status === 'error');
      const hasMissingScopes = siteResult.scopes.missing.length > 0;
      
      if (hasErrors || hasMissingScopes) {
        siteResult.status = 'error';
        siteResult.error = hasErrors ? 'API tests failed' : 'Missing required scopes';
      }

      results.push(siteResult);
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('API validation error:', error);
    return NextResponse.json({ 
      error: 'Validation failed', 
      details: error.message 
    }, { status: 500 });
  }
}