import { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { logger } from './safe-logger.js';



let client = null;
let clientId = null;

function getClient() {
  if (!client) {
    clientId = Math.random().toString(36).substring(7);
    
    // Use environment variables for credentials
    let credentials = undefined;
    if (typeof window === 'undefined') {
      // Server-side: try to use environment variables or default chain
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };
      }
      // If no explicit credentials, let AWS SDK use default credential chain
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

// Dynamic environment detection - ensures we get the correct environment at runtime
function getEnvironment() {
  const env = process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
  console.log(`[DYNAMODB] Environment detected: ${env} (from ENVIRONMENT=${process.env.ENVIRONMENT})`);
  return env;
}

// Dynamic table name generation - ensures correct environment is used
function getTableName(tableSuffix) {
  const env = getEnvironment();
  const tableName = `PracticeTools-${env}-${tableSuffix}`;
  console.log(`[DYNAMODB] Table name: ${tableName}`);
  return tableName;
}

// Legacy TABLES object for backward compatibility - now uses dynamic generation
const TABLES = {
  get ISSUES() { return getTableName('Issues'); },
  get USERS() { return getTableName('Users'); },
  get UPVOTES() { return getTableName('Upvotes'); },
  get COMMENTS() { return getTableName('Comments'); },
  get FOLLOWERS() { return getTableName('Followers'); },
  get SETTINGS() { return getTableName('Settings'); },
  get STATUS_LOG() { return getTableName('StatusLog'); },
  get RELEASES() { return getTableName('Releases'); },
  get FEATURES() { return getTableName('Features'); },
  get PRACTICE_INFO_PAGES() { return getTableName('PracticeInfoPages'); },
  get ASSIGNMENTS() { return getTableName('resource-assignments'); },
  get ASSIGNMENT_COMMENTS() { return getTableName('assignment-comments'); },
  get EMAIL_RULES() { return getTableName('EmailRules'); },
  get ASSIGNMENT_STATUS_LOG() { return getTableName('AssignmentStatusLog'); },
  get PRACTICE_ETAS() { return getTableName('PracticeETAs'); },
  get CONTACT_TYPES() { return getTableName('ContactTypes'); },
  get COMPANIES() { return getTableName('Companies'); },
  get CONTACTS() { return getTableName('Contacts'); },
  get FIELD_OPTIONS() { return getTableName('FieldOptions'); },
  get REGIONS() { return getTableName('Regions'); },
  get SA_TO_AM_MAPPINGS() { return getTableName('SAToAMMappings'); },
  get SETTINGS() { return getTableName('Settings'); },
  get SA_ASSIGNMENTS() { return getTableName('sa-assignments'); },
  get SA_ASSIGNMENT_COMMENTS() { return getTableName('sa-assignment-comments'); },
  get SA_ASSIGNMENT_STATUS_LOG() { return getTableName('SAAssignmentStatusLog'); },
  get TRAINING_CERTS() { return getTableName('TrainingCerts'); },
  get TRAINING_CERTS_SETTINGS() { return getTableName('TrainingCertsSettings'); }
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
      { name: 'Event Question', icon: '🎉', active: true, description: 'Questions about events and activities' },
      { name: 'Bug Report', icon: '🐛', active: true, description: 'Report bugs and system issues' }
    ];
    
    for (const type of newIssueTypes) {
      await dbInstance.saveIssueType(type);
    }
  } catch (error) {
    // Silent initialization - don't block startup
  }
})();

