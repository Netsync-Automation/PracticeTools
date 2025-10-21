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
  'spark-compliance:webhooks_read',
  'spark-compliance:webhooks_write',
  'meeting:recordings_read',
  'meeting:transcripts_read',
  'meeting:admin_transcripts_read'
];

const API_TESTS = [
  {
    name: 'Webhooks Read',
    endpoint: 'https://webexapis.com/v1/webhooks',
    method: 'GET', 
    requiredScopes: ['spark-compliance:webhooks_read'],
    description: 'Tests webhook listing used in validation'
  },
  {
    name: 'Webhooks Write',
    endpoint: 'https://webexapis.com/v1/webhooks',
    method: 'POST',
    requiredScopes: ['spark-compliance:webhooks_write'],
    description: 'Tests webhook creation capability',
    testPayload: {
      name: 'API Validation Test',
      targetUrl: 'https://example.com/webhook',
      resource: 'recordings',
      event: 'created'
    }
  },
  {
    name: 'Recordings Access',
    endpoint: 'https://webexapis.com/v1/recordings',
    method: 'GET',
    requiredScopes: ['meeting:recordings_read'],
    description: 'Tests recordings API access as documented at https://developer.webex.com/meeting/docs/api/v1/recordings/list-recordings'
  },
  {
    name: 'Meeting Transcripts',
    endpoint: 'https://webexapis.com/v1/meetingTranscripts',
    method: 'GET',
    requiredScopes: ['meeting:transcripts_read', 'meeting:admin_transcripts_read'],
    description: 'Tests transcript access used in transcript processing'
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
          let fetchOptions = {
            method: test.method,
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          };
          
          // For webhook write test, include test payload
          if (test.method === 'POST' && test.testPayload) {
            fetchOptions.body = JSON.stringify(test.testPayload);
          }
          
          const response = await fetch(test.endpoint, fetchOptions);

          const testResult = {
            name: test.name,
            endpoint: test.endpoint,
            status: (response.ok || (test.method === 'POST' && response.status === 409)) ? 'success' : 'error',
            statusCode: response.status,
            description: test.description,
            requiredScopes: test.requiredScopes
          };

          if (!response.ok && !(test.method === 'POST' && response.status === 409)) {
            const errorData = await response.json().catch(() => ({}));
            testResult.error = errorData.message || `HTTP ${response.status}`;
            
            if (response.status === 403 || response.status === 401) {
              siteResult.scopes.missing.push(...test.requiredScopes);
            }
          } else if (test.method === 'POST' && response.status === 409) {
            testResult.note = 'Webhook already exists (scope validated)';
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
      
      if (hasErrors) {
        siteResult.status = 'error';
        siteResult.error = 'API tests failed';
      }
      
      // Determine missing scopes based on failed API tests
      siteResult.scopes.missing = siteResult.tests
        .filter(t => t.status === 'error' && (t.statusCode === 403 || t.statusCode === 401))
        .flatMap(t => t.requiredScopes);

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