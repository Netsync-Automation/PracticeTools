import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const environment = process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
const tableName = `PracticeTools-${environment}-sa-assignments`;

console.log(`Scanning SA Assignments table: ${tableName}`);
console.log(`Environment: ${environment}`);
console.log('='.repeat(80));

try {
  const command = new ScanCommand({
    TableName: tableName
  });
  
  const result = await client.send(command);
  
  if (!result.Items || result.Items.length === 0) {
    console.log('No SA assignments found in the database.');
  } else {
    console.log(`Found ${result.Items.length} SA assignment(s):\n`);
    
    result.Items.forEach((item, index) => {
      console.log(`SA Assignment #${index + 1}:`);
      console.log('-'.repeat(40));
      
      // Format the item for better readability
      const formatted = {
        id: item.id?.S || 'N/A',
        sa_assignment_number: item.sa_assignment_number?.N || 'N/A',
        practice: item.practice?.S || 'N/A',
        status: item.status?.S || 'N/A',
        opportunityId: item.opportunityId?.S || 'N/A',
        requestDate: item.requestDate?.S || 'N/A',
        eta: item.eta?.S || 'N/A',
        customerName: item.customerName?.S || 'N/A',
        opportunityName: item.opportunityName?.S || 'N/A',
        region: item.region?.S || 'N/A',
        am: item.am?.S || 'N/A',
        saAssigned: item.saAssigned?.S || 'N/A',
        dateAssigned: item.dateAssigned?.S || 'N/A',
        notes: item.notes?.S || 'N/A',
        isr: item.isr?.S || 'N/A',
        submittedBy: item.submittedBy?.S || 'N/A',
        attachments: item.attachments?.S || '[]',
        sa_assignment_notification_users: item.sa_assignment_notification_users?.S || '[]',
        scoopUrl: item.scoopUrl?.S || 'N/A',
        created_at: item.created_at?.S || 'N/A',
        updated_at: item.updated_at?.S || 'N/A'
      };
      
      Object.entries(formatted).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
      
      // Parse and display JSON fields
      try {
        const attachments = JSON.parse(formatted.attachments);
        if (attachments.length > 0) {
          console.log('Parsed attachments:', JSON.stringify(attachments, null, 2));
        }
      } catch (e) {
        console.log('Could not parse attachments JSON');
      }
      
      try {
        const notificationUsers = JSON.parse(formatted.sa_assignment_notification_users);
        if (notificationUsers.length > 0) {
          console.log('Parsed notification users:', JSON.stringify(notificationUsers, null, 2));
        }
      } catch (e) {
        console.log('Could not parse notification users JSON');
      }
      
      console.log('\n');
    });
  }
  
} catch (error) {
  console.error('Error scanning SA assignments table:', error);
  if (error.name === 'ResourceNotFoundException') {
    console.log(`Table ${tableName} does not exist.`);
  }
}