// Log table configuration for debugging - now dynamic
console.log(`🗄️ DynamoDB Environment detection: ${getEnvironment()}`);
console.log(`🗄️ Using dynamic table name generation`);
// Environment detection is now dynamic and will work correctly in all environments

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
          TableName: TABLES.FOLLOWERS,
          FilterExpression: 'issue_id = :issueId',
          ExpressionAttributeValues: {
            ':issueId': { S: id }
          }
        });
        
        const followsResult = await this.client.send(followsCommand);
        for (const follow of followsResult.Items || []) {
          const deleteFollowCommand = new DeleteItemCommand({
            TableName: TABLES.FOLLOWERS,
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

  async createOrUpdateUser(email, name, authMethod = 'saml', role = 'practice_member', password = null, createdFrom = 'manual', requirePasswordChange = false, isAdmin = false, practices = [], status = 'active', webexBotSource = null, region = null) {
    // Auto-create practice board when practice manager is assigned
    if (role === 'practice_manager' && practices && practices.length > 0) {
      try {
        const response = await fetch('/api/practice-boards/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practices, managerId: email })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Practice board creation result:', result);
        }
      } catch (error) {
        console.error('Error auto-creating practice board:', error);
        // Don't fail user creation if board creation fails
      }
    }
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
    
    // Add region for account managers
    if (region) {
      item.region = { S: region };
    }
    
    // Add WebEx bot source if provided
    if (webexBotSource) {
      item.webex_bot_source = { S: webexBotSource };
    }
    
    // Hash password if provided for local auth
    if (password && authMethod === 'local') {
      console.log('[USER-CREATION-DEBUG] Hashing password for local auth user');
      const hashedPassword = await bcrypt.hash(password, 10);
      item.password = { S: hashedPassword };
    } else if (password) {
      console.log('[USER-CREATION-DEBUG] WARNING: Password provided but auth method is not local:', authMethod);
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
    console.log('[DB-USER-DEBUG] getUser called for email:', email);
    console.log('[DB-USER-DEBUG] Table name:', TABLES.USERS);
    console.log('[DB-USER-DEBUG] Environment:', getEnvironment());
    
    const command = new GetItemCommand({
      TableName: TABLES.USERS,
      Key: { email: { S: email } }
    });
    
    console.log('[DB-USER-DEBUG] DynamoDB command:', JSON.stringify(command.input, null, 2));
    
    try {
      console.log('[DB-USER-DEBUG] Executing DynamoDB getItem...');
      const result = await this.client.send(command);
      console.log('[DB-USER-DEBUG] DynamoDB result:', result.Item ? 'User found' : 'User not found');
      
      if (result.Item) {
        console.log('[DB-USER-DEBUG] Raw user item:', JSON.stringify(result.Item, null, 2));
        const formattedUser = this.formatUserItem(result.Item);
        console.log('[DB-USER-DEBUG] Formatted user:', {
          email: formattedUser.email,
          name: formattedUser.name,
          auth_method: formattedUser.auth_method,
          hasPassword: !!formattedUser.password,
          role: formattedUser.role
        });
        return formattedUser;
      }
      
      console.log('[DB-USER-DEBUG] No user found for email:', email);
      return null;
    } catch (error) {
      console.error('[DB-USER-DEBUG] DynamoDB getUser error:', error);
      console.error('[DB-USER-DEBUG] Error name:', error.name);
      console.error('[DB-USER-DEBUG] Error message:', error.message);
      console.error('[DB-USER-DEBUG] Error stack:', error.stack);
      logger.error('DynamoDB getUser error', { error: error.message });
      return null;
    }
  }

  async getAllUsers() {
    const tableName = TABLES.USERS;
    console.log('[DB] getAllUsers - Using table name:', tableName);
    console.log('[DB] getAllUsers - Environment:', getEnvironment());
    
    const command = new ScanCommand({
      TableName: tableName
    });
    
    try {
      console.log('[DB] getAllUsers - Executing DynamoDB scan...');
      const result = await this.client.send(command);
      const users = (result.Items || []).map(item => this.formatUserItem(item));
      console.log('[DB] getAllUsers - Retrieved', users.length, 'users from table', tableName);
      if (users.length > 0) {
        console.log('[DB] getAllUsers - Sample users:', users.slice(0, 3).map(u => ({ name: u.name, email: u.email, role: u.role })));
      }
      return users;
    } catch (error) {
      console.error('[DB] getAllUsers - Error:', error.message);
      console.error('[DB] getAllUsers - Error name:', error.name);
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
    
    if (updates.hasOwnProperty('region')) {
      if (updates.region === null || updates.region === '') {
        updateExpressions.push('REMOVE #region');
        attributeNames['#region'] = 'region';
      } else {
        updateExpressions.push('#region = :region');
        attributeNames['#region'] = 'region';
        attributeValues[':region'] = { S: updates.region };
      }
    }
    
    if (updateExpressions.length === 0) {
      return true; // No updates needed
    }
    
    // Separate SET and REMOVE operations
    const setExpressions = updateExpressions.filter(expr => !expr.startsWith('REMOVE'));
    const removeExpressions = updateExpressions.filter(expr => expr.startsWith('REMOVE')).map(expr => expr.replace('REMOVE ', ''));
    
    let updateExpression = '';
    if (setExpressions.length > 0) {
      updateExpression += `SET ${setExpressions.join(', ')}`;
    }
    if (removeExpressions.length > 0) {
      if (updateExpression) updateExpression += ' ';
      updateExpression += `REMOVE ${removeExpressions.join(', ')}`;
    }
    
    const command = new UpdateItemCommand({
      TableName: TABLES.USERS,
      Key: { email: { S: email } },
      UpdateExpression: updateExpression,
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
    // Handle practices field - could be JSON string or already parsed
    let practices = [];
    try {
      const practicesValue = item.practices?.S || '[]';
      if (typeof practicesValue === 'string') {
        practices = JSON.parse(practicesValue);
      } else {
        practices = practicesValue;
      }
      // Ensure it's always an array
      if (!Array.isArray(practices)) {
        practices = [];
      }
    } catch (error) {
      console.warn('Error parsing practices for user:', item.email?.S, error);
      practices = [];
    }
    
    return {
      email: item.email?.S || '',
      name: item.name?.S || '',
      role: item.role?.S || 'practice_member',
      isAdmin: item.is_admin?.BOOL || false,
      practices: practices,
      status: item.status?.S || 'active',
      auth_method: item.auth_method?.S || 'saml',
      created_from: item.created_from?.S || 'manual',
      password: item.password?.S || null,
      require_password_change: item.require_password_change?.BOOL || false,
      created_at: item.created_at?.S || '',
      last_login: item.last_login?.S || '',
      webex_bot_source: item.webex_bot_source?.S || null,
      region: item.region?.S || null
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

  async saveSetting(key, value, environment = null) {
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

  async getSetting(key, environment = null) {
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

  async getAllSettings() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.SETTINGS
      });
      
      const result = await this.client.send(command);
      
      // Return array format for topic discovery
      return (result.Items || []).map(item => ({
        setting_key: item.setting_key?.S || '',
        setting_value: item.setting_value?.S || ''
      }));
    } catch (error) {
      console.error('Error getting all settings:', error);
      return [];
    }
  }

  async getAllSettingsAsObject() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.SETTINGS
      });
      
      const result = await this.client.send(command);
      const settings = {};
      
      (result.Items || []).forEach(item => {
        const key = item.setting_key?.S;
        const value = item.setting_value?.S;
        if (key && value) {
          settings[key] = value;
        }
      });
      
      return settings;
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
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

  async getNextSaAssignmentNumber() {
    try {
      // Get current counter
      const getCommand = new GetItemCommand({
        TableName: TABLES.SETTINGS,
        Key: { setting_key: { S: 'sa_assignment_counter' } }
      });
      
      const result = await this.client.send(getCommand);
      const currentNumber = parseInt(result.Item?.setting_value?.S || '0');
      const nextNumber = currentNumber + 1;
      
      // Update counter
      const putCommand = new PutItemCommand({
        TableName: TABLES.SETTINGS,
        Item: {
          setting_key: { S: 'sa_assignment_counter' },
          setting_value: { S: nextNumber.toString() },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(putCommand);
      return nextNumber;
    } catch (error) {
      console.error('Error getting next SA assignment number:', error);
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
            const { notifyClients } = await import('../app/api/events/route.js');
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
            const { notifyClients } = await import('../app/api/events/route.js');
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
      console.log(`\n=== CHECKING FOLLOW STATUS (WITH AUTO-FOLLOW LOGIC) ===`);
      console.log(`Issue ID: ${issueId}`);
      console.log(`User Email: ${userEmail}`);
      
      // Check database record first
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
        console.log(`Returning database result: ${isFollowing}`);
        return isFollowing;
      }
      
      // No explicit database record - check auto-follow conditions
      console.log('No database record found - checking auto-follow conditions...');
      
      // Check if user is creator
      const issue = await this.getIssueById(issueId);
      if (issue && issue.email === userEmail) {
        console.log('User is issue creator - auto-following');
        return true;
      }
      
      // Check if user has commented
      const comments = await this.getComments(issueId);
      const hasCommented = comments.some(comment => comment.user_email === userEmail);
      if (hasCommented) {
        console.log('User has commented - auto-following');
        return true;
      }
      
      console.log('No auto-follow conditions met - returning false');
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
    console.log('[DB-RELEASES] Current environment detection:', getEnvironment());
    
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
  async checkResourceAssignmentDuplicate(projectNumber, customerName) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.ASSIGNMENTS,
        FilterExpression: 'projectNumber = :projectNumber AND customerName = :customerName',
        ExpressionAttributeValues: {
          ':projectNumber': { S: projectNumber },
          ':customerName': { S: customerName }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => this.formatAssignmentItem(item));
    } catch (error) {
      logger.error('Error checking resource assignment duplicates', { error: error.message });
      return [];
    }
  }

  async addAssignment(practice, status, projectNumber, requestDate, eta, customerName, projectDescription, region, am, pm, resourceAssigned, dateAssigned, notes, documentationLink = '', pmEmail = '', attachments = [], notificationUsers = []) {
    // DSR: Check for duplicate assignments before creating
    const duplicates = await this.checkResourceAssignmentDuplicate(projectNumber, customerName);
    if (duplicates.length > 0) {
      logger.warn('Duplicate resource assignment detected', {
        projectNumber,
        customerName,
        existingAssignments: duplicates.map(d => ({ id: d.id, assignment_number: d.assignment_number }))
      });
      throw new Error(`Duplicate assignment found: Project ${projectNumber} for ${customerName} already exists (Assignment #${duplicates[0].assignment_number})`);
    }

    const id = uuidv4();
    const assignmentNumber = await this.getNextAssignmentNumber();
    const timestamp = new Date().toISOString();
    
    // DSR: Process user fields to store both names and emails
    let processedFields = {};
    
    if (typeof window === 'undefined') {
      try {
        const { AssignmentEmailProcessor } = await import('./assignment-email-processor.js');
        processedFields = await AssignmentEmailProcessor.processUserFields(
          am, pm, resourceAssigned, notificationUsers
        );
      } catch (error) {
        logger.error('Error processing user fields in addAssignment', { error: error.message });
      }
    }
    
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
        am: { S: processedFields.am || am },
        am_email: { S: processedFields.am_email || '' },
        pm: { S: processedFields.pm || pm },
        pm_email: { S: processedFields.pm_email || pmEmail },
        resourceAssigned: { S: processedFields.resourceAssigned || resourceAssigned },
        resource_assigned_email: { S: processedFields.resource_assigned_email || '' },
        dateAssigned: { S: dateAssigned },
        notes: { S: notes },
        documentationLink: { S: documentationLink },
        attachments: { S: JSON.stringify(attachments) },
        resource_assignment_notification_users: { S: processedFields.resource_assignment_notification_users || JSON.stringify(notificationUsers) },
        created_at: { S: timestamp },
        updated_at: { S: timestamp }
      }
    });
    
    try {
      await this.client.send(command);
      
      // Send SSE notification for new assignment
      try {
        const { sendSSENotification } = await import('./sse-notifier.js');
        const newAssignment = await this.getAssignmentById(id);
        if (newAssignment) {
          await sendSSENotification('all', {
            type: 'assignment_created',
            assignmentId: id,
            assignment: newAssignment,
            timestamp: Date.now()
          });
        }
      } catch (sseError) {
        logger.error('Failed to send SSE notification for new assignment', { 
          error: sseError.message,
          assignmentId: id 
        });
      }
      
      // Send pending assignment notification email if status is Pending (server-side only)
      if (typeof window === 'undefined' && status === 'Pending') {
        try {
          const { emailService } = await import('./email-service.js');
          const assignment = await this.getAssignmentById(id);
          if (assignment) {
            await emailService.sendPendingAssignmentNotification(assignment);
          }
        } catch (emailError) {
          logger.error('Failed to send pending assignment notification', { 
            error: emailError.message,
            assignmentId: id 
          });
        }
      }
      
      return id;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createAssignmentsTable();
        // Retry after creating table
        try {
          await this.client.send(command);
          
          // Send email notification after retry (server-side only)
          if (typeof window === 'undefined' && status === 'Pending') {
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
      
      // DSR: Process user field updates to maintain email consistency
      if (typeof window === 'undefined') {
        try {
          const { AssignmentEmailProcessor } = await import('./assignment-email-processor.js');
          
          // Process any user field changes
          if (updates.am !== undefined || updates.pm !== undefined || 
              updates.resourceAssigned !== undefined || updates.resource_assignment_notification_users !== undefined) {
            
            const notificationUsers = updates.resource_assignment_notification_users ? 
              JSON.parse(updates.resource_assignment_notification_users) : [];
            
            const processedFields = await AssignmentEmailProcessor.processUserFields(
              updates.am, updates.pm, updates.resourceAssigned, notificationUsers
            );
            
            // Merge processed fields into updates
            Object.assign(updates, processedFields);
          }
        } catch (error) {
          logger.error('Error processing user fields in updateAssignment', { error: error.message });
        }
      }
      
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
          
          // Send practice assigned notification (server-side only)
          if (typeof window === 'undefined') {
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
        }
        
        // If changed to Assigned (from Pending or Unassigned), send resource assigned notification and create Webex space
        if (updates.status === 'Assigned' && currentAssignment.status !== 'Assigned') {
          await this.updateResourceAssignmentETA(updates.practice || currentAssignment.practice);
          
          // Send notifications and create Webex space (server-side only)
          if (typeof window === 'undefined') {
            try {
              const { emailService } = await import('./email-service.js');
              const { webexService } = await import('./webex-service.js');
              const updatedAssignment = await this.getAssignmentById(id);
              
              if (updatedAssignment) {
                // Send email notification
                await emailService.sendResourceAssignedNotification(updatedAssignment);
                
                // Create Webex space
                await webexService.createProjectSpace(updatedAssignment);
              }
            } catch (error) {
              logger.error('Failed to send resource assigned notification or create Webex space', { 
                error: error.message,
                assignmentId: id 
              });
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      logger.error('DynamoDB updateAssignment error', { error: error.message });
      return false;
    }
  }

  async deleteAssignment(id) {
    try {
      // Get assignment details before deletion for Webex cleanup
      const assignment = await this.getAssignmentById(id);
      
      const command = new DeleteItemCommand({
        TableName: TABLES.ASSIGNMENTS,
        Key: { id: { S: id } }
      });
      
      await this.client.send(command);
      
      // Clean up Webex space if it exists (server-side only)
      if (typeof window === 'undefined' && assignment && assignment.webex_space_id) {
        try {
          const { webexService } = await import('./webex-service.js');
          await webexService.removeAllUsersFromSpace(assignment);
        } catch (webexError) {
          logger.error('Failed to clean up Webex space during assignment deletion', {
            assignmentId: id,
            spaceId: assignment.webex_space_id,
            error: webexError.message
          });
        }
      }
      
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
      am_email: item.am_email?.S || '',
      pm: item.pm?.S || '',
      pm_email: item.pm_email?.S || '',
      resourceAssigned: item.resourceAssigned?.S || '',
      resource_assigned_email: item.resource_assigned_email?.S || '',
      dateAssigned: item.dateAssigned?.S || '',
      notes: item.notes?.S || '',
      documentationLink: item.documentationLink?.S || '',
      attachments: item.attachments?.S || '[]',
      resource_assignment_notification_users: item.resource_assignment_notification_users?.S || '[]',
      webex_space_id: item.webex_space_id?.S || '',
      unassignedAt: item.unassignedAt?.S || '',
      assignedAt: item.assignedAt?.S || '',
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
    return getTableName(tableName);
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
        friendlyName: { S: rule.friendlyName || 'Post-Sales Resource Assignment' },
        senderEmail: { S: rule.senderEmail || '' },
        subjectPattern: { S: rule.subjectPattern || '' },
        bodyPattern: { S: rule.bodyPattern || '' },
        keywordMappings: { S: JSON.stringify(rule.keywordMappings || []) },
        action: { S: rule.action || 'resource_assignment' },
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
        friendlyName: item.friendlyName?.S || 'Post-Sales Resource Assignment',
        senderEmail: item.senderEmail?.S || '',
        subjectPattern: item.subjectPattern?.S || '',
        bodyPattern: item.bodyPattern?.S || '',
        keywordMappings: JSON.parse(item.keywordMappings?.S || '[]'),
        action: item.action?.S || 'resource_assignment',
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
      
      if (updates.friendlyName) {
        updateExpressions.push('friendlyName = :friendlyName');
        attributeValues[':friendlyName'] = { S: updates.friendlyName };
      }
      
      if (updates.senderEmail !== undefined) {
        updateExpressions.push('senderEmail = :senderEmail');
        attributeValues[':senderEmail'] = { S: updates.senderEmail };
      }
      
      if (updates.subjectPattern !== undefined) {
        updateExpressions.push('subjectPattern = :subjectPattern');
        attributeValues[':subjectPattern'] = { S: updates.subjectPattern };
      }
      
      if (updates.bodyPattern !== undefined) {
        updateExpressions.push('bodyPattern = :bodyPattern');
        attributeValues[':bodyPattern'] = { S: updates.bodyPattern };
      }
      
      if (updates.keywordMappings) {
        updateExpressions.push('keywordMappings = :keywordMappings');
        attributeValues[':keywordMappings'] = { S: JSON.stringify(updates.keywordMappings) };
      }
      
      if (updates.hasOwnProperty('enabled')) {
        updateExpressions.push('enabled = :enabled');
        attributeValues[':enabled'] = { BOOL: updates.enabled };
      }
      
      if (updates.action) {
        updateExpressions.push('#action = :action');
        attributeNames['#action'] = 'action';
        attributeValues[':action'] = { S: updates.action };
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

  async getPracticeETAs(practiceList = []) {
    try {
      if (practiceList.length === 0) {
        // Get all ETAs
        const command = new ScanCommand({
          TableName: TABLES.PRACTICE_ETAS
        });
        
        const result = await this.client.send(command);
        return (result.Items || []).map(item => ({
          practice: item.practice?.S || '',
          statusTransition: 'pending_to_unassigned',
          avgDurationHours: parseInt(item.practice_assignment_eta_hours?.N || '0'),
          sampleSize: parseInt(item.practice_assignment_sample_size?.N || '0')
        })).concat((result.Items || []).map(item => ({
          practice: item.practice?.S || '',
          statusTransition: 'unassigned_to_assigned', 
          avgDurationHours: parseInt(item.resource_assignment_eta_hours?.N || '0'),
          sampleSize: parseInt(item.resource_assignment_sample_size?.N || '0')
        }))).filter(eta => eta.avgDurationHours > 0);
      } else {
        // Get ETAs for specific practices
        const etas = [];
        for (const practice of practiceList) {
          const eta = await this.getPracticeETA(practice);
          if (eta) {
            if (eta.practice_assignment_eta_hours > 0) {
              etas.push({
                practice: eta.practice,
                statusTransition: 'pending_to_unassigned',
                avgDurationHours: eta.practice_assignment_eta_hours,
                sampleSize: eta.practice_assignment_sample_size
              });
            }
            if (eta.resource_assignment_eta_hours > 0) {
              etas.push({
                practice: eta.practice,
                statusTransition: 'unassigned_to_assigned',
                avgDurationHours: eta.resource_assignment_eta_hours,
                sampleSize: eta.resource_assignment_sample_size
              });
            }
          }
        }
        return etas;
      }
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        return [];
      }
      logger.error('Error getting practice ETAs:', error);
      return [];
    }
  }

  async updatePracticeETA(practice, statusTransition, durationHours) {
    try {
      const existing = await this.getPracticeETA(practice);
      
      const item = {
        practice: { S: practice },
        last_updated: { S: new Date().toISOString() }
      };
      
      // Preserve existing values
      if (existing) {
        if (existing.practice_assignment_eta_hours) {
          item.practice_assignment_eta_hours = { N: existing.practice_assignment_eta_hours.toString() };
          item.practice_assignment_sample_size = { N: existing.practice_assignment_sample_size.toString() };
        }
        if (existing.resource_assignment_eta_hours) {
          item.resource_assignment_eta_hours = { N: existing.resource_assignment_eta_hours.toString() };
          item.resource_assignment_sample_size = { N: existing.resource_assignment_sample_size.toString() };
        }
      }
      
      // Update the specific transition
      if (statusTransition === 'pending_to_unassigned') {
        item.practice_assignment_eta_hours = { N: Math.round(durationHours).toString() };
        item.practice_assignment_sample_size = { N: '1' };
      } else if (statusTransition === 'unassigned_to_assigned') {
        item.resource_assignment_eta_hours = { N: Math.round(durationHours).toString() };
        item.resource_assignment_sample_size = { N: '1' };
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
        return this.updatePracticeETA(practice, statusTransition, durationHours);
      }
      logger.error('Error updating practice ETA:', error);
      return false;
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

  // Contact Types Methods
  async getContactTypes(practiceGroupId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.CONTACT_TYPES,
        FilterExpression: 'practice_group_id = :practiceGroupId',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => item.type_name?.S || '').sort();
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createContactTypesTable();
        return [];
      }
      logger.error('Error getting contact types:', error);
      return [];
    }
  }

  async saveContactType(practiceGroupId, typeName) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.CONTACT_TYPES,
        Item: {
          id: { S: uuidv4() },
          practice_group_id: { S: practiceGroupId },
          type_name: { S: typeName },
          created_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createContactTypesTable();
        return this.saveContactType(practiceGroupId, typeName);
      }
      logger.error('Error saving contact type:', error);
      return false;
    }
  }

  async createContactTypesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.CONTACT_TYPES,
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
      console.log('Contact Types table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Contact Types table:', error);
      return false;
    }
  }

  // Company Management Methods
  async getCompanies(practiceGroupId, contactType) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.COMPANIES,
        FilterExpression: 'practice_group_id = :practiceGroupId AND contact_type = :contactType AND (attribute_not_exists(is_deleted) OR is_deleted = :false)',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId },
          ':contactType': { S: contactType },
          ':false': { BOOL: false }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => {
        const history = JSON.parse(item.history?.S || '[]');
        const lastHistoryEntry = history.length > 0 ? history[history.length - 1] : null;
        
        return {
          id: item.id?.S || '',
          name: item.name?.S || '',
          msaSigned: item.msa_signed?.S || '',
          tier: item.tier?.S || '',
          technology: (() => {
            try {
              const tech = JSON.parse(item.technology?.S || '[]');
              return Array.isArray(tech) ? tech : (tech ? [tech] : []);
            } catch {
              return item.technology?.S ? [item.technology.S] : [];
            }
          })(),
          solutionType: (() => {
            try {
              const solution = JSON.parse(item.solution_type?.S || '[]');
              return Array.isArray(solution) ? solution : (solution ? [solution] : []);
            } catch {
              return item.solution_type?.S ? [item.solution_type.S] : [];
            }
          })(),
          website: item.website?.S || '',
          dateAdded: item.date_added?.S || '',
          addedBy: item.added_by?.S || '',
          lastEditedBy: item.last_edited_by?.S || '',
          lastEditedAt: item.last_edited_at?.S || '',
          practiceGroupId: item.practice_group_id?.S || '',
          contactType: item.contact_type?.S || '',
          history: history,
          created_by: history.find(entry => entry.action === 'created')?.user || 'Unknown',
          updated_by: lastHistoryEntry?.user || history.find(entry => entry.action === 'created')?.user || 'Unknown'
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createCompaniesTable();
        return [];
      }
      logger.error('Error getting companies:', error);
      return [];
    }
  }

  async saveCompany(company, userInfo = null) {
    try {
      const id = company.id || uuidv4();
      const timestamp = new Date().toISOString();
      
      // Create initial history entry
      const initialHistory = [];
      if (userInfo) {
        initialHistory.push({
          action: 'created',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: timestamp
        });
      }
      
      const command = new PutItemCommand({
        TableName: TABLES.COMPANIES,
        Item: {
          id: { S: id },
          name: { S: company.name },
          msa_signed: { S: company.msaSigned },
          tier: { S: company.tier },
          technology: { S: JSON.stringify(Array.isArray(company.technology) ? company.technology : [company.technology].filter(Boolean)) },
          solution_type: { S: JSON.stringify(Array.isArray(company.solutionType) ? company.solutionType : [company.solutionType].filter(Boolean)) },
          website: { S: company.website },
          practice_group_id: { S: company.practiceGroupId },
          contact_type: { S: company.contactType },
          date_added: { S: company.dateAdded || timestamp },
          added_by: { S: company.addedBy },
          history: { S: JSON.stringify(initialHistory) }
        }
      });
      
      await this.client.send(command);
      return { ...company, id };
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createCompaniesTable();
        return this.saveCompany(company, userInfo);
      }
      logger.error('Error saving company:', error);
      return false;
    }
  }

  async createCompaniesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.COMPANIES,
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
      console.log('Companies table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Companies table:', error);
      return false;
    }
  }

  // Contact Management Methods
  async getContacts(companyId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.CONTACTS,
        FilterExpression: 'company_id = :companyId AND (attribute_not_exists(is_deleted) OR is_deleted = :false)',
        ExpressionAttributeValues: {
          ':companyId': { S: companyId },
          ':false': { BOOL: false }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => {
        const history = JSON.parse(item.history?.S || '[]');
        const lastHistoryEntry = history.length > 0 ? history[history.length - 1] : null;
        
        return {
          id: item.id?.S || '',
          name: item.name?.S || '',
          email: item.email?.S || '',
          role: item.role?.S || '',
          cellPhone: item.cell_phone?.S || '',
          officePhone: item.office_phone?.S || '',
          fax: item.fax?.S || '',
          notes: item.notes?.S || '',
          companyId: item.company_id?.S || '',
          dateAdded: item.date_added?.S || '',
          addedBy: item.added_by?.S || '',
          lastEditedBy: item.last_edited_by?.S || '',
          lastEditedAt: item.last_edited_at?.S || '',
          history: history,
          created_by: history.find(entry => entry.action === 'created')?.user || 'Unknown',
          updated_by: lastHistoryEntry?.user || history.find(entry => entry.action === 'created')?.user || 'Unknown'
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createContactsTable();
        return [];
      }
      logger.error('Error getting contacts:', error);
      return [];
    }
  }

  async saveContact(contact, userInfo = null) {
    try {
      const id = contact.id || uuidv4();
      const timestamp = new Date().toISOString();
      
      // Create initial history entry
      const initialHistory = [];
      if (userInfo) {
        initialHistory.push({
          action: 'created',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: timestamp
        });
      }
      
      const command = new PutItemCommand({
        TableName: TABLES.CONTACTS,
        Item: {
          id: { S: id },
          name: { S: contact.name },
          email: { S: contact.email },
          role: { S: contact.role },
          cell_phone: { S: contact.cellPhone },
          office_phone: { S: contact.officePhone || '' },
          fax: { S: contact.fax || '' },
          notes: { S: contact.notes || '' },
          company_id: { S: contact.companyId },
          date_added: { S: contact.dateAdded || timestamp },
          added_by: { S: contact.addedBy },
          history: { S: JSON.stringify(initialHistory) }
        }
      });
      
      await this.client.send(command);
      return { ...contact, id };
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createContactsTable();
        return this.saveContact(contact, userInfo);
      }
      logger.error('Error saving contact:', error);
      return false;
    }
  }

  async createContactsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.CONTACTS,
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
      console.log('Contacts table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Contacts table:', error);
      return false;
    }
  }

  // Company update/delete methods
  async updateCompany(id, updates, userInfo = null) {
    try {
      // Get current company for change tracking
      const currentCompany = await this.getCompanyById(id);
      if (!currentCompany) return false;
      
      // Track changes for history
      const changes = [];
      const fieldMappings = {
        name: 'Company Name',
        msa_signed: 'MSA Signed',
        tier: 'Tier',
        technology: 'Technology',
        solution_type: 'Solution Type',
        website: 'Website'
      };
      
      // Convert arrays to JSON strings for storage
      const processedUpdates = { ...updates };
      if (updates.technology && Array.isArray(updates.technology)) {
        processedUpdates.technology = JSON.stringify(updates.technology);
      }
      if (updates.solutionType && Array.isArray(updates.solutionType)) {
        processedUpdates.solution_type = JSON.stringify(updates.solutionType);
        delete processedUpdates.solutionType;
      }
      
      Object.keys(updates).forEach((key) => {
        if (key !== 'id') {
          let currentValue = currentCompany[key];
          let newValue = updates[key];
          
          // Handle array comparisons
          if (key === 'technology' || key === 'solutionType') {
            const currentArray = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
            const newArray = Array.isArray(newValue) ? newValue : (newValue ? [newValue] : []);
            
            if (JSON.stringify(currentArray.sort()) !== JSON.stringify(newArray.sort())) {
              const fieldName = fieldMappings[key === 'solutionType' ? 'solution_type' : key] || key;
              changes.push({
                field: fieldName,
                from: currentArray.join(', ') || '(empty)',
                to: newArray.join(', ') || '(empty)'
              });
            }
          } else if (currentValue !== newValue) {
            const fieldName = fieldMappings[key] || key;
            changes.push({
              field: fieldName,
              from: currentValue || '',
              to: newValue || ''
            });
          }
        }
      });
      
      // Get existing history
      const existingHistory = JSON.parse(currentCompany.history || '[]');
      
      // Add history entry if there are changes
      let updatedHistory = existingHistory;
      if (changes.length > 0 && userInfo) {
        const historyEntry = {
          action: 'updated',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: new Date().toISOString(),
          changes: changes
        };
        updatedHistory = [...existingHistory, historyEntry];
      }
      
      const updateExpressions = [];
      const attributeValues = {};
      const attributeNames = {};
      
      Object.keys(processedUpdates).forEach((key) => {
        if (key !== 'id') {
          updateExpressions.push(`#${key} = :${key}`);
          attributeNames[`#${key}`] = key;
          attributeValues[`:${key}`] = { S: processedUpdates[key] };
        }
      });
      
      // Add history to update
      updateExpressions.push('#history = :history');
      attributeNames['#history'] = 'history';
      attributeValues[':history'] = { S: JSON.stringify(updatedHistory) };
      
      if (updateExpressions.length === 0) return true;
      
      const command = new UpdateItemCommand({
        TableName: TABLES.COMPANIES,
        Key: { id: { S: id } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error updating company:', error);
      return false;
    }
  }

  async getCompanyById(id, includeDeleted = false) {
    try {
      const command = new GetItemCommand({
        TableName: TABLES.COMPANIES,
        Key: { id: { S: id } }
      });
      
      const result = await this.client.send(command);
      if (result.Item) {
        const isDeleted = result.Item.is_deleted?.BOOL || false;
        if (!includeDeleted && isDeleted) return null;
        
        return {
          id: result.Item.id?.S || '',
          name: result.Item.name?.S || '',
          msa_signed: result.Item.msa_signed?.S || '',
          tier: result.Item.tier?.S || '',
          technology: result.Item.technology?.S || '[]',
          solution_type: result.Item.solution_type?.S || '[]',
          website: result.Item.website?.S || '',
          practice_group_id: result.Item.practice_group_id?.S || '',
          contact_type: result.Item.contact_type?.S || '',
          date_added: result.Item.date_added?.S || '',
          added_by: result.Item.added_by?.S || '',
          history: result.Item.history?.S || '[]',
          is_deleted: isDeleted
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting company by ID:', error);
      return null;
    }
  }

  async deleteCompany(id, userInfo = null) {
    try {
      // Get current company for soft delete (include deleted to allow access)
      const currentCompany = await this.getCompanyById(id, true);
      if (!currentCompany) return false;
      
      // Get existing history
      const existingHistory = JSON.parse(currentCompany.history || '[]');
      
      // Add deletion entry to history
      let updatedHistory = existingHistory;
      if (userInfo) {
        const historyEntry = {
          action: 'deleted',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: new Date().toISOString(),
          reason: 'Company deleted by user'
        };
        updatedHistory = [...existingHistory, historyEntry];
      }
      
      // Soft delete - mark as deleted but preserve record
      const command = new UpdateItemCommand({
        TableName: TABLES.COMPANIES,
        Key: { id: { S: id } },
        UpdateExpression: 'SET is_deleted = :deleted, history = :history, updated_at = :timestamp',
        ExpressionAttributeValues: {
          ':deleted': { BOOL: true },
          ':history': { S: JSON.stringify(updatedHistory) },
          ':timestamp': { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      
      // Also soft delete all contacts in this company
      const contacts = await this.getContacts(id);
      console.log(`Deleting company ${id}, found ${contacts.length} active contacts to soft delete`);
      for (const contact of contacts) {
        console.log(`Soft deleting contact ${contact.id} (${contact.name})`);
        await this.deleteContact(contact.id, userInfo, true); // Skip company deletion for contacts
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting company:', error);
      return false;
    }
  }

  // Contact update/delete methods
  async updateContact(id, updates, userInfo = null) {
    try {
      // Get current contact for change tracking
      const currentContact = await this.getContactById(id);
      if (!currentContact) return false;
      
      // Track changes for history
      const changes = [];
      const fieldMappings = {
        name: 'Contact Name',
        email: 'Email',
        role: 'Role',
        cell_phone: 'Cell Phone',
        office_phone: 'Office Phone',
        fax: 'Fax',
        notes: 'Notes'
      };
      
      Object.keys(updates).forEach((key) => {
        if (key !== 'id' && currentContact[key] !== updates[key]) {
          const fieldName = fieldMappings[key] || key;
          changes.push({
            field: fieldName,
            from: currentContact[key] || '',
            to: updates[key] || ''
          });
        }
      });
      
      // Get existing history
      const existingHistory = JSON.parse(currentContact.history || '[]');
      
      // Add history entry if there are changes
      let updatedHistory = existingHistory;
      if (changes.length > 0 && userInfo) {
        const historyEntry = {
          action: 'updated',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: new Date().toISOString(),
          changes: changes
        };
        updatedHistory = [...existingHistory, historyEntry];
      }
      
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
      
      // Add history to update
      updateExpressions.push('#history = :history');
      attributeNames['#history'] = 'history';
      attributeValues[':history'] = { S: JSON.stringify(updatedHistory) };
      
      if (updateExpressions.length === 0) return true;
      
      const command = new UpdateItemCommand({
        TableName: TABLES.CONTACTS,
        Key: { id: { S: id } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error updating contact:', error);
      return false;
    }
  }

  async getContactById(id, includeDeleted = false) {
    try {
      const command = new GetItemCommand({
        TableName: TABLES.CONTACTS,
        Key: { id: { S: id } }
      });
      
      const result = await this.client.send(command);
      if (result.Item) {
        const isDeleted = result.Item.is_deleted?.BOOL || false;
        if (!includeDeleted && isDeleted) return null;
        
        return {
          id: result.Item.id?.S || '',
          name: result.Item.name?.S || '',
          email: result.Item.email?.S || '',
          role: result.Item.role?.S || '',
          cell_phone: result.Item.cell_phone?.S || '',
          office_phone: result.Item.office_phone?.S || '',
          fax: result.Item.fax?.S || '',
          notes: result.Item.notes?.S || '',
          company_id: result.Item.company_id?.S || '',
          date_added: result.Item.date_added?.S || '',
          added_by: result.Item.added_by?.S || '',
          history: result.Item.history?.S || '[]',
          is_deleted: isDeleted
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting contact by ID:', error);
      return null;
    }
  }

  async deleteContact(id, userInfo = null, skipCompanyCheck = false) {
    try {
      // Get current contact for soft delete (include deleted to allow access)
      const currentContact = await this.getContactById(id, true);
      if (!currentContact) return false;
      
      // Get existing history
      const existingHistory = JSON.parse(currentContact.history || '[]');
      
      // Add deletion entry to history
      let updatedHistory = existingHistory;
      if (userInfo) {
        const historyEntry = {
          action: 'deleted',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: new Date().toISOString(),
          reason: skipCompanyCheck ? 'Contact deleted with company' : 'Contact deleted by user'
        };
        updatedHistory = [...existingHistory, historyEntry];
      }
      
      // Soft delete - mark as deleted but preserve record
      const command = new UpdateItemCommand({
        TableName: TABLES.CONTACTS,
        Key: { id: { S: id } },
        UpdateExpression: 'SET is_deleted = :deleted, history = :history, updated_at = :timestamp',
        ExpressionAttributeValues: {
          ':deleted': { BOOL: true },
          ':history': { S: JSON.stringify(updatedHistory) },
          ':timestamp': { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      return false;
    }
  }

  // Change tracking methods
  async logCompanyChange(companyId, changedBy, changes) {
    try {
      const command = new PutItemCommand({
        TableName: getTableName('CompanyChangeLog'),
        Item: {
          id: { S: uuidv4() },
          company_id: { S: companyId },
          changed_by: { S: changedBy },
          changes: { S: JSON.stringify(changes) },
          changed_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createCompanyChangeLogTable();
        return this.logCompanyChange(companyId, changedBy, changes);
      }
      console.error('Error logging company change:', error);
      return false;
    }
  }

  async logContactChange(contactId, changedBy, changes) {
    try {
      const command = new PutItemCommand({
        TableName: getTableName('ContactChangeLog'),
        Item: {
          id: { S: uuidv4() },
          contact_id: { S: contactId },
          changed_by: { S: changedBy },
          changes: { S: JSON.stringify(changes) },
          changed_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createContactChangeLogTable();
        return this.logContactChange(contactId, changedBy, changes);
      }
      console.error('Error logging contact change:', error);
      return false;
    }
  }

  async getCompanyChangeHistory(companyId) {
    try {
      const command = new ScanCommand({
        TableName: getTableName('CompanyChangeLog'),
        FilterExpression: 'company_id = :companyId',
        ExpressionAttributeValues: {
          ':companyId': { S: companyId }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        id: item.id?.S || '',
        companyId: item.company_id?.S || '',
        changedBy: item.changed_by?.S || '',
        changes: JSON.parse(item.changes?.S || '{}'),
        changedAt: item.changed_at?.S || ''
      })).sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    } catch (error) {
      console.error('Error getting company change history:', error);
      return [];
    }
  }

  async getContactChangeHistory(contactId) {
    try {
      const command = new ScanCommand({
        TableName: getTableName('ContactChangeLog'),
        FilterExpression: 'contact_id = :contactId',
        ExpressionAttributeValues: {
          ':contactId': { S: contactId }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        id: item.id?.S || '',
        contactId: item.contact_id?.S || '',
        changedBy: item.changed_by?.S || '',
        changes: JSON.parse(item.changes?.S || '{}'),
        changedAt: item.changed_at?.S || ''
      })).sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    } catch (error) {
      console.error('Error getting contact change history:', error);
      return [];
    }
  }

  async createCompanyChangeLogTable() {
    try {
      const command = new CreateTableCommand({
        TableName: getTableName('CompanyChangeLog'),
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
      console.error('Error creating Company Change Log table:', error);
      return false;
    }
  }

  async createContactChangeLogTable() {
    try {
      const command = new CreateTableCommand({
        TableName: getTableName('ContactChangeLog'),
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
      console.error('Error creating Contact Change Log table:', error);
      return false;
    }
  }

  // Soft delete management methods
  async getDeletedCompanies(practiceGroupId, contactType) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.COMPANIES,
        FilterExpression: 'practice_group_id = :practiceGroupId AND contact_type = :contactType AND is_deleted = :true',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId },
          ':contactType': { S: contactType },
          ':true': { BOOL: true }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => {
        const history = JSON.parse(item.history?.S || '[]');
        const lastHistoryEntry = history.length > 0 ? history[history.length - 1] : null;
        
        return {
          id: item.id?.S || '',
          name: item.name?.S || '',
          msaSigned: item.msa_signed?.S || '',
          tier: item.tier?.S || '',
          technology: (() => {
            try {
              const tech = JSON.parse(item.technology?.S || '[]');
              return Array.isArray(tech) ? tech : (tech ? [tech] : []);
            } catch {
              return item.technology?.S ? [item.technology.S] : [];
            }
          })(),
          solutionType: (() => {
            try {
              const solution = JSON.parse(item.solution_type?.S || '[]');
              return Array.isArray(solution) ? solution : (solution ? [solution] : []);
            } catch {
              return item.solution_type?.S ? [item.solution_type.S] : [];
            }
          })(),
          website: item.website?.S || '',
          dateAdded: item.date_added?.S || '',
          addedBy: item.added_by?.S || '',
          practiceGroupId: item.practice_group_id?.S || '',
          contactType: item.contact_type?.S || '',
          history: history,
          deletedBy: lastHistoryEntry?.user || 'Unknown',
          deletedAt: lastHistoryEntry?.timestamp || ''
        };
      }).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    } catch (error) {
      console.error('Error getting deleted companies:', error);
      return [];
    }
  }

  async getDeletedContacts(companyId = null) {
    try {
      let command;
      if (companyId) {
        command = new ScanCommand({
          TableName: TABLES.CONTACTS,
          FilterExpression: 'company_id = :companyId AND is_deleted = :true',
          ExpressionAttributeValues: {
            ':companyId': { S: companyId },
            ':true': { BOOL: true }
          }
        });
      } else {
        command = new ScanCommand({
          TableName: TABLES.CONTACTS,
          FilterExpression: 'is_deleted = :true',
          ExpressionAttributeValues: {
            ':true': { BOOL: true }
          }
        });
      }
      
      const result = await this.client.send(command);
      const contacts = (result.Items || []).map(item => {
        const history = JSON.parse(item.history?.S || '[]');
        const lastHistoryEntry = history.length > 0 ? history[history.length - 1] : null;
        
        return {
          id: item.id?.S || '',
          name: item.name?.S || '',
          email: item.email?.S || '',
          role: item.role?.S || '',
          cellPhone: item.cell_phone?.S || '',
          officePhone: item.office_phone?.S || '',
          fax: item.fax?.S || '',
          companyId: item.company_id?.S || '',
          dateAdded: item.date_added?.S || '',
          addedBy: item.added_by?.S || '',
          history: history,
          deletedBy: lastHistoryEntry?.user || 'Unknown',
          deletedAt: lastHistoryEntry?.timestamp || ''
        };
      }).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
      
      console.log(`Found ${contacts.length} deleted contacts for company ${companyId}`);
      return contacts;
    } catch (error) {
      console.error('Error getting deleted contacts:', error);
      return [];
    }
  }

  async restoreCompany(id, userInfo = null, newContactType = null) {
    try {
      // Get current company (include deleted to allow restoration)
      const currentCompany = await this.getCompanyById(id, true);
      if (!currentCompany) return false;
      
      // Get deleted contacts for this company
      const deletedContacts = await this.getDeletedContacts(id);
      console.log(`Restoring company ${id}, found ${deletedContacts.length} deleted contacts to restore`);
      
      // Get existing history
      const existingHistory = JSON.parse(currentCompany.history || '[]');
      
      // Add restoration entry to history
      let updatedHistory = existingHistory;
      if (userInfo) {
        const historyEntry = {
          action: 'restored',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: new Date().toISOString(),
          ...(newContactType && { note: `Restored to contact type: ${newContactType}` }),
          ...(deletedContacts.length > 0 && { contactsRestored: deletedContacts.length })
        };
        updatedHistory = [...existingHistory, historyEntry];
      }
      
      const timestamp = new Date().toISOString();
      
      // Restore company with optional contact type change and set restored status
      const updateExpression = newContactType 
        ? 'SET is_deleted = :deleted, history = :history, updated_at = :timestamp, contact_type = :contactType, last_edited_by = :lastEditedBy, last_edited_at = :lastEditedAt'
        : 'SET is_deleted = :deleted, history = :history, updated_at = :timestamp, last_edited_by = :lastEditedBy, last_edited_at = :lastEditedAt';
      
      const expressionAttributeValues = {
        ':deleted': { BOOL: false },
        ':history': { S: JSON.stringify(updatedHistory) },
        ':timestamp': { S: timestamp },
        ':lastEditedBy': { S: userInfo ? (userInfo.name || userInfo.email) : 'System' },
        ':lastEditedAt': { S: timestamp }
      };
      
      if (newContactType) {
        expressionAttributeValues[':contactType'] = { S: newContactType };
      }
      
      const command = new UpdateItemCommand({
        TableName: TABLES.COMPANIES,
        Key: { id: { S: id } },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
      });
      
      await this.client.send(command);
      
      // Restore all deleted contacts for this company
      console.log(`Restoring ${deletedContacts.length} contacts for company ${id}`);
      for (const contact of deletedContacts) {
        console.log(`Restoring contact ${contact.id} (${contact.name})`);
        const contactRestored = await this.restoreContact(contact.id, userInfo);
        console.log(`Contact ${contact.id} restoration result: ${contactRestored}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error restoring company:', error);
      return false;
    }
  }

  async restoreContact(id, userInfo = null) {
    try {
      // Get current contact (include deleted to allow restoration)
      const currentContact = await this.getContactById(id, true);
      if (!currentContact) return false;
      
      // Get existing history
      const existingHistory = JSON.parse(currentContact.history || '[]');
      
      // Add restoration entry to history
      let updatedHistory = existingHistory;
      if (userInfo) {
        const historyEntry = {
          action: 'restored',
          user: userInfo.name || userInfo.email,
          userEmail: userInfo.email,
          timestamp: new Date().toISOString()
        };
        updatedHistory = [...existingHistory, historyEntry];
      }
      
      const timestamp = new Date().toISOString();
      
      // Restore contact and set restored status
      const command = new UpdateItemCommand({
        TableName: TABLES.CONTACTS,
        Key: { id: { S: id } },
        UpdateExpression: 'SET is_deleted = :deleted, history = :history, updated_at = :timestamp, last_edited_by = :lastEditedBy, last_edited_at = :lastEditedAt',
        ExpressionAttributeValues: {
          ':deleted': { BOOL: false },
          ':history': { S: JSON.stringify(updatedHistory) },
          ':timestamp': { S: timestamp },
          ':lastEditedBy': { S: userInfo ? (userInfo.name || userInfo.email) : 'System' },
          ':lastEditedAt': { S: timestamp }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error restoring contact:', error);
      return false;
    }
  }

  async findSimilarDeletedCompanies(name, website, practiceGroupId, contactType) {
    try {
      const deletedCompanies = await this.getDeletedCompanies(practiceGroupId, contactType);
      const nameLower = name.toLowerCase();
      const websiteLower = website.toLowerCase();
      
      return deletedCompanies.filter(company => {
        const companyNameLower = company.name.toLowerCase();
        const companyWebsiteLower = company.website.toLowerCase();
        
        // Check for exact matches or similar names/websites
        return companyNameLower.includes(nameLower) || 
               nameLower.includes(companyNameLower) ||
               companyWebsiteLower.includes(websiteLower) ||
               websiteLower.includes(companyWebsiteLower);
      });
    } catch (error) {
      console.error('Error finding similar deleted companies:', error);
      return [];
    }
  }

  async findSimilarDeletedContacts(name, email) {
    try {
      const deletedContacts = await this.getDeletedContacts();
      const nameLower = name.toLowerCase();
      const emailLower = email.toLowerCase();
      
      return deletedContacts.filter(contact => {
        const contactNameLower = contact.name.toLowerCase();
        const contactEmailLower = contact.email.toLowerCase();
        
        // Check for exact matches or similar names/emails
        return contactNameLower.includes(nameLower) || 
               nameLower.includes(contactNameLower) ||
               contactEmailLower === emailLower;
      });
    } catch (error) {
      console.error('Error finding similar deleted contacts:', error);
      return [];
    }
  }

  async getDeletedContactsCount(companyId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.CONTACTS,
        FilterExpression: 'company_id = :companyId AND is_deleted = :true',
        ExpressionAttributeValues: {
          ':companyId': { S: companyId },
          ':true': { BOOL: true }
        },
        Select: 'COUNT'
      });
      
      const result = await this.client.send(command);
      return result.Count || 0;
    } catch (error) {
      console.error('Error getting deleted contacts count:', error);
      return 0;
    }
  }

  async getAllDeletedCompanies(practiceGroupId) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.COMPANIES,
        FilterExpression: 'practice_group_id = :practiceGroupId AND is_deleted = :true',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId },
          ':true': { BOOL: true }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => {
        const history = JSON.parse(item.history?.S || '[]');
        const lastHistoryEntry = history.length > 0 ? history[history.length - 1] : null;
        
        return {
          id: item.id?.S || '',
          name: item.name?.S || '',
          msaSigned: item.msa_signed?.S || '',
          tier: item.tier?.S || '',
          technology: (() => {
            try {
              const tech = JSON.parse(item.technology?.S || '[]');
              return Array.isArray(tech) ? tech : (tech ? [tech] : []);
            } catch {
              return item.technology?.S ? [item.technology.S] : [];
            }
          })(),
          solutionType: (() => {
            try {
              const solution = JSON.parse(item.solution_type?.S || '[]');
              return Array.isArray(solution) ? solution : (solution ? [solution] : []);
            } catch {
              return item.solution_type?.S ? [item.solution_type.S] : [];
            }
          })(),
          website: item.website?.S || '',
          dateAdded: item.date_added?.S || '',
          addedBy: item.added_by?.S || '',
          practiceGroupId: item.practice_group_id?.S || '',
          contactType: item.contact_type?.S || '',
          history: history,
          deletedBy: lastHistoryEntry?.user || 'Unknown',
          deletedAt: lastHistoryEntry?.timestamp || ''
        };
      }).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    } catch (error) {
      console.error('Error getting all deleted companies:', error);
      return [];
    }
  }

  async checkCompanyExists(practiceGroupId, contactType, name, website) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.COMPANIES,
        FilterExpression: 'practice_group_id = :practiceGroupId AND contact_type = :contactType AND #name = :name AND (attribute_not_exists(is_deleted) OR is_deleted = :false)',
        ExpressionAttributeNames: {
          '#name': 'name'
        },
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId },
          ':contactType': { S: contactType },
          ':name': { S: name },
          ':false': { BOOL: false }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).length > 0;
    } catch (error) {
      console.error('Error checking company exists:', error);
      return false;
    }
  }

  // Field Options Methods
  async getFieldOptions(practiceGroupId, fieldName) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.FIELD_OPTIONS,
        FilterExpression: 'practice_group_id = :practiceGroupId AND field_name = :fieldName',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId },
          ':fieldName': { S: fieldName }
        }
      });
      
      const result = await this.client.send(command);
      const options = (result.Items || []).map(item => item.option_value?.S || '').sort();
      
      // Return default message if no options found
      if (options.length === 0) {
        return ['Create your own options in Settings'];
      }
      
      return options;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFieldOptionsTable();
        return ['Create your own options in Settings'];
      }
      logger.error('Error getting field options:', error);
      return ['Create your own options in Settings'];
    }
  }

  async saveFieldOptions(practiceGroupId, fieldName, options) {
    try {
      // First, delete existing options for this field
      await this.deleteFieldOptions(practiceGroupId, fieldName);
      
      // Then save new options
      for (const option of options) {
        if (option.trim()) {
          const command = new PutItemCommand({
            TableName: TABLES.FIELD_OPTIONS,
            Item: {
              id: { S: uuidv4() },
              practice_group_id: { S: practiceGroupId },
              field_name: { S: fieldName },
              option_value: { S: option.trim() },
              created_at: { S: new Date().toISOString() }
            }
          });
          await this.client.send(command);
        }
      }
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFieldOptionsTable();
        return this.saveFieldOptions(practiceGroupId, fieldName, options);
      }
      logger.error('Error saving field options:', error);
      return false;
    }
  }

  async deleteFieldOptions(practiceGroupId, fieldName) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.FIELD_OPTIONS,
        FilterExpression: 'practice_group_id = :practiceGroupId AND field_name = :fieldName',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId },
          ':fieldName': { S: fieldName }
        }
      });
      
      const result = await this.client.send(command);
      
      for (const item of result.Items || []) {
        const deleteCommand = new DeleteItemCommand({
          TableName: TABLES.FIELD_OPTIONS,
          Key: { id: { S: item.id.S } }
        });
        await this.client.send(deleteCommand);
      }
      
      return true;
    } catch (error) {
      logger.error('Error deleting field options:', error);
      return false;
    }
  }

  async createFieldOptionsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.FIELD_OPTIONS,
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
      console.log('Field Options table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Field Options table:', error);
      return false;
    }
  }

  // User Roles Methods
  async getUserRoles() {
    try {
      const command = new ScanCommand({
        TableName: getTableName('UserRoles')
      });
      
      const result = await this.client.send(command);
      const roles = (result.Items || []).map(item => ({
        value: item.value?.S || '',
        label: item.label?.S || ''
      }));
      
      // Return default roles if none found (excluding admin - handled by checkbox)
      if (roles.length === 0) {
        return [
          { value: 'account_manager', label: 'Account Manager' },
          { value: 'executive', label: 'Executive' },
          { value: 'isr', label: 'ISR' },
          { value: 'netsync_employee', label: 'Netsync Employee' },
          { value: 'practice_manager', label: 'Practice Manager' },
          { value: 'practice_member', label: 'Practice Member' },
          { value: 'practice_principal', label: 'Practice Principal' }
        ];
      }
      
      // Filter out admin role from database results
      return roles.filter(role => role.value !== 'admin');
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createUserRolesTable();
        return [
          { value: 'account_manager', label: 'Account Manager' },
          { value: 'executive', label: 'Executive' },
          { value: 'isr', label: 'ISR' },
          { value: 'netsync_employee', label: 'Netsync Employee' },
          { value: 'practice_manager', label: 'Practice Manager' },
          { value: 'practice_member', label: 'Practice Member' },
          { value: 'practice_principal', label: 'Practice Principal' }
        ];
      }
      console.error('Error getting user roles:', error);
      return [
        { value: 'account_manager', label: 'Account Manager' },
        { value: 'executive', label: 'Executive' },
        { value: 'isr', label: 'ISR' },
        { value: 'netsync_employee', label: 'Netsync Employee' },
        { value: 'practice_manager', label: 'Practice Manager' },
        { value: 'practice_member', label: 'Practice Member' },
        { value: 'practice_principal', label: 'Practice Principal' }
      ];
    }
  }

  async createUserRole(role) {
    try {
      const command = new PutItemCommand({
        TableName: getTableName('UserRoles'),
        Item: {
          id: { S: role.id },
          value: { S: role.value },
          label: { S: role.label },
          created_at: { S: role.created_at },
          environment: { S: role.environment }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createUserRolesTable();
        return this.createUserRole(role);
      }
      console.error('Error creating user role:', error);
      return false;
    }
  }

  async createUserRolesTable() {
    try {
      const command = new CreateTableCommand({
        TableName: getTableName('UserRoles'),
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
      console.log('User Roles table created successfully');
      
      // Initialize default roles
      const defaultRoles = [
        { id: uuidv4(), value: 'account_manager', label: 'Account Manager', created_at: new Date().toISOString(), environment: getEnvironment() },
        { id: uuidv4(), value: 'admin', label: 'Admin', created_at: new Date().toISOString(), environment: getEnvironment() },
        { id: uuidv4(), value: 'executive', label: 'Executive', created_at: new Date().toISOString(), environment: getEnvironment() },
        { id: uuidv4(), value: 'isr', label: 'ISR', created_at: new Date().toISOString(), environment: getEnvironment() },
        { id: uuidv4(), value: 'netsync_employee', label: 'Netsync Employee', created_at: new Date().toISOString(), environment: getEnvironment() },
        { id: uuidv4(), value: 'practice_manager', label: 'Practice Manager', created_at: new Date().toISOString(), environment: getEnvironment() },
        { id: uuidv4(), value: 'practice_member', label: 'Practice Member', created_at: new Date().toISOString(), environment: getEnvironment() },
        { id: uuidv4(), value: 'practice_principal', label: 'Practice Principal', created_at: new Date().toISOString(), environment: getEnvironment() }
      ];
      
      for (const role of defaultRoles) {
        await this.createUserRole(role);
      }
      
      return true;
    } catch (error) {
      console.error('Error creating User Roles table:', error);
      return false;
    }
  }

  // Email Field Mappings Methods
  async getEmailFieldMappings() {
    try {
      const command = new ScanCommand({
        TableName: getTableName('EmailFieldMappings')
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        id: item.id?.S || '',
        value: item.value?.S || '',
        label: item.label?.S || '',
        created_at: item.created_at?.S || '',
        environment: item.environment?.S || ''
      }));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createEmailFieldMappingsTable();
        return [];
      }
      console.error('Error getting email field mappings:', error);
      return [];
    }
  }

  async createEmailFieldMapping(mapping) {
    try {
      const command = new PutItemCommand({
        TableName: getTableName('EmailFieldMappings'),
        Item: {
          id: { S: mapping.id },
          value: { S: mapping.value },
          label: { S: mapping.label },
          created_at: { S: mapping.created_at },
          environment: { S: mapping.environment }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createEmailFieldMappingsTable();
        return this.createEmailFieldMapping(mapping);
      }
      console.error('Error creating email field mapping:', error);
      return false;
    }
  }

  async createEmailFieldMappingsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: getTableName('EmailFieldMappings'),
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
      console.log('Email Field Mappings table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Email Field Mappings table:', error);
      return false;
    }
  }

  // Board Columns Methods
  async getBoardColumns(practiceId) {
    try {
      const columns = await this.getFieldOptions(practiceId, 'board_columns');
      if (columns.length === 0 || columns[0] === 'Create your own options in Settings') {
        return [
          { id: '1', title: 'To Do', order: 1 },
          { id: '2', title: 'In Progress', order: 2 },
          { id: '3', title: 'Done', order: 3 }
        ];
      }
      return columns.map((title, index) => ({
        id: (index + 1).toString(),
        title: title.trim(),
        order: index + 1
      }));
    } catch (error) {
      console.error('Error getting board columns:', error);
      return [
        { id: '1', title: 'To Do', order: 1 },
        { id: '2', title: 'In Progress', order: 2 },
        { id: '3', title: 'Done', order: 3 }
      ];
    }
  }

  // SA Assignment Status Methods
  async getSaAssignmentStatuses() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.SETTINGS,
        FilterExpression: 'begins_with(setting_key, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': { S: 'sa_status_' }
        }
      });
      
      const result = await this.client.send(command);
      const statuses = (result.Items || []).map(item => JSON.parse(item.setting_value?.S || '{}'));
      
      if (statuses.length === 0) {
        const defaultStatuses = [
          { value: 'Pending', order: 1 },
          { value: 'Unassigned', order: 2 },
          { value: 'Assigned', order: 3 },
          { value: 'Pending Approval', order: 4 },
          { value: 'Complete', order: 5 }
        ];
        
        for (const status of defaultStatuses) {
          await this.createSaAssignmentStatus(status);
        }
        
        return defaultStatuses.map(s => s.value);
      }
      
      return statuses.sort((a, b) => a.order - b.order).map(s => s.value);
    } catch (error) {
      console.error('Error getting SA assignment statuses:', error);
      return ['Pending', 'Unassigned', 'Assigned', 'Pending Approval', 'Complete'];
    }
  }

  async createSaAssignmentStatus(status) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.SETTINGS,
        Item: {
          setting_key: { S: `sa_status_${status.value.toLowerCase()}` },
          setting_value: { S: JSON.stringify(status) },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error creating SA assignment status:', error);
      return false;
    }
  }

  // Email Actions Methods
  async getEmailActions() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.SETTINGS,
        FilterExpression: 'begins_with(setting_key, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': { S: 'email_action_' }
        }
      });
      
      const result = await this.client.send(command);
      const actions = (result.Items || []).map(item => JSON.parse(item.setting_value?.S || '{}'));
      
      if (actions.length === 0) {
        // Create default actions
        await this.createEmailAction({
          id: 'resource_assignment',
          value: 'resource_assignment',
          name: 'Resource Assignment',
          description: 'Create a new resource assignment from email data',
          created_at: new Date().toISOString(),
          environment: getEnvironment()
        });
        
        await this.createEmailAction({
          id: 'sa_assignment',
          value: 'sa_assignment',
          name: 'SA Assignment',
          description: 'Create a new SA assignment from email data',
          created_at: new Date().toISOString(),
          environment: getEnvironment()
        });
        
        await this.createEmailAction({
          id: 'scoop_approvals',
          value: 'scoop_approvals',
          name: 'SCOOP Approvals',
          description: 'Update SA assignment status to Pending Approval',
          created_at: new Date().toISOString(),
          environment: getEnvironment()
        });
        
        await this.createEmailAction({
          id: 'sa_assignment_approved',
          value: 'sa_assignment_approved',
          name: 'SA Assignment Approved',
          description: 'Update SA assignment status from Pending Approval to Complete based on approver practices',
          created_at: new Date().toISOString(),
          environment: getEnvironment()
        });
        
        return [
          { value: 'resource_assignment', name: 'Resource Assignment' },
          { value: 'sa_assignment', name: 'SA Assignment' },
          { value: 'scoop_approvals', name: 'SCOOP Approvals' },
          { value: 'sa_assignment_approved', name: 'SA Assignment Approved' }
        ];
      }
      
      return actions.map(action => ({
        value: action.value,
        name: action.name
      }));
    } catch (error) {
      console.error('Error getting email actions:', error);
      return [
        { value: 'resource_assignment', name: 'Resource Assignment' },
        { value: 'sa_assignment', name: 'SA Assignment' },
        { value: 'scoop_approvals', name: 'SCOOP Approvals' },
        { value: 'sa_assignment_approved', name: 'SA Assignment Approved' }
      ];
    }
  }

  async createEmailAction(action) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.SETTINGS,
        Item: {
          setting_key: { S: `email_action_${action.id}` },
          setting_value: { S: JSON.stringify(action) },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error creating email action:', error);
      return false;
    }
  }

  async createEmailActionsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: getTableName('EmailActions'),
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
      console.log('Email Actions table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Email Actions table:', error);
      return false;
    }
  }

  // Regions Methods
  async getRegions() {
    try {
      const command = new ScanCommand({
        TableName: TABLES.REGIONS
      });
      
      const result = await this.client.send(command);
      const regions = (result.Items || []).map(item => ({
        id: item.id?.S || '',
        name: item.name?.S || '',
        created_at: item.created_at?.S || ''
      }));
      
      // Return default regions if none found
      if (regions.length === 0) {
        const defaultRegions = [
          { id: 'east', name: 'East' },
          { id: 'west', name: 'West' },
          { id: 'central', name: 'Central' },
          { id: 'international', name: 'International' }
        ];
        
        // Create default regions
        for (const region of defaultRegions) {
          await this.createRegion(region);
        }
        
        return defaultRegions;
      }
      
      return regions.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createRegionsTable();
        return this.getRegions();
      }
      console.error('Error getting regions:', error);
      return [
        { id: 'east', name: 'East' },
        { id: 'west', name: 'West' },
        { id: 'central', name: 'Central' },
        { id: 'international', name: 'International' }
      ];
    }
  }

  async createRegion(region) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.REGIONS,
        Item: {
          id: { S: region.id },
          name: { S: region.name },
          created_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createRegionsTable();
        return this.createRegion(region);
      }
      console.error('Error creating region:', error);
      return false;
    }
  }

  async createRegionsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.REGIONS,
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
      console.log('Regions table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Regions table:', error);
      return false;
    }
  }

  // SA Assignment methods
  async addSaAssignment(practice, status, opportunityId, requestDate, eta, customerName, opportunityName, region, am, saAssigned, dateAssigned, notes, attachments = [], notificationUsers = [], scoopUrl = '', isr = '', submittedBy = '', assumedUserFlags = {}) {
    const id = uuidv4();
    const saAssignmentNumber = await this.getNextSaAssignmentNumber();
    const timestamp = new Date().toISOString();
    
    // Auto-set status based on practice and SA assignment
    if (practice && practice.trim()) {
      // If practices are assigned, determine if SAs cover all practices
      if (saAssigned && saAssigned.trim()) {
        // Check if all practices are covered by assigned SAs (server-side only)
        if (typeof window === 'undefined') {
          try {
            const { validatePracticeCoverage } = await import('./sa-assignment-validator.js');
            const validation = await validatePracticeCoverage(practice, saAssigned);
            status = validation.valid ? 'Assigned' : 'Unassigned';
          } catch (error) {
            // Fallback to Unassigned if validation fails
            status = 'Unassigned';
          }
        } else {
          status = 'Unassigned';
        }
      } else {
        status = 'Unassigned';
      }
    } else {
      // If no practices assigned, status should be Pending
      status = 'Pending';
    }
    
    // DSR: Removed automatic AM/ISR user creation - users must exist in system
    let amEmail = '', isrEmail = '', submittedByEmail = '';
    let processedSaAssigned = saAssigned;
    let autoPopulatedRegion = region; // Start with provided region
    
    if (typeof window === 'undefined') {
      try {
        // Get emails from existing users only (no automatic creation)
        const users = await this.getAllUsers();
        
        // Extract AM email from existing users and auto-populate region
        if (am) {
          const amMatch = am.match(/<([^>]+)>/);
          if (amMatch) {
            amEmail = amMatch[1];
            // Find user by email to get region
            const amUser = users.find(user => user.email === amEmail);
            if (amUser && amUser.region && !autoPopulatedRegion) {
              autoPopulatedRegion = amUser.region;
              logger.info('DSR: Auto-populated region from AM email', {
                amEmail,
                region: autoPopulatedRegion
              });
            }
          } else {
            const amUser = users.find(user => user.name.toLowerCase() === am.toLowerCase());
            if (amUser) {
              amEmail = amUser.email;
              // DSR: Auto-populate region from account manager
              if (amUser.region && !autoPopulatedRegion) {
                autoPopulatedRegion = amUser.region;
                logger.info('DSR: Auto-populated region from AM name', {
                  amName: am,
                  amEmail,
                  region: autoPopulatedRegion
                });
              }
            }
          }
        }
        
        // Extract ISR email from existing users
        if (isr) {
          const isrMatch = isr.match(/<([^>]+)>/);
          if (isrMatch) {
            isrEmail = isrMatch[1];
          } else {
            const isrUser = users.find(user => user.name.toLowerCase() === isr.toLowerCase());
            if (isrUser) {
              isrEmail = isrUser.email;
            }
          }
        }
        
        // Get submitted by email from existing users
        if (submittedBy) {
          const submittedByUser = users.find(user => user.name.toLowerCase() === submittedBy.toLowerCase());
          if (submittedByUser) {
            submittedByEmail = submittedByUser.email;
          }
        }
        
        // Convert SA names to "Name <email>" format from existing users
        if (saAssigned && saAssigned.trim()) {
          const saNames = saAssigned.split(',').map(s => s.trim());
          const saWithEmails = saNames.map(name => {
            const user = users.find(u => u.name === name);
            return user ? `${user.name} <${user.email}>` : name;
          });
          processedSaAssigned = saWithEmails.join(', ');
          
          logger.info('DSR: Converted SA names to include emails from existing users only', {
            original: saAssigned,
            processed: processedSaAssigned
          });
        }
        
        logger.info('DSR: Processed user emails from existing users only (no creation)', {
          amEmail: amEmail || 'not found',
          isrEmail: isrEmail || 'not found',
          submittedByEmail: submittedByEmail || 'not found',
          assumedUserFlags
        });
      } catch (error) {
        logger.error('Error processing user emails in addSaAssignment', { error: error.message });
        // Continue with SA assignment creation even if user processing fails
      }
    }
    
    const command = new PutItemCommand({
      TableName: TABLES.SA_ASSIGNMENTS,
      Item: {
        id: { S: id },
        sa_assignment_number: { N: saAssignmentNumber.toString() },
        practice: { S: practice },
        status: { S: status },
        opportunityId: { S: opportunityId },
        requestDate: { S: requestDate },
        eta: { S: eta || '' },
        customerName: { S: customerName },
        opportunityName: { S: opportunityName },
        region: { S: autoPopulatedRegion },
        am: { S: am },
        am_email: { S: amEmail },
        am_assumed: { BOOL: assumedUserFlags.amIsAssumed || false },
        saAssigned: { S: processedSaAssigned },
        dateAssigned: { S: dateAssigned },
        notes: { S: notes },
        isr: { S: isr },
        isr_email: { S: isrEmail },
        isr_assumed: { BOOL: assumedUserFlags.isrIsAssumed || false },
        submittedBy: { S: submittedBy },
        submitted_by_email: { S: submittedByEmail },
        submitted_by_assumed: { BOOL: assumedUserFlags.submittedByIsAssumed || false },
        attachments: { S: JSON.stringify(attachments) },
        sa_assignment_notification_users: { S: JSON.stringify(notificationUsers) },
        scoopUrl: { S: scoopUrl },
        created_at: { S: timestamp },
        updated_at: { S: timestamp }
      }
    });
    
    try {
      await this.client.send(command);
      
      // Send SSE notification for new SA assignment
      try {
        const { sendSSENotification } = await import('./sse-notifier.js');
        const newSaAssignment = await this.getSaAssignmentById(id);
        if (newSaAssignment) {
          await sendSSENotification('all', {
            type: 'sa_assignment_created',
            saAssignmentId: id,
            saAssignment: newSaAssignment,
            timestamp: Date.now()
          });
        }
      } catch (sseError) {
        logger.error('Failed to send SSE notification for new SA assignment', { 
          error: sseError.message,
          saAssignmentId: id 
        });
      }
      
      return id;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createSaAssignmentsTable();
        try {
          await this.client.send(command);
          return id;
        } catch (retryError) {
          logger.error('DynamoDB addSaAssignment retry error', { error: retryError.message });
          return false;
        }
      }
      logger.error('DynamoDB addSaAssignment error', { error: error.message });
      return false;
    }
  }

  async getSaAssignmentById(id) {
    const command = new GetItemCommand({
      TableName: TABLES.SA_ASSIGNMENTS,
      Key: { id: { S: id } }
    });
    
    try {
      const result = await this.client.send(command);
      return result.Item ? this.formatSaAssignmentItem(result.Item) : null;
    } catch (error) {
      logger.error('DynamoDB getSaAssignmentById error', { error: error.message });
      return null;
    }
  }

  async getAllSaAssignments() {
    const command = new ScanCommand({
      TableName: TABLES.SA_ASSIGNMENTS
    });
    
    try {
      const result = await this.client.send(command);
      const saAssignments = (result.Items || []).map(item => this.formatSaAssignmentItem(item));
      
      return saAssignments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      logger.error('DynamoDB getAllSaAssignments error', { error: error.message });
      return [];
    }
  }

  async updateSaAssignment(id, updates) {
    try {
      const currentSaAssignment = await this.getSaAssignmentById(id);
      
      // Auto-set status based on practice assignment
      if (updates.practice !== undefined) {
        if (updates.practice && updates.practice.trim()) {
          // If practices are assigned, status should be Unassigned (not Pending)
          if (currentSaAssignment?.status === 'Pending') {
            updates.status = 'Unassigned';
          }
        } else {
          // If practices are removed, status should be Pending
          updates.status = 'Pending';
        }
      }
      
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
        TableName: TABLES.SA_ASSIGNMENTS,
        Key: { id: { S: id } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues
      });
      
      await this.client.send(command);
      
      // Log status change if status changed
      if (updates.status && currentSaAssignment && currentSaAssignment.status !== updates.status) {
        await this.logSaAssignmentStatusChange(id, currentSaAssignment.status, updates.status, updates.practice || currentSaAssignment.practice);
      }
      
      return true;
    } catch (error) {
      logger.error('DynamoDB updateSaAssignment error', { error: error.message });
      return false;
    }
  }

  // Alias for backward compatibility
  async updateSAAssignment(id, updates) {
    return this.updateSaAssignment(id, updates);
  }

  async deleteSaAssignment(id) {
    try {
      const command = new DeleteItemCommand({
        TableName: TABLES.SA_ASSIGNMENTS,
        Key: { id: { S: id } }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('DynamoDB deleteSaAssignment error', { error: error.message });
      return false;
    }
  }

  formatSaAssignmentItem(item) {
    return {
      id: item.id?.S || '',
      sa_assignment_number: parseInt(item.sa_assignment_number?.N || '0'),
      practice: item.practice?.S || '',
      status: item.status?.S || '',
      opportunityId: item.opportunityId?.S || '',
      requestDate: item.requestDate?.S || '',
      eta: item.eta?.S || '',
      customerName: item.customerName?.S || '',
      opportunityName: item.opportunityName?.S || '',
      region: item.region?.S || '',
      am: item.am?.S || '',
      am_email: item.am_email?.S || '',
      am_assumed: item.am_assumed?.BOOL || false,
      saAssigned: item.saAssigned?.S || '',
      practiceAssignments: item.practiceAssignments?.S || '{}',
      dateAssigned: item.dateAssigned?.S || '',
      notes: item.notes?.S || '',
      isr: item.isr?.S || '',
      isr_email: item.isr_email?.S || '',
      isr_assumed: item.isr_assumed?.BOOL || false,
      submittedBy: item.submittedBy?.S || '',
      submitted_by_email: item.submitted_by_email?.S || '',
      submitted_by_assumed: item.submitted_by_assumed?.BOOL || false,
      attachments: item.attachments?.S || '[]',
      sa_assignment_notification_users: item.sa_assignment_notification_users?.S || '[]',
      scoopUrl: item.scoopUrl?.S || '',
      webex_space_id: item.webex_space_id?.S || '',
      completedBy: item.completedBy?.S || '',
      completedAt: item.completedAt?.S || '',
      saCompletions: item.saCompletions?.S || '{}',
      unassignedAt: item.unassignedAt?.S || '',
      assignedAt: item.assignedAt?.S || '',
      created_at: item.created_at?.S || '',
      updated_at: item.updated_at?.S || ''
    };
  }

  async createSaAssignmentsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.SA_ASSIGNMENTS,
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
      console.log('SA Assignments table creation initiated, waiting for it to become active...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      console.log('SA Assignments table should now be active');
      return true;
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log('SA Assignments table already exists, waiting for it to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;
      }
      console.error('Error creating SA Assignments table:', error);
      return false;
    }
  }

  async logSaAssignmentStatusChange(saAssignmentId, fromStatus, toStatus, practice) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.SA_ASSIGNMENT_STATUS_LOG,
        Item: {
          id: { S: uuidv4() },
          sa_assignment_id: { S: saAssignmentId },
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
        await this.createSaAssignmentStatusLogTable();
        return this.logSaAssignmentStatusChange(saAssignmentId, fromStatus, toStatus, practice);
      }
      logger.error('Error logging SA assignment status change:', error);
      return false;
    }
  }

  async createSaAssignmentStatusLogTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.SA_ASSIGNMENT_STATUS_LOG,
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
      logger.error('Error creating SA Assignment Status Log table:', error);
      return false;
    }
  }

  // Practice Boards Methods
  async getAllPracticeBoards() {
    try {
      const envPrefix = `${getEnvironment()}_practice_board_`;
      const command = new ScanCommand({
        TableName: TABLES.SETTINGS,
        FilterExpression: 'begins_with(setting_key, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': { S: envPrefix }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => {
        const boardData = JSON.parse(item.setting_value?.S || '{}');
        const practiceId = item.setting_key?.S?.replace(envPrefix, '') || '';
        
        return {
          practiceId,
          practices: boardData.practices || [],
          managerId: boardData.managerId || '',
          createdAt: boardData.createdAt || '',
          columns: boardData.columns || []
        };
      });
    } catch (error) {
      console.error('Error getting all practice boards:', error);
      return [];
    }
  }

  // Practice Board Card Follow Methods
  async getCardFollowers(cardKey) {
    try {
      const command = new ScanCommand({
        TableName: TABLES.FOLLOWERS,
        FilterExpression: 'issue_id = :cardKey AND (attribute_not_exists(#status) OR #status = :following)',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':cardKey': { S: cardKey },
          ':following': { S: 'following' }
        }
      });
      
      const result = await this.client.send(command);
      return (result.Items || []).map(item => item.user_email?.S || '');
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return [];
      }
      console.error('Error getting card followers:', error);
      return [];
    }
  }

  async followCard(cardKey, userEmail) {
    try {
      const getCommand = new GetItemCommand({
        TableName: TABLES.FOLLOWERS,
        Key: {
          issue_id: { S: cardKey },
          user_email: { S: userEmail }
        }
      });
      
      const existing = await this.client.send(getCommand);
      
      if (existing.Item) {
        const currentStatus = existing.Item.status?.S || 'following';
        
        if (currentStatus === 'unfollowed') {
          // User is unfollowed and wants to follow again
          const followCommand = new PutItemCommand({
            TableName: TABLES.FOLLOWERS,
            Item: {
              issue_id: { S: cardKey },
              user_email: { S: userEmail },
              status: { S: 'following' },
              created_at: { S: new Date().toISOString() }
            }
          });
          await this.client.send(followCommand);
          return { following: true };
        } else {
          // Currently following - unfollow
          const unfollowCommand = new PutItemCommand({
            TableName: TABLES.FOLLOWERS,
            Item: {
              issue_id: { S: cardKey },
              user_email: { S: userEmail },
              status: { S: 'unfollowed' },
              created_at: { S: new Date().toISOString() }
            }
          });
          await this.client.send(unfollowCommand);
          return { following: false };
        }
      } else {
        // Not following - create follow record
        const putCommand = new PutItemCommand({
          TableName: TABLES.FOLLOWERS,
          Item: {
            issue_id: { S: cardKey },
            user_email: { S: userEmail },
            status: { S: 'following' },
            created_at: { S: new Date().toISOString() }
          }
        });
        await this.client.send(putCommand);
        return { following: true };
      }
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createFollowersTable();
        return this.followCard(cardKey, userEmail);
      }
      console.error('Error following card:', error);
      throw error;
    }
  }

  async isFollowingCard(cardKey, userEmail) {
    try {
      const command = new GetItemCommand({
        TableName: TABLES.FOLLOWERS,
        Key: {
          issue_id: { S: cardKey },
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
      console.error('Error checking card follow status:', error);
      return false;
    }
  }

  // Training & Certs Methods
  async addTrainingCert(practice, type, vendor, name, code, level, trainingType, prerequisites, examsRequired, examCost, notes, createdBy) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Get user info for createdBy field
    let createdByName = createdBy;
    if (typeof window === 'undefined') {
      try {
        const users = await this.getAllUsers();
        const user = users.find(u => u.email === createdBy);
        if (user) {
          createdByName = user.name;
        }
      } catch (error) {
        // Continue with email if user lookup fails
      }
    }
    
    // Create enhanced created field with date, time, timezone, and creator
    const now = new Date();
    const created = `${now.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    })} ${now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })} by ${createdByName}`;
    
    const command = new PutItemCommand({
      TableName: TABLES.TRAINING_CERTS,
      Item: {
        id: { S: id },
        practice: { S: practice },
        type: { S: type },
        vendor: { S: vendor },
        name: { S: name },
        code: { S: code || '' },
        level: { S: level || '' },
        training_type: { S: trainingType || '' },
        prerequisites: { S: prerequisites || '' },
        exams_required: { S: examsRequired || '' },
        exam_cost: { S: examCost || '' },
        notes: { S: notes || '' },
        created: { S: created },
        created_at: { S: timestamp },
        updated_at: { S: timestamp }
      }
    });
    
    try {
      await this.client.send(command);
      return id;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createTrainingCertsTable();
        await this.client.send(command);
        return id;
      }
      logger.error('DynamoDB addTrainingCert error', { error: error.message });
      return false;
    }
  }

  async updateTrainingCert(id, practice, type, vendor, name, code, level, trainingType, prerequisites, examsRequired, examCost, notes, updatedBy) {
    // Get user info for updatedBy field
    let updatedByName = updatedBy;
    if (typeof window === 'undefined') {
      try {
        const users = await this.getAllUsers();
        const user = users.find(u => u.email === updatedBy);
        if (user) {
          updatedByName = user.name;
        }
      } catch (error) {
        // Continue with email if user lookup fails
      }
    }
    
    // Create enhanced last edited field with date, time, timezone, and editor
    const now = new Date();
    const lastEdited = `${now.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric'
    })} ${now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })} by ${updatedByName}`;
    
    try {
      const command = new UpdateItemCommand({
        TableName: TABLES.TRAINING_CERTS,
        Key: { id: { S: id } },
        UpdateExpression: 'SET practice = :practice, #type = :type, vendor = :vendor, #name = :name, code = :code, #level = :level, training_type = :trainingType, prerequisites = :prerequisites, exams_required = :examsRequired, exam_cost = :examCost, notes = :notes, last_edited = :lastEdited, updated_at = :updatedAt',
        ExpressionAttributeNames: {
          '#type': 'type',
          '#name': 'name',
          '#level': 'level'
        },
        ExpressionAttributeValues: {
          ':practice': { S: practice },
          ':type': { S: type },
          ':vendor': { S: vendor },
          ':name': { S: name },
          ':code': { S: code || '' },
          ':level': { S: level || '' },
          ':trainingType': { S: trainingType || '' },
          ':prerequisites': { S: prerequisites || '' },
          ':examsRequired': { S: examsRequired || '' },
          ':examCost': { S: examCost || '' },
          ':notes': { S: notes || '' },
          ':lastEdited': { S: lastEdited },
          ':updatedAt': { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('DynamoDB updateTrainingCert error', { error: error.message });
      return false;
    }
  }

  async deleteTrainingCert(id) {
    try {
      const command = new DeleteItemCommand({
        TableName: TABLES.TRAINING_CERTS,
        Key: { id: { S: id } }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('DynamoDB deleteTrainingCert error', { error: error.message });
      return false;
    }
  }

  async getAllTrainingCerts() {
    const command = new ScanCommand({
      TableName: TABLES.TRAINING_CERTS
    });
    
    try {
      const result = await this.client.send(command);
      return (result.Items || []).map(item => ({
        id: item.id?.S || '',
        practice: item.practice?.S || '',
        type: item.type?.S || '',
        vendor: item.vendor?.S || '',
        name: item.name?.S || '',
        code: item.code?.S || '',
        level: item.level?.S || '',
        trainingType: item.training_type?.S || '',
        prerequisites: item.prerequisites?.S || '',
        examsRequired: item.exams_required?.S || '',
        examCost: item.exam_cost?.S || '',
        notes: item.notes?.S || '',
        createdBy: item.created_by?.S || '',
        created: item.created?.S || '',
        lastEdited: item.last_edited?.S || '',
        createdAt: item.created_at?.S || '',
        updatedAt: item.updated_at?.S || ''
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      logger.error('DynamoDB getAllTrainingCerts error', { error: error.message });
      return [];
    }
  }

  async getTrainingCertsSettings(practice = null) {
    try {
      if (practice) {
        // Get practice-specific settings
        const command = new GetItemCommand({
          TableName: TABLES.TRAINING_CERTS_SETTINGS,
          Key: { id: { S: practice } }
        });
        
        const result = await this.client.send(command);
        
        if (result.Item) {
          return {
            vendors: JSON.parse(result.Item.vendors?.S || '[]'),
            levels: JSON.parse(result.Item.levels?.S || '[]'),
            types: JSON.parse(result.Item.types?.S || '[]')
          };
        }
        
        return { vendors: [], levels: [], types: [] };
      } else {
        // Get all practice settings
        const command = new ScanCommand({
          TableName: TABLES.TRAINING_CERTS_SETTINGS
        });
        
        const result = await this.client.send(command);
        const practiceSettings = {};
        
        (result.Items || []).forEach(item => {
          const practiceId = item.id?.S;
          if (practiceId && practiceId !== 'default') {
            practiceSettings[practiceId] = {
              vendors: JSON.parse(item.vendors?.S || '[]'),
              levels: JSON.parse(item.levels?.S || '[]'),
              types: JSON.parse(item.types?.S || '[]')
            };
          }
        });
        
        return practiceSettings;
      }
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createTrainingCertsSettingsTable();
        return practice ? { vendors: [], levels: [], types: [] } : {};
      }
      logger.error('Error getting training certs settings:', error);
      return practice ? { vendors: [], levels: [], types: [] } : {};
    }
  }

  async updateTrainingCertsSettings(practice, settings) {
    try {
      const command = new PutItemCommand({
        TableName: TABLES.TRAINING_CERTS_SETTINGS,
        Item: {
          id: { S: practice },
          vendors: { S: JSON.stringify(settings.vendors || []) },
          levels: { S: JSON.stringify(settings.levels || []) },
          types: { S: JSON.stringify(settings.types || []) },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await this.createTrainingCertsSettingsTable();
        return this.updateTrainingCertsSettings(practice, settings);
      }
      logger.error('Error updating training certs settings:', error);
      return false;
    }
  }

  async createTrainingCertsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.TRAINING_CERTS,
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
      console.log('Training Certs table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Training Certs table:', error);
      return false;
    }
  }

  async createTrainingCertsSettingsTable() {
    try {
      const command = new CreateTableCommand({
        TableName: TABLES.TRAINING_CERTS_SETTINGS,
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
      console.log('Training Certs Settings table created successfully');
      return true;
    } catch (error) {
      console.error('Error creating Training Certs Settings table:', error);
      return false;
    }
  }

}

export const db = new DynamoDBService();
export { getEnvironment, getTableName };

// Export getCardFollowers function for card reminder notifications
export async function getCardFollowers(cardKey) {
  return await db.getCardFollowers(cardKey);
}