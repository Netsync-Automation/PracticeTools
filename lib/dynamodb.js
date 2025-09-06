import { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { logger } from './safe-logger.js';

import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { readFileSync } from 'fs';

let client = null;
let clientId = null;

function getClient() {
  if (!client) {
    clientId = Math.random().toString(36).substring(7);
    
    // Try to load local credentials for commit script
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
    logger.info('DynamoDB client created', { clientId });
  }
  return client;
}

// Ensure we never accidentally use prod tables from dev
const ENV = process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';

const TABLES = {
  ISSUES: `PracticeTools-${ENV}-Issues`,
  USERS: `PracticeTools-${ENV}-Users`,
  UPVOTES: `PracticeTools-${ENV}-Upvotes`,
  COMMENTS: `PracticeTools-${ENV}-Comments`,
  FOLLOWERS: `PracticeTools-${ENV}-Followers`,
  SETTINGS: `PracticeTools-${ENV}-Settings`,
  STATUS_LOG: `PracticeTools-${ENV}-StatusLog`,
  RELEASES: `PracticeTools-${ENV}-Releases`,
  FEATURES: `PracticeTools-${ENV}-Features`,
  PRACTICE_INFO_PAGES: `PracticeTools-${ENV}-PracticeInfoPages`,
  ASSIGNMENTS: `PracticeTools-${ENV}-resource-assignments`,
  ASSIGNMENT_COMMENTS: `PracticeTools-${ENV}-assignment-comments`,
  EMAIL_RULES: `PracticeTools-${ENV}-EmailRules`,
  ASSIGNMENT_STATUS_LOG: `PracticeTools-${ENV}-AssignmentStatusLog`,
  PRACTICE_ETAS: `PracticeTools-${ENV}-PracticeETAs`
};

// Initialize default issue types
(async () => {
  try {
    const dbInstance = new DynamoDBService();
    
    // Always update to new issue types
    const newIssueTypes = [
      { name: 'Leadership Question', icon: '👔', active: true, description: 'Questions for leadership team' },
      { name: 'General Question', icon: '❓', active: true, description: 'General questions and inquiries' },
      { name: 'Feature Request', icon: '✨', active: true, description: 'Request new features or enhancements' },
      { name: 'Practice Question', icon: '🏢', active: true, description: 'Practice-specific questions' },
      { name: 'Process Question', icon: '📋', active: true, description: 'Questions about processes and procedures' },
      { name: 'Technical Question', icon: '🔧', active: true, description: 'Technical support and troubleshooting' },
      { name: 'Event Question', icon: '🎉', active: true, description: 'Questions about events and activities' }
    ];
    
    for (const type of newIssueTypes) {
      await dbInstance.saveIssueType(type);
    }
  } catch (error) {
    // Silent initialization - don't block startup
  }
})();

// Log table configuration for debugging
console.log(`🗄️ DynamoDB Environment: ${ENV}`);
console.log(`🗄️ Using tables with prefix: PracticeTools-${ENV}-*`);
process.env.ENVIRONMENT = ENV;
// Test: Environment detection and API authentication should now work correctly
// Force App Runner restart to pick up updated SSM parameters

export class DynamoDBService {
  constructor() {
    // Client created lazily
  }
  
  get client() {
    return getClient();
  }

  async addIssue(type, title, description, email, attachments = [], problemLink = '', practice = '', selectedLeadership = []) {
    const id = uuidv4();
    const issueNumber = await this.getNextIssueNumber();
    const timestamp = new Date().toISOString();
    
    const command = new PutItemCommand({
      TableName: TABLES.ISSUES,
      Item: {
        id: { S: id },
        issue_number: { N: issueNumber.toString() },
        issue_type: { S: type },
        title: { S: title },
        description: { S: description },
        problem_link: { S: problemLink },
        email: { S: email },
        status: { S: 'Open' },
        practice: { S: practice },
        selected_leadership: { S: JSON.stringify(selectedLeadership) },
        notes: { S: '' },
        admin_username: { S: '' },
        upvotes: { N: '0' },
        attachments: { S: JSON.stringify(attachments) },
        comments: { S: '[]' },
        resolution_comment: { S: '' },
        assigned_to: { S: '' },
        created_at: { S: timestamp },
        last_updated_at: { S: timestamp }
      }
    });
    
    try {
      await this.client.send(command);
      
      // Auto-follow: Create follow record for issue creator
      try {
        await this.ensureUserFollowing(id, email);
        logger.info('Auto-follow record ensured for issue creator');
      } catch (followError) {
        logger.error('Error creating auto-follow record', { error: followError.message });
        // Don't fail issue creation if auto-follow fails
      }
      

      
      return id;
    } catch (error) {
      logger.error('DynamoDB addIssue error', { error: error.message });
      return false;
    }
  }

  async getIssueById(id) {
    const command = new GetItemCommand({
      TableName: TABLES.ISSUES,
      Key: { id: { S: id } }
    });
    
    try {
      const result = await this.client.send(command);
      return result.Item ? this.formatIssueItem(result.Item) : null;
    } catch (error) {
      logger.error('DynamoDB getIssueById error', { error: error.message });
      return null;
    }
  }

  async getAllIssues() {
    const command = new ScanCommand({
      TableName: TABLES.ISSUES
    });
    
    try {
      const result = await this.client.send(command);
      const issues = (result.Items || []).map(item => this.formatIssueItem(item));
      
      return issues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      logger.error('DynamoDB getAllIssues error', { error: error.message });
      return [];
    }
  }

  async updateIssueStatus(id, status, admin, resolutionComment = '') {
    try {
      // Get current issue to log status change
      const currentIssue = await this.getIssueById(id);
      if (!currentIssue) return false;
      
      const command = new UpdateItemCommand({
        TableName: TABLES.ISSUES,
        Key: { id: { S: id } },
        UpdateExpression: 'SET #status = :status, admin_username = :admin, last_updated_at = :timestamp, resolution_comment = :resolution',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': { S: status },
          ':admin': { S: admin },
          ':timestamp': { S: new Date().toISOString() },
          ':resolution': { S: resolutionComment }
        }
      });
      
      await this.client.send(command);
      
      // Log status change if different
      if (currentIssue.status !== status) {
        await this.logStatusChange(id, currentIssue.status, status, admin);
      }
      
      return true;
    } catch (error) {
      logger.error('DynamoDB updateIssueStatus error', { error: error.message });
      return false;
    }
  }

  async updateIssueContent(id, title, description, problemLink = '') {
    const command = new UpdateItemCommand({
      TableName: TABLES.ISSUES,
      Key: { id: { S: id } },
      UpdateExpression: 'SET title = :title, description = :description, problem_link = :problem_link, last_updated_at = :timestamp',
      ExpressionAttributeValues: {
        ':title': { S: title },
        ':description': { S: description },
        ':problem_link': { S: problemLink },
        ':timestamp': { S: new Date().toISOString() }
      }
    });
    
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('DynamoDB updateIssueContent error', { error: error.message });
      return false;
    }
  }

  async updateIssueAssignment(id, assignedTo, admin) {
    const command = new UpdateItemCommand({
      TableName: TABLES.ISSUES,
      Key: { id: { S: id } },
      UpdateExpression: 'SET assigned_to = :assigned_to, last_updated_at = :timestamp',
      ExpressionAttributeValues: {
        ':assigned_to': { S: assignedTo },
        ':timestamp': { S: new Date().toISOString() }
      }
    });
    
    try {
      await this.client.send(command);
      
      // Auto-follow: Ensure assigned admin is following the issue
      if (assignedTo) {
        try {
          // Get admin email from name
          const admins = await this.getAllUsers();
          const assignedAdmin = admins.find(user => user.name === assignedTo && user.role === 'admin');
          if (assignedAdmin) {
            await this.ensureUserFollowing(id, assignedAdmin.email);
            logger.info('Auto-follow record ensured for assigned admin');
          }
        } catch (followError) {
          logger.error('Error creating auto-follow record for assigned admin', { error: followError.message });
          // Don't fail assignment if auto-follow fails
        }
      }
      
      return true;
    } catch (error) {
      logger.error('DynamoDB updateIssueAssignment error', { error: error.message });
      return false;
    }
  }

  async deleteIssue(id) {
    try {
      // Delete from issues table
      const deleteIssueCommand = new DeleteItemCommand({
        TableName: TABLES.ISSUES,
        Key: { id: { S: id } }
      });
      await this.client.send(deleteIssueCommand);
      
      // Delete related upvotes
      const upvotesCommand = new ScanCommand({
        TableName: TABLES.UPVOTES,
        FilterExpression: 'issue_id = :issueId',
        ExpressionAttributeValues: {
          ':issueId': { S: id }
        }
      });
      
      const upvotesResult = await this.client.send(upvotesCommand);
      for (const upvote of upvotesResult.Items || []) {
        const deleteUpvoteCommand = new DeleteItemCommand({
          TableName: TABLES.UPVOTES,
          Key: {
            issue_id: { S: upvote.issue_id.S },
            user_email: { S: upvote.user_email.S }
          }
        });
        await this.client.send(deleteUpvoteCommand);
      }
      
      // Delete related follows
      try {
        const followsCommand = new ScanCommand({
          TableName: `PracticeTools-${ENV}-Followers`,
          FilterExpression: 'issue_id = :issueId',
          ExpressionAttributeValues: {
            ':issueId': { S: id }
          }
        });
        
        const followsResult = await this.client.send(followsCommand);
        for (const follow of followsResult.Items || []) {
          const deleteFollowCommand = new DeleteItemCommand({
            TableName: `PracticeTools-${ENV}-Followers`,
            Key: {
              issue_id: { S: follow.issue_id.S },
              user_email: { S: follow.user_email.S }
            }
          });
          await this.client.send(deleteFollowCommand);
        }
      } catch (followError) {
        // Followers table might not exist, continue
      }
      
      return true;
    } catch (error) {
      console.error('DynamoDB deleteIssue error:', error);
      return false;
    }
  }

  async upvoteIssue(id, userEmail) {
    if (await this.hasUserUpvoted(id, userEmail)) {
      return { success: false, alreadyUpvoted: true };
    }
    
    try {
      const upvoteCommand = new PutItemCommand({
        TableName: TABLES.UPVOTES,
        Item: {
          issue_id: { S: id },
          user_email: { S: userEmail },
          created_at: { S: new Date().toISOString() }
        },
        ConditionExpression: 'attribute_not_exists(issue_id) AND attribute_not_exists(user_email)'
      });
      
      await this.client.send(upvoteCommand);
      
      const updateCommand = new UpdateItemCommand({
        TableName: TABLES.ISSUES,
        Key: { id: { S: id } },
        UpdateExpression: 'SET upvotes = if_not_exists(upvotes, :zero) + :inc',
        ExpressionAttributeValues: {
          ':inc': { N: '1' },
          ':zero': { N: '0' }
        }
      });
      
      await this.client.send(updateCommand);
      
      // Auto-follow: Ensure upvoter is following the issue
      try {
        await this.ensureUserFollowing(id, userEmail);
      } catch (followError) {
        // Don't fail upvote if auto-follow fails
      }
      
      return { success: true, alreadyUpvoted: false };
    } catch (error) {
      console.error('DynamoDB upvoteIssue error:', error);
      return { success: false, alreadyUpvoted: false };
    }
  }

  async hasUserUpvoted(issueId, userEmail) {
    const command = new GetItemCommand({
      TableName: TABLES.UPVOTES,
      Key: {
        issue_id: { S: issueId },
        user_email: { S: userEmail }
      }
    });
    
    try {
      const result = await this.client.send(command);
      return !!result.Item;
    } catch (error) {
      return false;
    }
  }

  async getIssueUpvoters(issueId) {
    const command = new ScanCommand({
      TableName: TABLES.UPVOTES,
      FilterExpression: 'issue_id = :issueId',
      ExpressionAttributeValues: {
        ':issueId': { S: issueId }
      }
    });
    
    try {
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        user_email: item.user_email?.S || '',
        created_at: item.created_at?.S || ''
      }));
    } catch (error) {
      logger.error('Error getting issue upvoters', { error: error.message });
      return [];
    }
  }

  async createUser(user) {
    return this.createOrUpdateUser(
      user.email,
      user.name,
      user.auth_method || 'saml',
      user.role || 'practice_member',
      null,
      'saml'
    );
  }

  async createOrUpdateUser(email, name, authMethod = 'saml', role = 'practice_member', password = null, createdFrom = 'manual', requirePasswordChange = false, isAdmin = false, practices = [], status = 'active', webexBotSource = null) {
    const item = {
      email: { S: email },
      name: { S: name },
      role: { S: role },
      is_admin: { BOOL: isAdmin },
      practices: { S: JSON.stringify(practices) },
      status: { S: status },
      auth_method: { S: authMethod },
      created_from: { S: createdFrom },
      created_at: { S: new Date().toISOString() },
      last_login: { S: new Date().toISOString() }
    };
    
    // Add WebEx bot source if provided
    if (webexBotSource) {
      item.webex_bot_source = { S: webexBotSource };
    }
    
    // Hash password if provided for local auth
    if (password && authMethod === 'local') {
      const hashedPassword = await bcrypt.hash(password, 10);
      item.password = { S: hashedPassword };
    }
    
    // Add password change requirement flag
    if (requirePasswordChange) {
      item.require_password_change = { BOOL: true };
    }
    
    const command = new PutItemCommand({
      TableName: TABLES.USERS,
      Item: item
    });
    
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('DynamoDB createOrUpdateUser error', { error: error.message });
      return false;
    }
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
      logger.error('DynamoDB getUser error', { error: error.message });
      return null;
    }
  }

  async getAllUsers() {
    const command = new ScanCommand({
      TableName: TABLES.USERS
    });
    
    try {
      const result = await this.client.send(command);
      return (result.Items || []).map(item => this.formatUserItem(item));
    } catch (error) {
      return [];
    }
  }

  formatIssueItem(item) {
    return {
      id: item.id?.S || '',
      issue_number: parseInt(item.issue_number?.N || '0'),
      issue_type: item.issue_type?.S || '',
      title: item.title?.S || '',
      description: item.description?.S || '',
      problem_link: item.problem_link?.S || '',
      email: item.email?.S || '',
      status: item.status?.S || 'Open',
      practice: item.practice?.S || '',
      selected_leadership: JSON.parse(item.selected_leadership?.S || '[]'),
      admin_username: item.admin_username?.S || '',
      upvotes: parseInt(item.upvotes?.N || '0'),
      attachments: item.attachments?.S || '[]',
      comments: item.comments?.S || '[]',
      resolution_comment: item.resolution_comment?.S || '',
      assigned_to: item.assigned_to?.S || '',
      created_at: item.created_at?.S || '',
      last_updated_at: item.last_updated_at?.S || ''
    };
  }

  async updateUser(email, updates) {
    const updateExpressions = [];
    const attributeValues = {};
    const attributeNames = {};
    
    if (updates.name) {
      updateExpressions.push('#name = :name');
      attributeValues[':name'] = { S: updates.name };
      attributeNames['#name'] = 'name';
    }
    
    if (updates.role) {
      updateExpressions.push('#role = :role');
      attributeValues[':role'] = { S: updates.role };
      attributeNames['#role'] = 'role';
    }
    
    if (updates.hasOwnProperty('isAdmin')) {
      updateExpressions.push('is_admin = :is_admin');
      attributeValues[':is_admin'] = { BOOL: updates.isAdmin };
    }
    
    if (updates.practices) {
      updateExpressions.push('practices = :practices');
      attributeValues[':practices'] = { S: JSON.stringify(updates.practices) };
    }
    
    if (updates.status) {
      updateExpressions.push('#status = :status');
      attributeValues[':status'] = { S: updates.status };
      attributeNames['#status'] = 'status';
    }
    
    if (updates.auth_method) {
      updateExpressions.push('auth_method = :auth_method');
      attributeValues[':auth_method'] = { S: updates.auth_method };
    }
    
    if (updates.created_from) {
      updateExpressions.push('created_from = :created_from');
      attributeValues[':created_from'] = { S: updates.created_from };
    }
    
    if (updates.hasOwnProperty('require_password_change')) {
      updateExpressions.push('require_password_change = :require_password_change');
      attributeValues[':require_password_change'] = { BOOL: updates.require_password_change };
    }
    
    if (updates.webex_bot_source) {
      updateExpressions.push('webex_bot_source = :webex_bot_source');
      attributeValues[':webex_bot_source'] = { S: updates.webex_bot_source };
    }
    
    if (updateExpressions.length === 0) {
      return true; // No updates needed
    }
    
    const command = new UpdateItemCommand({
      TableName: TABLES.USERS,
      Key: { email: { S: email } },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(attributeNames).length > 0 ? attributeNames : undefined,
      ExpressionAttributeValues: attributeValues
    });
    
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('DynamoDB updateUser error:', error);
      return false;
    }
  }

  async deleteUser(email) {
    const command = new DeleteItemCommand({
      TableName: TABLES.USERS,
      Key: { email: { S: email } }
    });
    
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('DynamoDB deleteUser error:', error);
      return false;
    }
  }

  async resetUserPassword(email, password) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const command = new UpdateItemCommand({
        TableName: TABLES.USERS,
        Key: { email: { S: email } },
        UpdateExpression: 'SET password = :password REMOVE require_password_change',
        ExpressionAttributeValues: {
          ':password': { S: hashedPassword }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('DynamoDB resetUserPassword error:', error);
      return false;
    }
  }

  async setUserForcePasswordReset(email) {
    try {
      const command = new UpdateItemCommand({
        TableName: TABLES.USERS,
        Key: { email: { S: email } },
        UpdateExpression: 'SET require_password_change = :require',
        ExpressionAttributeValues: {
          ':require': { BOOL: true }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('DynamoDB setUserForcePasswordReset error:', error);
      return false;
    }
  }

  formatUserItem(item) {
    return {
      email: item.email?.S || '',
      name: item.name?.S || '',
      role: item.role?.S || 'practice_member',
      isAdmin: item.is_admin?.BOOL || false,
      practices: JSON.parse(item.practices?.S || '[]'),
      status: item.status?.S || 'active',
      auth_method: item.auth_method?.S || 'saml',
      created_from: item.created_from?.S || 'manual',
      password: item.password?.S || null,
      require_password_change: item.require_password_change?.BOOL || false,
      created_at: item.created_at?.S || '',
      last_login: item.last_login?.S || '',
      webex_bot_source: item.webex_bot_source?.S || null
    };
  }

  async getWebexBots() {
    const command = new ScanCommand({
      TableName: TABLES.SETTINGS,
      FilterExpression: 'begins_with(setting_key, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': { S: 'webex_bot_' }
      }
    });
    
    try {
      const result = await this.client.send(command);
      return (result.Items || []).map(item => JSON.parse(item.setting_value?.S || '{}'));
    } catch (error) {
      console.error('Error getting WebEx bots:', error);
      return [];
    }
  }

  async saveWebexBot(botConfig) {
    const botId = botConfig.id || uuidv4();
    const command = new PutItemCommand({
      TableName: TABLES.SETTINGS,
      Item: {
        setting_key: { S: `webex_bot_${botId}` },
        setting_value: { S: JSON.stringify({ ...botConfig, id: botId }) },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    try {
      await this.client.send(command);
      return botId;
    } catch (error) {
      console.error('Error saving WebEx bot:', error);
      return false;
    }
  }

  async deleteWebexBot(botId) {
    const command = new DeleteItemCommand({
      TableName: TABLES.SETTINGS,
      Key: {
        setting_key: { S: `webex_bot_${botId}` }
      }
    });
    
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting WebEx bot:', error);
      return false;
    }
  }

  async getPracticeWebexBot(practice) {
    try {
      const bots = await this.getWebexBots();
      return bots.find(bot => bot.practices && bot.practices.includes(practice)) || null;
    } catch (error) {
      console.error('Error getting practice WebEx bot:', error);
      return null;
    }
  }

  async addComment(issueId, userEmail, userName, message, attachments = [], isAdmin = false) {
    try {
      const issue = await this.getIssueById(issueId);
      if (!issue) return false;
      
      const existingComments = JSON.parse(issue.comments || '[]');
      const newComment = {
        id: uuidv4(),
        user_email: userEmail,
        user_name: userName,
        message: message,
        attachments: JSON.stringify(attachments),
        is_admin: isAdmin,
        created_at: new Date().toISOString()
      };
      
      existingComments.push(newComment);
      
      const command = new UpdateItemCommand({
        TableName: TABLES.ISSUES,
        Key: { id: { S: issueId } },
        UpdateExpression: 'SET comments = :comments',
        ExpressionAttributeValues: {
          ':comments': { S: JSON.stringify(existingComments) }
        }
      });
      
      await this.client.send(command);
      return newComment.id;
    } catch (error) {
      console.error('DynamoDB addComment error:', error);
      return false;
    }
  }

  async getComments(issueId) {
    try {
      const issue = await this.getIssueById(issueId);
      if (!issue) return [];
      
      const comments = JSON.parse(issue.comments || '[]');
      return comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } catch (error) {
      console.error('DynamoDB getComments error:', error);
      return [];
    }
  }

  formatCommentItem(item) {
    return {
      id: item.id?.S || '',
      issue_id: item.issue_id?.S || '',
      user_email: item.user_email?.S || '',
      user_name: item.user_name?.S || '',
      message: item.message?.S || '',
      created_at: item.created_at?.S || ''
    };
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
        // Retry after creating table
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

  async deleteSetting(key) {
    try {
      const command = new DeleteItemCommand({
        TableName: TABLES.SETTINGS,
        Key: {
          setting_key: { S: key }
        }
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting setting:', error);
      return false;
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
      // Wait for table to be active
      await new Promise(resolve => setTimeout(resolve, 5000));
      return true;
    } catch (error) {
      console.error('Error creating settings table:', error);
      return false;
    }
  }

  async getNextIssueNumber() {
    try {
      // Get current counter
      const getCommand = new GetItemCommand({
        TableName: TABLES.SETTINGS,
        Key: { setting_key: { S: 'issue_counter' } }
      });
      
      const result = await this.client.send(getCommand);
      const currentNumber = parseInt(result.Item?.setting_value?.S || '0');
      const nextNumber = currentNumber + 1;
      
      // Update counter
      const putCommand = new PutItemCommand({
        TableName: TABLES.SETTINGS,
        Item: {
          setting_key: { S: 'issue_counter' },
          setting_value: { S: nextNumber.toString() },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(putCommand);
      return nextNumber;
    } catch (error) {
      console.error('Error getting next issue number:', error);
      return 1; // Fallback to 1 if error
    }
  }

  async getNextAssignmentNumber() {
    try {
      // Get current counter
      const getCommand = new GetItemCommand({
        TableName: TABLES.SETTINGS,
        Key: { setting_key: { S: 'assignment_counter' } }
      });
      
      const result = await this.client.send(getCommand);
      const currentNumber = parseInt(result.Item?.setting_value?.S || '0');
      const nextNumber = currentNumber + 1;
      
      // Update counter
      const putCommand = new PutItemCommand({
        TableName: TABLES.SETTINGS,
        Item: {
          setting_key: { S: 'assignment_counter' },
          setting_value: { S: nextNumber.toString() },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(putCommand);
      return nextNumber;
    } catch (error) {
      console.error('Error getting next assignment number:', error);
      return 1; // Fallback to 1 if error
    }
  }

  async updateAssignmentNumber(assignmentId, assignmentNumber) {
    try {
      const command = new UpdateItemCommand({
        TableName: TABLES.ASSIGNMENTS,
        Key: { id: { S: assignmentId } },
        UpdateExpression: 'SET assignment_number = :num',
        ExpressionAttributeValues: {
          ':num': { N: assignmentNumber.toString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error updating assignment number:', error);
      return false;
    }
  }

  async updateIssueNumber(issueId, issueNumber) {
    try {
      const command = new UpdateItemCommand({
        TableName: TABLES.ISSUES,
        Key: { id: { S: issueId } },
        UpdateExpression: 'SET issue_number = :num',
        ExpressionAttributeValues: {
          ':num': { N: issueNumber.toString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error updating issue number:', error);
      return false;
    }
  }

  async logStatusChange(issueId, fromStatus, toStatus, changedBy) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.STATUS_LOG,
        Item: {
          id: { S: uuidv4() },
          issue_id: { S: issueId },
          from_status: { S: fromStatus },
          to_status: { S: toStatus },
          changed_by: { S: changedBy },
          changed_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      console.log('Status change logged:', { issueId, fromStatus, toStatus, changedBy });
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('StatusLog table not found, creating...');
        await this.createStatusLogTable();
        // Retry after creating table
        try {
          await this.client.send(command);
          console.log('Status change logged after table creation:', { issueId, fromStatus, toStatus, changedBy });
          return true;
        } catch (retryError) {
          console.error('Error logging status change after table creation:', retryError);
          return false;
        }
      }
      console.error('Error logging status change:', error);
      return false;
    }
  }

  async getStatusHistory(issueId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.STATUS_LOG,
        FilterExpression: 'issue_id = :issueId',
        ExpressionAttributeValues: {
          ':issueId': { S: issueId }
        }
      });
      
      const result = await this.client.send(command);
      const history = (result.Items || []).map(item => ({
        id: item.id?.S || '',
        issue_id: item.issue_id?.S || '',
        from_status: item.from_status?.S || '',
        to_status: item.to_status?.S || '',
        changed_by: item.changed_by?.S || '',
        changed_at: item.changed_at?.S || ''
      }));
      
      return history.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
    } catch (error) {
      console.error('Error fetching status history:', error);
      return [];
    }
  }

  async createStatusLogTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.STATUS_LOG,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      // Wait for table to be active
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('StatusLog table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating StatusLog table:', error);
      return false;
    }
  }

  async followIssue(issueId, userEmail) {
    try {
      console.log('\n=== DB.followIssue CALLED ===');
      console.log('🔍 Following issue:', issueId, 'for user:', userEmail);
      
      const getCommand = new GetItemCommand({
        TableName: TABLES.FOLLOWERS,
        Key: {
          issue_id: { S: issueId },
          user_email: { S: userEmail }
        }
      });
      
      console.log('🔍 Checking existing follow record...');
      const existing = await this.client.send(getCommand);
      console.log('📊 Existing record found:', !!existing.Item);
      if (existing.Item) {
        console.log('📋 Existing record details:', JSON.stringify(existing.Item, null, 2));
      }
      
      // Check if user is creator or commenter (auto-following)
      const issue = await this.getIssueById(issueId);
      const comments = await this.getComments(issueId);
      const isCreator = issue && issue.email === userEmail;
      const hasCommented = comments.some(comment => comment.user_email === userEmail);
      const isAutoFollowing = isCreator || hasCommented;
      
      if (existing.Item) {
        const currentStatus = existing.Item.status?.S || 'following';
        
        if (currentStatus === 'unfollowed') {
          // User is unfollowed and wants to follow again
          const followCommand = new PutItemCommand({
            TableName: TABLES.FOLLOWERS,
            Item: {
              issue_id: { S: issueId },
              user_email: { S: userEmail },
              status: { S: 'following' },
              created_at: { S: new Date().toISOString() }
            }
          });
          await this.client.send(followCommand);
          
          // Send SSE notification for manual follow
          try {
            const { notifyClients } = await import('../app/api/events/route');
            notifyClients('all', {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: true,
              timestamp: Date.now()
            });
            notifyClients(issueId, {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: true,
              timestamp: Date.now()
            });
            console.log('SSE follow update notification sent');
          } catch (sseError) {
            console.error('SSE follow notification failed:', sseError);
          }
          
          return { following: true };
        } else {
          // Currently following - unfollow
          if (isAutoFollowing) {
            // Creator/commenter - set to unfollowed
            const unfollowCommand = new PutItemCommand({
              TableName: TABLES.FOLLOWERS,
              Item: {
                issue_id: { S: issueId },
                user_email: { S: userEmail },
                status: { S: 'unfollowed' },
                created_at: { S: new Date().toISOString() }
              }
            });
            await this.client.send(unfollowCommand);
          } else {
            // Regular user - delete record
            const deleteCommand = new DeleteItemCommand({
              TableName: TABLES.FOLLOWERS,
              Key: {
                issue_id: { S: issueId },
                user_email: { S: userEmail }
              }
            });
            await this.client.send(deleteCommand);
          }
          
          // Send SSE notification for manual unfollow
          try {
            const { notifyClients } = await import('../app/api/events/route');
            notifyClients('all', {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: false,
              timestamp: Date.now()
            });
            notifyClients(issueId, {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: false,
              timestamp: Date.now()
            });
            console.log('SSE follow update notification sent');
          } catch (sseError) {
            console.error('SSE follow notification failed:', sseError);
          }
          
          return { following: false };
        }
      } else {
        // Not explicitly following
        if (isAutoFollowing) {
          // They're auto-following but want to unfollow - create unfollowed record
          const unfollowCommand = new PutItemCommand({
            TableName: TABLES.FOLLOWERS,
            Item: {
              issue_id: { S: issueId },
              user_email: { S: userEmail },
              status: { S: 'unfollowed' },
              created_at: { S: new Date().toISOString() }
            }
          });
          await this.client.send(unfollowCommand);
          
          // Send SSE notification for auto-follow unfollow
          try {
            const { notifyClients } = await import('../app/api/events/route');
            notifyClients('all', {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: false,
              timestamp: Date.now()
            });
            notifyClients(issueId, {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: false,
              timestamp: Date.now()
            });
            console.log('SSE follow update notification sent');
          } catch (sseError) {
            console.error('SSE follow notification failed:', sseError);
          }
          
          return { following: false };
        } else {
          // Regular follow
          console.log('🔄 Creating new follow record...');
          const putCommand = new PutItemCommand({
            TableName: TABLES.FOLLOWERS,
            Item: {
              issue_id: { S: issueId },
              user_email: { S: userEmail },
              status: { S: 'following' },
              created_at: { S: new Date().toISOString() }
            }
          });
          console.log('📊 Creating follow record:', JSON.stringify(putCommand.input.Item, null, 2));
          await this.client.send(putCommand);
          console.log('✅ Follow record created successfully');
          
          // Send SSE notification for regular follow
          try {
            const { notifyClients } = await import('../app/api/events/route');
            notifyClients('all', {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: true,
              timestamp: Date.now()
            });
            notifyClients(issueId, {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: true,
              timestamp: Date.now()
            });
            console.log('SSE follow update notification sent');
          } catch (sseError) {
            console.error('SSE follow notification failed:', sseError);
          }
          
          return { following: true };
        }
      }
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return this.followIssue(issueId, userEmail);
      }
      console.error('Error following issue:', error);
      throw error;
    }
  }

  async isFollowingIssue(issueId, userEmail) {
    try {
      const command = new GetItemCommand({
        TableName: TABLES.FOLLOWERS,
        Key: {
          issue_id: { S: issueId },
          user_email: { S: userEmail }
        }
      });
      
      const result = await this.client.send(command);
      if (result.Item) {
        const status = result.Item.status?.S || 'following';
        return status === 'following';
      }
      return false;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return false;
      }
      console.error('Error checking follow status:', error);
      return false;
    }
  }

  async getIssueFollowers(issueId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.FOLLOWERS,
        FilterExpression: 'issue_id = :issueId AND (attribute_not_exists(#status) OR #status = :following)',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':issueId': { S: issueId },
          ':following': { S: 'following' }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        issue_id: item.issue_id?.S || '',
        user_email: item.user_email?.S || '',
        created_at: item.created_at?.S || '',
        status: item.status?.S || 'following'
      }));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return [];
      }
      console.error('Error getting followers:', error);
      return [];
    }
  }

  async getUserFollows(userEmail) {
    try {
      console.log('\n=== DB.getUserFollows CALLED ===');
      console.log('🔍 Querying PracticeTools-Followers for user:', userEmail);
      
      const command = new ScanCommand({
        TableName: TABLES.FOLLOWERS,
        FilterExpression: 'user_email = :userEmail AND (attribute_not_exists(#status) OR #status = :following)',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':userEmail': { S: userEmail },
          ':following': { S: 'following' }
        }
      });
      
      console.log('📊 DynamoDB command:', JSON.stringify(command.input, null, 2));
      
      const result = await this.client.send(command);
      console.log('📊 Raw DynamoDB result count:', result.Items?.length || 0);
      console.log('📋 Raw DynamoDB items:', JSON.stringify(result.Items, null, 2));
      
      const mappedResults = (result.Items || []).map(item => ({
        issue_id: item.issue_id?.S || '',
        user_email: item.user_email?.S || '',
        created_at: item.created_at?.S || '',
        status: item.status?.S || 'following'
      }));
      
      console.log('📊 Mapped results count:', mappedResults.length);
      console.log('📋 Mapped results:', JSON.stringify(mappedResults, null, 2));
      
      return mappedResults;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return [];
      }
      console.error('Error getting user follows:', error);
      return [];
    }
  }

  async createFollowersTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.FOLLOWERS,
        KeySchema: [
          {
            AttributeName: 'issue_id',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'user_email',
            KeyType: 'RANGE'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'issue_id',
            AttributeType: 'S'
          },
          {
            AttributeName: 'user_email',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      // Wait for table to be active
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('Followers table created successfully with status field support');
      return true;
    } catch (error) {
      console.error('Error creating Followers table:', error);
      return false;
    }
  }

  async ensureUserFollowing(issueId, userEmail) {
    try {
      // Check if follow record already exists
      const getCommand = new GetItemCommand({
        TableName: TABLES.FOLLOWERS,
        Key: {
          issue_id: { S: issueId },
          user_email: { S: userEmail }
        }
      });
      
      const existing = await this.client.send(getCommand);
      
      if (existing.Item) {
        // Record exists - check status
        const status = existing.Item.status?.S || 'following';
        if (status === 'following') {
          
          // Send SSE notification even if already following (for UI consistency)
          try {
            const { notifyClients } = await import('../app/api/events/route');
            
            const followData = {
              type: 'follow_updated',
              issueId: issueId,
              userEmail: userEmail,
              following: true,
              timestamp: Date.now()
            };
            
            notifyClients('all', followData);
            notifyClients(issueId, followData);
            
          } catch (sseError) {
            // Silent error handling
          }
          
          return true;
        }
        // If unfollowed, update to following
        const updateCommand = new PutItemCommand({
          TableName: TABLES.FOLLOWERS,
          Item: {
            issue_id: { S: issueId },
            user_email: { S: userEmail },
            status: { S: 'following' },
            created_at: { S: new Date().toISOString() }
          }
        });
        await this.client.send(updateCommand);
        // Send SSE notification for follow status change
        try {
          const { notifyClients } = await import('../app/api/events/route');
          notifyClients('all', {
            type: 'follow_updated',
            issueId: issueId,
            userEmail: userEmail,
            following: true,
            timestamp: Date.now()
          });
          notifyClients(issueId, {
            type: 'follow_updated',
            issueId: issueId,
            userEmail: userEmail,
            following: true,
            timestamp: Date.now()
          });
        } catch (sseError) {
          // Silent error handling
        }
        
        return true;
      } else {
        // No record exists - create following record
        const putCommand = new PutItemCommand({
          TableName: TABLES.FOLLOWERS,
          Item: {
            issue_id: { S: issueId },
            user_email: { S: userEmail },
            status: { S: 'following' },
            created_at: { S: new Date().toISOString() }
          }
        });
        await this.client.send(putCommand);
        // Send SSE notification for new follow
        try {
          const { notifyClients } = await import('../app/api/events/route');
          
          const followData = {
            type: 'follow_updated',
            issueId: issueId,
            userEmail: userEmail,
            following: true,
            timestamp: Date.now()
          };
          
          notifyClients('all', followData);
          notifyClients(issueId, followData);
          
        } catch (sseError) {
          // Silent error handling
        }
        
        return true;
      }
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return this.ensureUserFollowing(issueId, userEmail);
      }
      console.error('Error ensuring user following:', error);
      return false;
    }
  }

  async isUserFollowingIssue(issueId, userEmail) {
    try {
      console.log(`\n=== CHECKING FOLLOW STATUS (DATABASE ONLY) ===`);
      console.log(`Issue ID: ${issueId}`);
      console.log(`User Email: ${userEmail}`);
      
      // Only check database records - no auto-follow logic
      const command = new GetItemCommand({
        TableName: TABLES.FOLLOWERS,
        Key: {
          issue_id: { S: issueId },
          user_email: { S: userEmail }
        }
      });
      
      console.log('Checking database follow record...');
      const result = await this.client.send(command);
      console.log('DynamoDB result:', result.Item ? 'Record found' : 'No record');
      
      if (result.Item) {
        const status = result.Item.status?.S || 'following';
        console.log(`Database follow status: ${status}`);
        const isFollowing = status === 'following';
        console.log(`Returning: ${isFollowing}`);
        return isFollowing;
      }
      
      console.log('No database record found - returning false');
      return false;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return false;
      }
      console.error('Error checking user follow status:', error);
      return false;
    }
  }

  async getReleases(environment) {
    console.log('[DB-RELEASES] getReleases called with environment:', environment);
    console.log('[DB-RELEASES] Table name will be:', TABLES.RELEASES);
    console.log('[DB-RELEASES] Current ENV variable:', ENV);
    
    try {
      const command = new ScanCommand({
        TableName: TABLES.RELEASES
      });
      
      console.log('[DB-RELEASES] Executing DynamoDB scan command...');
      const result = await this.client.send(command);
      console.log('[DB-RELEASES] DynamoDB scan result - Item count:', result.Items?.length || 0);
      
      if (result.Items && result.Items.length > 0) {
        console.log('[DB-RELEASES] Sample raw items:', result.Items.slice(0, 2).map(item => ({
          version: item.version?.S,
          date: item.date?.S,
          type: item.type?.S
        })));
      }
      
      const mappedItems = (result.Items || []).map(item => ({
        version: item.version?.S || '',
        corrected_version: item.corrected_version?.S || null,
        date: item.date?.S || '',
        timestamp: item.timestamp?.S || null,
        type: item.type?.S || 'Minor Release',
        features: JSON.parse(item.features?.S || '[]'),
        improvements: JSON.parse(item.improvements?.S || '[]'),
        bugFixes: JSON.parse(item.bugFixes?.S || '[]'),
        breaking: JSON.parse(item.breaking?.S || '[]'),
        notes: item.notes?.S || '',
        helpContent: item.helpContent?.S || '',
        reversion_reason: item.reversion_reason?.S || null
      }));
      
      console.log('[DB-RELEASES] Mapped items count:', mappedItems.length);
      if (mappedItems.length > 0) {
        console.log('[DB-RELEASES] Sample mapped items:', mappedItems.slice(0, 2).map(item => ({
          version: item.version,
          date: item.date,
          type: item.type,
          notes: item.notes ? item.notes.substring(0, 50) + '...' : 'No notes'
        })));
      }
      
      return mappedItems;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('[DB-RELEASES] Releases table not found, returning empty array');
        return [];
      }
      console.error('[DB-RELEASES] Error getting releases:', error);
      console.error('[DB-RELEASES] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  async saveRelease(release) {
    console.log(`=== SAVING RELEASE ${release.version} ===`);
    console.log('Release data:', JSON.stringify(release, null, 2));
    
    const command = new PutItemCommand({
      TableName: TABLES.RELEASES,
      Item: {
        version: { S: release.version },
        date: { S: release.date },
        timestamp: release.timestamp ? { S: release.timestamp } : undefined,
        type: { S: release.type },
        features: { S: JSON.stringify(release.features || []) },
        improvements: { S: JSON.stringify(release.improvements || []) },
        bugFixes: { S: JSON.stringify(release.bugFixes || []) },
        breaking: { S: JSON.stringify(release.breaking || []) },
        notes: { S: release.notes || '' },
        helpContent: { S: release.helpContent || '' },
        created_at: { S: new Date().toISOString() }
      }
    });
    
    // Remove undefined values
    Object.keys(command.input.Item).forEach(key => {
      if (command.input.Item[key] === undefined) {
        delete command.input.Item[key];
      }
    });
    
    console.log('DynamoDB command prepared:', JSON.stringify(command.input, null, 2));
    
    try {
      console.log('Attempting to save to PracticeTools-Releases table...');
      await this.client.send(command);
      console.log(`✅ Release ${release.version} saved successfully to database`);
      
      // Verify the save by reading it back immediately
      try {
        console.log('Verifying save by reading back...');
        const verifyReleases = await this.getReleases();
        console.log(`Verification: Found ${verifyReleases.length} releases after save`);
        const savedRelease = verifyReleases.find(r => r.version === release.version);
        if (savedRelease) {
          console.log(`✅ Verification successful: Release ${release.version} found in database`);
        } else {
          console.log(`❌ Verification failed: Release ${release.version} NOT found in database`);
        }
      } catch (verifyError) {
        console.error('Verification read failed:', verifyError);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error saving release ${release.version}:`, error);
      
      if (error.name === 'ResourceNotFoundException') {
        console.log('🔧 Releases table not found, creating...');
        const tableCreated = await this.createReleasesTable();
        
        if (tableCreated) {
          console.log('🔧 Table created, retrying save...');
          try {
            await this.client.send(command);
            console.log(`✅ Release ${release.version} saved after table creation`);
            return true;
          } catch (retryError) {
            console.error(`❌ Error saving release after table creation:`, retryError);
            return false;
          }
        } else {
          console.error('❌ Failed to create releases table');
          return false;
        }
      }
      
      return false;
    }
  }

  async createReleasesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.RELEASES,
        KeySchema: [
          {
            AttributeName: 'version',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'version',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      // Wait longer for table to be active
      console.log('Waiting for releases table to become active...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      console.log('Releases table should now be active');
      return true;
    } catch (error) {
      console.error('Error creating Releases table:', error);
      return false;
    }
  }

  // Feature tracking methods
  async getAllFeatures() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.FEATURES
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        id: item.id?.S || '',
        name: item.name?.S || '',
        description: item.description?.S || '',
        category: item.category?.S || '',
        version: item.version?.S || '',
        changeType: item.changeType?.S || '',
        dateAdded: item.dateAdded?.S || '',
        dateModified: item.dateModified?.S || '',
        dateRemoved: item.dateRemoved?.S || '',
        status: item.status?.S || 'active'
      }));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFeaturesTable();
        return [];
      }
      console.error('Error getting features:', error);
      return [];
    }
  }

  async saveFeature(feature) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.FEATURES,
        Item: {
          id: { S: feature.id },
          name: { S: feature.name },
          description: { S: feature.description },
          category: { S: feature.category },
          version: { S: feature.version },
          changeType: { S: feature.changeType },
          dateAdded: { S: feature.dateAdded },
          status: { S: feature.status }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFeaturesTable();
        return this.saveFeature(feature);
      }
      console.error('Error saving feature:', error);
      return false;
    }
  }

  async updateFeature(featureId, updates) {
    try {
      const updateExpressions = [];
      const attributeValues = {};
      
      if (updates.description) {
        updateExpressions.push('description = :description');
        attributeValues[':description'] = { S: updates.description };
      }
      
      if (updates.version) {
        updateExpressions.push('version = :version');
        attributeValues[':version'] = { S: updates.version };
      }
      
      if (updates.changeType) {
        updateExpressions.push('changeType = :changeType');
        attributeValues[':changeType'] = { S: updates.changeType };
      }
      
      if (updates.status) {
        updateExpressions.push('#status = :status');
        attributeValues[':status'] = { S: updates.status };
      }
      
      if (updates.dateModified) {
        updateExpressions.push('dateModified = :dateModified');
        attributeValues[':dateModified'] = { S: updates.dateModified };
      }
      
      if (updates.dateRemoved) {
        updateExpressions.push('dateRemoved = :dateRemoved');
        attributeValues[':dateRemoved'] = { S: updates.dateRemoved };
      }
      
      if (updateExpressions.length === 0) return true;
      
      const command = new UpdateItemCommand({
        TableName: TABLES.FEATURES,
        Key: { id: { S: featureId } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: updates.status ? { '#status': 'status' } : undefined,
        ExpressionAttributeValues: attributeValues
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error updating feature:', error);
      return false;
    }
  }

  async createFeaturesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.FEATURES,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('Features table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Features table:', error);
      return false;
    }
  }

  async getIssueTypes() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.SETTINGS,
        FilterExpression: 'begins_with(setting_key, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': { S: 'issue_type_' }
        }
      });
      
      const result = await this.client.send(command);
      const types = (result.Items || []).map(item => JSON.parse(item.setting_value?.S || '{}'));
      
      // Return default types if none found
      if (types.length === 0) {
        return [
          { name: 'Leadership Question', icon: '👔', active: true },
          { name: 'General Question', icon: '❓', active: true },
          { name: 'Feature Request', icon: '✨', active: true },
          { name: 'Practice Question', icon: '🏢', active: true },
          { name: 'Process Question', icon: '📋', active: true },
          { name: 'Technical Question', icon: '🔧', active: true },
          { name: 'Event Question', icon: '🎉', active: true }
        ];
      }
      
      return types.filter(type => type.active);
    } catch (error) {
      console.error('Error getting issue types:', error);
      // Return default types on error
      return [
        { name: 'Leadership Question', icon: '👔', active: true },
        { name: 'General Question', icon: '❓', active: true },
        { name: 'Feature Request', icon: '✨', active: true },
        { name: 'Practice Question', icon: '🏢', active: true },
        { name: 'Process Question', icon: '📋', active: true },
        { name: 'Technical Question', icon: '🔧', active: true },
        { name: 'Event Question', icon: '🎉', active: true }
      ];
    }
  }

  async saveIssueType(issueType) {
    try {
      const typeId = issueType.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const command = new PutItemCommand({
        TableName: TABLES.SETTINGS,
        Item: {
          setting_key: { S: `issue_type_${typeId}` },
          setting_value: { S: JSON.stringify(issueType) },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error saving issue type:', error);
      return false;
    }
  }

  // Practice Info Pages methods
  async getPracticeInfoPages() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.PRACTICE_INFO_PAGES
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        id: item.id?.S || '',
        title: item.title?.S || '',
        description: item.description?.S || '',
        content: item.content?.S || '',
        practices: JSON.parse(item.practices?.S || '[]'),
        menu_items: JSON.parse(item.menu_items?.S || '[]'),
        created_by: item.created_by?.S || '',
        created_at: item.created_at?.S || '',
        updated_at: item.updated_at?.S || ''
      }));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createPracticeInfoPagesTable();
        return [];
      }
      console.error('Error getting practice info pages:', error);
      return [];
    }
  }

  async createPracticeInfoPage(data) {
    try {
      const id = uuidv4();
      const timestamp = new Date().toISOString();
      
      const command = new PutItemCommand({
        TableName: TABLES.PRACTICE_INFO_PAGES,
        Item: {
          id: { S: id },
          title: { S: data.title },
          description: { S: data.description || '' },
          content: { S: data.content || '' },
          practices: { S: JSON.stringify(data.practices || []) },
          menu_items: { S: JSON.stringify(data.menu_items || []) },
          created_by: { S: data.created_by },
          created_at: { S: timestamp },
          updated_at: { S: timestamp }
        }
      });
      
      await this.client.send(command);
      return { id, ...data, created_at: timestamp, updated_at: timestamp };
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createPracticeInfoPagesTable();
        return this.createPracticeInfoPage(data);
      }
      console.error('Error creating practice info page:', error);
      return null;
    }
  }

  async updatePracticeInfoPage(id, data) {
    try {
      const updateExpressions = [];
      const attributeValues = {};
      
      if (data.title) {
        updateExpressions.push('title = :title');
        attributeValues[':title'] = { S: data.title };
      }
      
      if (data.description !== undefined) {
        updateExpressions.push('description = :description');
        attributeValues[':description'] = { S: data.description };
      }
      
      if (data.content !== undefined) {
        updateExpressions.push('content = :content');
        attributeValues[':content'] = { S: data.content };
      }
      
      if (data.practices) {
        updateExpressions.push('practices = :practices');
        attributeValues[':practices'] = { S: JSON.stringify(data.practices) };
      }
      
      if (data.menu_items) {
        updateExpressions.push('menu_items = :menu_items');
        attributeValues[':menu_items'] = { S: JSON.stringify(data.menu_items) };
      }
      
      updateExpressions.push('updated_at = :updated_at');
      attributeValues[':updated_at'] = { S: new Date().toISOString() };
      
      const command = new UpdateItemCommand({
        TableName: TABLES.PRACTICE_INFO_PAGES,
        Key: { id: { S: id } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: attributeValues
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error updating practice info page:', error);
      return false;
    }
  }

  async createPracticeInfoPagesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.PRACTICE_INFO_PAGES,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('Practice Info Pages table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Practice Info Pages table:', error);
      return false;
    }
  }

  // Assignment methods
  async addAssignment(practice, status, projectNumber, requestDate, eta, customerName, projectDescription, region, am, pm, resourceAssigned, dateAssigned, notes, documentationLink = '', pmEmail = '', attachments = [], notificationUsers = []) {
    const id = uuidv4();
    const assignmentNumber = await this.getNextAssignmentNumber();
    const timestamp = new Date().toISOString();
    
    const command = new PutItemCommand({
      TableName: TABLES.ASSIGNMENTS,
      Item: {
        id: { S: id },
        assignment_number: { N: assignmentNumber.toString() },
        practice: { S: practice },
        status: { S: status },
        projectNumber: { S: projectNumber },
        requestDate: { S: requestDate },
        eta: { S: eta || '' },
        customerName: { S: customerName },
        projectDescription: { S: projectDescription },
        region: { S: region },
        am: { S: am },
        pm: { S: pm },
        pm_email: { S: pmEmail },
        resourceAssigned: { S: resourceAssigned },
        dateAssigned: { S: dateAssigned },
        notes: { S: notes },
        documentationLink: { S: documentationLink },
        attachments: { S: JSON.stringify(attachments) },
        resource_assignment_notification_users: { S: JSON.stringify(notificationUsers) },
        created_at: { S: timestamp },
        updated_at: { S: timestamp }
      }
    });
    
    try {
      await this.client.send(command);
      
      // Send pending assignment notification email if status is Pending
      logger.info('Checking if status is Pending for email notification', { status, isPending: status === 'Pending' });
      if (status === 'Pending') {
        try {
          logger.info('Attempting to send pending assignment notification', { assignmentId: id, status });
          
          // Check if nodemailer is available
          try {
            await import('nodemailer');
            logger.info('Nodemailer dependency found');
          } catch (nodemailerError) {
            logger.error('Nodemailer dependency missing', { error: nodemailerError.message });
            return id; // Return the assignment ID even if email fails
          }
          
          const { emailService } = await import('./email-service.js');
          logger.info('Email service imported successfully');
          
          const assignment = await this.getAssignmentById(id);
          if (assignment) {
            logger.info('Retrieved assignment for email notification', { 
              assignmentId: id,
              pmEmail: assignment.pm_email,
              notificationUsers: assignment.resource_assignment_notification_users
            });
            await emailService.sendPendingAssignmentNotification(assignment);
          } else {
            logger.error('Could not retrieve assignment for email notification', { assignmentId: id });
          }
        } catch (emailError) {
          logger.error('Failed to send pending assignment notification', { 
            error: emailError.message,
            stack: emailError.stack,
            assignmentId: id 
          });
          // Don't fail assignment creation if email fails
        }
      }
      
      return id;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createAssignmentsTable();
        // Retry after creating table
        try {
          await this.client.send(command);
          
          // Send email notification after retry as well
          if (status === 'Pending') {
            try {
              const { emailService } = await import('./email-service.js');
              const assignment = await this.getAssignmentById(id);
              if (assignment) {
                await emailService.sendPendingAssignmentNotification(assignment);
              }
            } catch (emailError) {
              logger.error('Failed to send pending assignment notification after retry', { error: emailError.message });
            }
          }
          
          return id;
        } catch (retryError) {
          logger.error('DynamoDB addAssignment retry error', { error: retryError.message });
          return false;
        }
      }
      logger.error('DynamoDB addAssignment error', { error: error.message });
      return false;
    }
  }

  async getAssignmentById(id) {
    const command = new GetItemCommand({
      TableName: TABLES.ASSIGNMENTS,
      Key: { id: { S: id } }
    });
    
    try {
      const result = await this.client.send(command);
      return result.Item ? this.formatAssignmentItem(result.Item) : null;
    } catch (error) {
      logger.error('DynamoDB getAssignmentById error', { error: error.message });
      return null;
    }
  }

  async getAllAssignments() {
    const command = new ScanCommand({
      TableName: TABLES.ASSIGNMENTS
    });
    
    try {
      const result = await this.client.send(command);
      const assignments = (result.Items || []).map(item => this.formatAssignmentItem(item));
      
      return assignments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      logger.error('DynamoDB getAllAssignments error', { error: error.message });
      return [];
    }
  }

  async updateAssignment(id, updates) {
    try {
      // Get current assignment for status change tracking
      const currentAssignment = await this.getAssignmentById(id);
      
      const updateExpressions = [];
      const attributeValues = {};
      const attributeNames = {};
      
      Object.keys(updates).forEach((key) => {
        if (key !== 'id') {
          updateExpressions.push(`#${key} = :${key}`);
          attributeNames[`#${key}`] = key;
          attributeValues[`:${key}`] = { S: updates[key] };
        }
      });
      
      updateExpressions.push('#updated_at = :updated_at');
      attributeNames['#updated_at'] = 'updated_at';
      attributeValues[':updated_at'] = { S: new Date().toISOString() };
      
      const command = new UpdateItemCommand({
        TableName: TABLES.ASSIGNMENTS,
        Key: { id: { S: id } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues
      });
      
      await this.client.send(command);
      
      // Log status change and update ETA if status changed
      if (updates.status && currentAssignment && currentAssignment.status !== updates.status) {
        await this.logAssignmentStatusChange(id, currentAssignment.status, updates.status, updates.practice || currentAssignment.practice);
        
        // If changed from Pending to Unassigned, update practice assignment ETA and send notification
        if (currentAssignment.status === 'Pending' && updates.status === 'Unassigned') {
          await this.updatePracticeAssignmentETA(updates.practice || currentAssignment.practice);
          
          // Send practice assigned notification
          try {
            const { emailService } = await import('./email-service.js');
            const updatedAssignment = await this.getAssignmentById(id);
            if (updatedAssignment) {
              await emailService.sendPracticeAssignedNotification(updatedAssignment);
            }
          } catch (emailError) {
            logger.error('Failed to send practice assigned notification', { 
              error: emailError.message,
              assignmentId: id 
            });
          }
        }
        
        // If changed from Unassigned to Assigned, update resource assignment ETA
        if (currentAssignment.status === 'Unassigned' && updates.status === 'Assigned') {
          await this.updateResourceAssignmentETA(updates.practice || currentAssignment.practice);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('DynamoDB updateAssignment error', { error: error.message });
      return false;
    }
  }

  async deleteAssignment(id) {
    const command = new DeleteItemCommand({
      TableName: TABLES.ASSIGNMENTS,
      Key: { id: { S: id } }
    });
    
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('DynamoDB deleteAssignment error', { error: error.message });
      return false;
    }
  }

  formatAssignmentItem(item) {
    return {
      id: item.id?.S || '',
      assignment_number: parseInt(item.assignment_number?.N || '0'),
      practice: item.practice?.S || '',
      status: item.status?.S || '',
      projectNumber: item.projectNumber?.S || '',
      requestDate: item.requestDate?.S || '',
      eta: item.eta?.S || '',
      customerName: item.customerName?.S || '',
      projectDescription: item.projectDescription?.S || '',
      region: item.region?.S || '',
      am: item.am?.S || '',
      pm: item.pm?.S || '',
      pm_email: item.pm_email?.S || '',
      resourceAssigned: item.resourceAssigned?.S || '',
      dateAssigned: item.dateAssigned?.S || '',
      notes: item.notes?.S || '',
      documentationLink: item.documentationLink?.S || '',
      attachments: item.attachments?.S || '[]',
      resource_assignment_notification_users: item.resource_assignment_notification_users?.S || '[]',
      created_at: item.created_at?.S || '',
      updated_at: item.updated_at?.S || ''
    };
  }

  async createAssignmentsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.ASSIGNMENTS,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      console.log('Assignments table creation initiated, waiting for it to become active...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      console.log('Assignments table should now be active');
      return true;
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log('Assignments table already exists, waiting for it to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;
      }
      console.error('Error creating Assignments table:', error);
      return false;
    }
  }

  // Assignment Comments methods
  async addAssignmentComment(assignmentId, userEmail, userName, message, attachments = [], isAdmin = false) {
    try {
      const id = uuidv4();
      const timestamp = new Date().toISOString();
      
      const command = new PutItemCommand({
        TableName: TABLES.ASSIGNMENT_COMMENTS,
        Item: {
          id: { S: id },
          assignment_id: { S: assignmentId },
          user_email: { S: userEmail },
          user_name: { S: userName },
          message: { S: message },
          attachments: { S: JSON.stringify(attachments) },
          is_admin: { BOOL: isAdmin },
          created_at: { S: timestamp }
        }
      });
      
      await this.client.send(command);
      return id;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createAssignmentCommentsTable();
        return this.addAssignmentComment(assignmentId, userEmail, userName, message, attachments, isAdmin);
      }
      logger.error('DynamoDB addAssignmentComment error', { error: error.message });
      return false;
    }
  }

  async getAssignmentComments(assignmentId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.ASSIGNMENT_COMMENTS,
        FilterExpression: 'assignment_id = :assignmentId',
        ExpressionAttributeValues: {
          ':assignmentId': { S: assignmentId }
        }
      });
      
      const result = await this.client.send(command);
      const comments = (result.Items || []).map(item => ({
        id: item.id?.S || '',
        assignment_id: item.assignment_id?.S || '',
        user_email: item.user_email?.S || '',
        user_name: item.user_name?.S || '',
        message: item.message?.S || '',
        attachments: item.attachments?.S || '[]',
        is_admin: item.is_admin?.BOOL || false,
        created_at: item.created_at?.S || ''
      }));
      
      return comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createAssignmentCommentsTable();
        return [];
      }
      logger.error('DynamoDB getAssignmentComments error', { error: error.message });
      return [];
    }
  }

  async createAssignmentCommentsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.ASSIGNMENT_COMMENTS,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('Assignment Comments table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Assignment Comments table:', error);
      return false;
    }
  }

  // Resource Assignment Methods
  async saveResourceAssignment(assignment) {
    const id = assignment.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const command = new PutItemCommand({
      TableName: this.getTableName('resource_assignments'),
      Item: {
        id: { S: id },
        projectNumber: { S: assignment.projectNumber || '' },
        clientName: { S: assignment.clientName || '' },
        requestedBy: { S: assignment.requestedBy || '' },
        skillsRequired: { S: JSON.stringify(assignment.skillsRequired || []) },
        priority: { S: assignment.priority || 'Medium' },
        startDate: { S: assignment.startDate || '' },
        endDate: { S: assignment.endDate || '' },
        description: { S: assignment.description || '' },
        region: { S: assignment.region || '' },
        documentationLink: { S: assignment.documentationLink || '' },
        notes: { S: assignment.notes || '' },
        status: { S: assignment.status || 'Open' },
        source: { S: assignment.source || 'Manual' },
        emailId: { S: assignment.emailId || '' },
        created_at: { S: timestamp },
        updated_at: { S: timestamp }
      }
    });

    try {
      await this.client.send(command);
      return { id, ...assignment, created_at: timestamp, updated_at: timestamp };
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createResourceAssignmentsTable();
        await this.client.send(command);
        return { id, ...assignment, created_at: timestamp, updated_at: timestamp };
      }
      throw error;
    }
  }

  async createResourceAssignmentsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: this.getTableName('resource_assignments'),
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return true;
    } catch (error) {
      console.error('Error creating resource assignments table:', error);
      return false;
    }
  }

  async getResourceAssignments() {
    const params = {
      TableName: this.getTableName('resource_assignments')
    };

    const result = await this.client.send(new ScanCommand(params));
    return result.Items || [];
  }

  getTableName(tableName) {
    return `PracticeTools-${ENV}-${tableName}`;
  }

  // Email Processing Rules Methods
  async saveEmailRule(rule) {
    const id = rule.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const command = new PutItemCommand({
      TableName: TABLES.EMAIL_RULES,
      Item: {
        id: { S: id },
        name: { S: rule.name || 'Untitled Rule' },
        senderEmail: { S: rule.senderEmail || '' },
        subjectPattern: { S: rule.subjectPattern || '' },
        keywordMappings: { S: JSON.stringify(rule.keywordMappings || []) },
        enabled: { BOOL: rule.enabled !== false },
        created_at: { S: timestamp },
        updated_at: { S: timestamp }
      }
    });

    try {
      await this.client.send(command);
      return { id, ...rule, created_at: timestamp, updated_at: timestamp };
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createEmailRulesTable();
        await this.client.send(command);
        return { id, ...rule, created_at: timestamp, updated_at: timestamp };
      }
      throw error;
    }
  }

  async getEmailRules() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.EMAIL_RULES
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        id: item.id?.S || '',
        name: item.name?.S || 'Untitled Rule',
        senderEmail: item.senderEmail?.S || '',
        subjectPattern: item.subjectPattern?.S || '',
        keywordMappings: JSON.parse(item.keywordMappings?.S || '[]'),
        enabled: item.enabled?.BOOL !== false,
        created_at: item.created_at?.S || '',
        updated_at: item.updated_at?.S || ''
      }));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createEmailRulesTable();
        return [];
      }
      console.error('Error getting email rules:', error);
      return [];
    }
  }

  async updateEmailRule(id, updates) {
    try {
      const updateExpressions = [];
      const attributeValues = {};
      const attributeNames = {};
      
      if (updates.name) {
        updateExpressions.push('#name = :name');
        attributeNames['#name'] = 'name';
        attributeValues[':name'] = { S: updates.name };
      }
      
      if (updates.senderEmail !== undefined) {
        updateExpressions.push('senderEmail = :senderEmail');
        attributeValues[':senderEmail'] = { S: updates.senderEmail };
      }
      
      if (updates.subjectPattern !== undefined) {
        updateExpressions.push('subjectPattern = :subjectPattern');
        attributeValues[':subjectPattern'] = { S: updates.subjectPattern };
      }
      
      if (updates.keywordMappings) {
        updateExpressions.push('keywordMappings = :keywordMappings');
        attributeValues[':keywordMappings'] = { S: JSON.stringify(updates.keywordMappings) };
      }
      
      if (updates.hasOwnProperty('enabled')) {
        updateExpressions.push('enabled = :enabled');
        attributeValues[':enabled'] = { BOOL: updates.enabled };
      }
      
      updateExpressions.push('updated_at = :updated_at');
      attributeValues[':updated_at'] = { S: new Date().toISOString() };
      
      const command = new UpdateItemCommand({
        TableName: TABLES.EMAIL_RULES,
        Key: { id: { S: id } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: Object.keys(attributeNames).length > 0 ? attributeNames : undefined,
        ExpressionAttributeValues: attributeValues
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error updating email rule:', error);
      return false;
    }
  }

  async deleteEmailRule(id) {
    try {
      const command = new DeleteItemCommand({
        TableName: TABLES.EMAIL_RULES,
        Key: { id: { S: id } }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting email rule:', error);
      return false;
    }
  }

  async createEmailRulesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.EMAIL_RULES,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('Email Rules table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Email Rules table:', error);
      return false;
    }
  }

  // Assignment Status Logging Methods
  async logAssignmentStatusChange(assignmentId, fromStatus, toStatus, practice) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.ASSIGNMENT_STATUS_LOG,
        Item: {
          id: { S: uuidv4() },
          assignment_id: { S: assignmentId },
          from_status: { S: fromStatus },
          to_status: { S: toStatus },
          practice: { S: practice },
          changed_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createAssignmentStatusLogTable();
        return this.logAssignmentStatusChange(assignmentId, fromStatus, toStatus, practice);
      }
      logger.error('Error logging assignment status change:', error);
      return false;
    }
  }

  async updatePracticeAssignmentETA(practice) {
    try {
      // Get all assignments that went from Pending to Unassigned for this practice
      const statusChanges = await this.getStatusChanges('Pending', 'Unassigned', practice);
      
      if (statusChanges.length === 0) return;
      
      // Calculate average days
      const assignments = await this.getAllAssignments();
      const durations = [];
      
      for (const change of statusChanges) {
        const assignment = assignments.find(a => a.id === change.assignment_id);
        if (assignment) {
          const createdDate = new Date(assignment.created_at);
          const changedDate = new Date(change.changed_at);
          const hoursDiff = Math.ceil((changedDate - createdDate) / (1000 * 60 * 60));
          durations.push(hoursDiff);
        }
      }
      
      if (durations.length > 0) {
        const averageHours = Math.round(durations.reduce((sum, hours) => sum + hours, 0) / durations.length);
        await this.savePracticeAssignmentETA(practice, averageHours, durations.length);
      }
      
      return true;
    } catch (error) {
      logger.error('Error updating practice ETA:', error);
      return false;
    }
  }

  async getStatusChanges(fromStatus, toStatus, practice) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.ASSIGNMENT_STATUS_LOG,
        FilterExpression: 'from_status = :fromStatus AND to_status = :toStatus AND practice = :practice',
        ExpressionAttributeValues: {
          ':fromStatus': { S: fromStatus },
          ':toStatus': { S: toStatus },
          ':practice': { S: practice }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        assignment_id: item.assignment_id?.S || '',
        changed_at: item.changed_at?.S || ''
      }));
    } catch (error) {
      logger.error('Error getting status changes:', error);
      return [];
    }
  }

  async updateResourceAssignmentETA(practice) {
    try {
      // Get all assignments that went from Unassigned to Assigned for this practice
      const statusChanges = await this.getStatusChanges('Unassigned', 'Assigned', practice);
      
      if (statusChanges.length === 0) return;
      
      // Calculate average days between Unassigned and Assigned status changes
      const durations = [];
      
      for (const change of statusChanges) {
        // Find when this assignment became Unassigned
        const unassignedChange = await this.getStatusChange(change.assignment_id, 'Pending', 'Unassigned');
        if (unassignedChange) {
          const unassignedDate = new Date(unassignedChange.changed_at);
          const assignedDate = new Date(change.changed_at);
          const hoursDiff = Math.ceil((assignedDate - unassignedDate) / (1000 * 60 * 60));
          durations.push(hoursDiff);
        }
      }
      
      if (durations.length > 0) {
        const averageHours = Math.round(durations.reduce((sum, hours) => sum + hours, 0) / durations.length);
        await this.saveResourceAssignmentETA(practice, averageHours, durations.length);
      }
      
      return true;
    } catch (error) {
      logger.error('Error updating resource assignment ETA:', error);
      return false;
    }
  }

  async getStatusChange(assignmentId, fromStatus, toStatus) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.ASSIGNMENT_STATUS_LOG,
        FilterExpression: 'assignment_id = :assignmentId AND from_status = :fromStatus AND to_status = :toStatus',
        ExpressionAttributeValues: {
          ':assignmentId': { S: assignmentId },
          ':fromStatus': { S: fromStatus },
          ':toStatus': { S: toStatus }
        }
      });
      
      const result = await this.client.send(command);
      return result.Items && result.Items.length > 0 ? {
        assignment_id: result.Items[0].assignment_id?.S || '',
        changed_at: result.Items[0].changed_at?.S || ''
      } : null;
    } catch (error) {
      logger.error('Error getting status change:', error);
      return null;
    }
  }

  async savePracticeAssignmentETA(practice, averageHours, sampleSize) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.PRACTICE_ETAS,
        Item: {
          practice: { S: practice },
          practice_assignment_eta_hours: { N: averageHours.toString() },
          practice_assignment_sample_size: { N: sampleSize.toString() },
          last_updated: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createPracticeETAsTable();
        return this.savePracticeAssignmentETA(practice, averageHours, sampleSize);
      }
      logger.error('Error saving practice assignment ETA:', error);
      return false;
    }
  }

  async saveResourceAssignmentETA(practice, averageHours, sampleSize) {
    try {
      // Get existing record to preserve practice assignment ETA
      const existing = await this.getPracticeETA(practice);
      
      const item = {
        practice: { S: practice },
        resource_assignment_eta_hours: { N: averageHours.toString() },
        resource_assignment_sample_size: { N: sampleSize.toString() },
        last_updated: { S: new Date().toISOString() }
      };
      
      // Preserve existing practice assignment ETA if it exists
      if (existing && existing.practice_assignment_eta_hours) {
        item.practice_assignment_eta_hours = { N: existing.practice_assignment_eta_hours.toString() };
        item.practice_assignment_sample_size = { N: existing.practice_assignment_sample_size.toString() };
      }
      
      const command = new PutItemCommand({
        TableName: TABLES.PRACTICE_ETAS,
        Item: item
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createPracticeETAsTable();
        return this.saveResourceAssignmentETA(practice, averageHours, sampleSize);
      }
      logger.error('Error saving resource assignment ETA:', error);
      return false;
    }
  }

  async getPracticeETA(practice) {
    try {
      const command = new GetItemCommand({
        TableName: TABLES.PRACTICE_ETAS,
        Key: { practice: { S: practice } }
      });
      
      const result = await this.client.send(command);
      if (result.Item) {
        return {
          practice: result.Item.practice?.S || '',
          practice_assignment_eta_hours: parseInt(result.Item.practice_assignment_eta_hours?.N || '0'),
          practice_assignment_sample_size: parseInt(result.Item.practice_assignment_sample_size?.N || '0'),
          resource_assignment_eta_hours: parseInt(result.Item.resource_assignment_eta_hours?.N || '0'),
          resource_assignment_sample_size: parseInt(result.Item.resource_assignment_sample_size?.N || '0'),
          last_updated: result.Item.last_updated?.S || ''
        };
      }
      return null;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        // Table doesn't exist yet - this is normal for new installations
        return null;
      }
      logger.error('Error getting practice ETA:', error);
      return null;
    }
  }

  async createAssignmentStatusLogTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.ASSIGNMENT_STATUS_LOG,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return true;
    } catch (error) {
      logger.error('Error creating Assignment Status Log table:', error);
      return false;
    }
  }

  async createPracticeETAsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.PRACTICE_ETAS,
        KeySchema: [
          {
            AttributeName: 'practice',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'practice',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await this.client.send(command);
      await new Promise(resolve => setTimeout(resolve, 10000));
      return true;
    } catch (error) {
      logger.error('Error creating Practice ETAs table:', error);
      return false;
    }
  }

  async getAssignmentStatusHistory(assignmentId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.ASSIGNMENT_STATUS_LOG,
        FilterExpression: 'assignment_id = :assignmentId',
        ExpressionAttributeValues: {
          ':assignmentId': { S: assignmentId }
        }
      });
      
      const result = await this.client.send(command);
      const history = (result.Items || []).map(item => ({
        id: item.id?.S || '',
        assignment_id: item.assignment_id?.S || '',
        from_status: item.from_status?.S || '',
        to_status: item.to_status?.S || '',
        changed_by: item.changed_by?.S || '',
        changed_at: item.changed_at?.S || ''
      }));
      
      return history.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
    } catch (error) {
      logger.error('Error fetching assignment status history:', error);
      return [];
    }
  }

}

export const db = new DynamoDBService();