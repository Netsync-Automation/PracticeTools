#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Production environment configuration
const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const docClient = DynamoDBDocumentClient.from(client);

async function updateAssignment395() {
  const tableName = 'PracticeTools-prod-ResourceAssignments';
  const assignmentId = '395';
  
  try {
    console.log('🔍 Fetching assignment #395...');
    
    // Get current assignment
    const getResult = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { id: assignmentId }
    }));
    
    if (!getResult.Item) {
      console.error('❌ Assignment #395 not found');
      return;
    }
    
    const currentCustomer = getResult.Item.customerName;
    console.log('📋 Current customer name:', currentCustomer);
    
    if (currentCustomer !== 'MediCA-LAXl City Fort-Worth-Plaza MediCA-LAXl TX-CENter') {
      console.log('⚠️  Customer name does not match expected value');
      console.log('Expected: MediCA-LAXl City Fort-Worth-Plaza MediCA-LAXl TX-CENter');
      console.log('Found:', currentCustomer);
      return;
    }
    
    // Update customer name
    console.log('🔄 Updating customer name...');
    
    await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { id: assignmentId },
      UpdateExpression: 'SET customerName = :newName, lastModified = :timestamp',
      ExpressionAttributeValues: {
        ':newName': 'Medical City Fort Worth-Plaza Medical Center',
        ':timestamp': new Date().toISOString()
      }
    }));
    
    console.log('✅ Successfully updated assignment #395');
    console.log('New customer name: Medical City Fort Worth-Plaza Medical Center');
    
  } catch (error) {
    console.error('❌ Error updating assignment:', error);
  }
}

// Run the update
updateAssignment395().then(() => {
  console.log('🏁 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});