import { NextResponse } from 'next/server';
import { PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { db } from '../../../../lib/dynamodb';
import { getCached, setCached, clearCache } from '../../../../lib/cache';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { appName, loginLogo, navbarLogo, allowedFileTypes } = await request.json();
    
    if (!appName?.trim()) {
      return NextResponse.json({ error: 'App name is required' }, { status: 400 });
    }

    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    // Save app name
    await saveEnvironmentSetting(tableName, 'app_name', appName.trim(), environment);
    
    // Save login logo if provided
    if (loginLogo) {
      await saveEnvironmentSetting(tableName, 'login_logo', loginLogo, environment);
    }
    
    // Save navbar logo if provided
    if (navbarLogo) {
      await saveEnvironmentSetting(tableName, 'navbar_logo', navbarLogo, environment);
    }
    
    // Save allowed file types if provided
    if (allowedFileTypes) {
      await saveEnvironmentSetting(tableName, 'allowed_file_types', allowedFileTypes, environment);
    }
    
    // Clear cache when settings are updated
    clearCache('settings_general');
    
    // Send SSE notification for real-time updates
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'general-settings-update'
      })
    }).catch(() => {}); // Silent fail for SSE
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const environment = getEnvironment();
    const cacheKey = `settings_general_${environment}`;
    
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    const tableName = getTableName('Settings');
    
    const appName = await getEnvironmentSetting(tableName, 'app_name', environment) || getDefaultAppName(environment);
    let loginLogo = await getEnvironmentSetting(tableName, 'login_logo', environment);
    let navbarLogo = await getEnvironmentSetting(tableName, 'navbar_logo', environment);
    const allowedFileTypes = await getEnvironmentSetting(tableName, 'allowed_file_types', environment) || '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
    
    // Initialize with default logos if not set
    if (!loginLogo) {
      loginLogo = await initializeDefaultLogo(tableName, 'login_logo', 'netsync.svg', 'svg+xml', environment);
    }
    
    if (!navbarLogo) {
      navbarLogo = await initializeDefaultLogo(tableName, 'navbar_logo', 'company-logo.png', 'png', environment);
    }
    
    const response = { 
      appName, 
      loginLogo, 
      navbarLogo, 
      allowedFileTypes,
      defaultAppName: getDefaultAppName(environment),
      defaultNavbarLogo: '/company-logo.png'
    };
    
    // Cache the response for 60 seconds
    setCached(cacheKey, response, 60000);
    
    return NextResponse.json(response);
  } catch (error) {
    const environment = getEnvironment();
    return NextResponse.json({ 
      appName: getDefaultAppName(environment), 
      loginLogo: null, 
      navbarLogo: null,
      allowedFileTypes: '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg',
      defaultAppName: getDefaultAppName(environment),
      defaultNavbarLogo: '/company-logo.png'
    });
  }
}

async function saveEnvironmentSetting(tableName, key, value, environment) {
  const command = new PutItemCommand({
    TableName: tableName,
    Item: {
      id: { S: `${environment}_${key}` },
      setting_key: { S: key },
      setting_value: { S: value },
      environment: { S: environment },
      updated_at: { S: new Date().toISOString() }
    }
  });
  await db.client.send(command);
}

async function getEnvironmentSetting(tableName, key, environment) {
  try {
    const command = new GetItemCommand({
      TableName: tableName,
      Key: {
        id: { S: `${environment}_${key}` }
      }
    });
    const result = await db.client.send(command);
    return result.Item?.setting_value?.S || null;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await createSettingsTable(tableName);
    }
    return null;
  }
}

async function initializeDefaultLogo(tableName, key, filename, mimeType, environment) {
  try {
    const logoPath = path.join(process.cwd(), 'public', filename);
    const logoData = fs.readFileSync(logoPath, 'base64');
    const dataUrl = `data:image/${mimeType};base64,${logoData}`;
    await saveEnvironmentSetting(tableName, key, dataUrl, environment);
    return dataUrl;
  } catch (error) {
    return null;
  }
}

function getDefaultAppName(environment) {
  return 'Practice Tools';
}

async function createSettingsTable(tableName) {
  try {
    const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST'
    });
    await db.client.send(command);
    await new Promise(resolve => setTimeout(resolve, 10000));
    return true;
  } catch (error) {
    return false;
  }
}