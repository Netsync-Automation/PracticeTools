import { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { readFileSync } from 'fs';

let client = null;
let clientId = null;

function getClient() {
  if (!client) {
    clientId = Math.random().toString(36).substring(7);
    
    let credentials;
    try {
      const envContent = readFileSync('.env.local', 'utf8');
      const envVars = {};
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          envVars[key] = value;
        }
      });
      
      if (envVars.AWS_ACCESS_KEY_ID && envVars.AWS_SECRET_ACCESS_KEY) {
        credentials = {
          accessKeyId: envVars.AWS_ACCESS_KEY_ID,
          secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY
        };
      } else {
        credentials = fromNodeProviderChain({
          timeout: 5000,
          maxRetries: 3,
        });
      }
    } catch {
      credentials = fromNodeProviderChain({
        timeout: 5000,
        maxRetries: 3,
      });
    }
    
    client = new DynamoDBClient({
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      credentials,
      maxAttempts: 3,
      retryMode: 'adaptive',
    });
    console.log('DynamoDB client created', { clientId });
  }
  return client;
}

const ENV = process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';

const TABLES = {
  USERS: `PracticeTools-${ENV}-Users`,
  SETTINGS: `PracticeTools-${ENV}-Settings`,
  RELEASES: `PracticeTools-${ENV}-Releases`,
  FEATURES: `PracticeTools-${ENV}-Features`
};

console.log(`🗄️ DynamoDB Environment: ${ENV}`);
console.log(`🗄️ Using tables with prefix: PracticeTools-${ENV}-*`);

export class DatabaseService {
  constructor() {
    // Client created lazily
  }
  
  get client() {
    return getClient();
  }

  async getUser(email) {
    const command = new GetItemCommand({
      TableName: TABLES.USERS,
      Key: { email: { S: email } }
    });
    
    try {
      const result = await this.client.send(command);
      return result.Item ? this.formatUserItem(result.Item) : null;
    } catch (error) {
      console.error('DynamoDB getUser error', { error: error.message });
      return null;
    }
  }

  formatUserItem(item) {
    return {
      email: item.email?.S || '',
      name: item.name?.S || '',
      role: item.role?.S || 'user',
      auth_method: item.auth_method?.S || 'local',
      password: item.password?.S || null,
      created_at: item.created_at?.S || '',
      last_login: item.last_login?.S || ''
    };
  }

  async createUser(userData) {
    const hashedPassword = userData.password ? await bcrypt.hash(userData.password, 12) : null;
    
    const command = new PutItemCommand({
      TableName: TABLES.USERS,
      Item: {
        email: { S: userData.email },
        name: { S: userData.name },
        role: { S: userData.role || 'user' },
        auth_method: { S: userData.auth_method || 'local' },
        password: hashedPassword ? { S: hashedPassword } : undefined,
        created_at: { S: new Date().toISOString() },
        last_login: { S: new Date().toISOString() }
      }
    });

    // Remove undefined values
    Object.keys(command.input.Item).forEach(key => {
      if (command.input.Item[key] === undefined) {
        delete command.input.Item[key];
      }
    });

    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error creating user:', error);
      return false;
    }
  }

  async saveSetting(key, value) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.SETTINGS,
        Item: {
          setting_key: { S: key },
          setting_value: { S: value },
          updated_at: { S: new Date().toISOString() }
        }
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createSettingsTable();
        try {
          await this.client.send(command);
          return true;
        } catch (retryError) {
          console.error('Error saving setting after table creation:', retryError);
          return false;
        }
      }
      console.error('Error saving setting:', error);
      return false;
    }
  }

  async getSetting(key) {
    try {
      const command = new GetItemCommand({
        TableName: TABLES.SETTINGS,
        Key: {
          setting_key: { S: key }
        }
      });
      const result = await this.client.send(command);
      return result.Item?.setting_value?.S || null;
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  }

  async createSettingsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.SETTINGS,
        KeySchema: [{
          AttributeName: 'setting_key',
          KeyType: 'HASH'
        }],
        AttributeDefinitions: [{
          AttributeName: 'setting_key',
          AttributeType: 'S'
        }],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return true;
    } catch (error) {
      console.error('Error creating settings table:', error);
      return false;
    }
  }

  async getReleases() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.RELEASES
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        version: item.version?.S || '',
        date: item.date?.S || '',
        type: item.type?.S || 'Minor Release',
        features: JSON.parse(item.features?.S || '[]'),
        improvements: JSON.parse(item.improvements?.S || '[]'),
        bugFixes: JSON.parse(item.bugFixes?.S || '[]'),
        breaking: JSON.parse(item.breaking?.S || '[]'),
        notes: item.notes?.S || ''
      }));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        return [];
      }
      console.error('Error getting releases:', error);
      return [];
    }
  }

  async saveRelease(release) {
    const command = new PutItemCommand({
      TableName: TABLES.RELEASES,
      Item: {
        version: { S: release.version },
        date: { S: release.date },
        type: { S: release.type },
        features: { S: JSON.stringify(release.features || []) },
        improvements: { S: JSON.stringify(release.improvements || []) },
        bugFixes: { S: JSON.stringify(release.bugFixes || []) },
        breaking: { S: JSON.stringify(release.breaking || []) },
        notes: { S: release.notes || '' },
        created_at: { S: new Date().toISOString() }
      }
    });
    
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createReleasesTable();
        try {
          await this.client.send(command);
          return true;
        } catch (retryError) {
          console.error('Error saving release after table creation:', retryError);
          return false;
        }
      }
      console.error('Error saving release:', error);
      return false;
    }
  }

  async createReleasesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.RELEASES,
        KeySchema: [{
          AttributeName: 'version',
          KeyType: 'HASH'
        }],
        AttributeDefinitions: [{
          AttributeName: 'version',
          AttributeType: 'S'
        }],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 15000));
      return true;
    } catch (error) {
      console.error('Error creating Releases table:', error);
      return false;
    }
  }
}

export const db = new DatabaseService();