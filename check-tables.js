import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

async function checkTables() {
  const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
  
  try {
    console.log('Checking DynamoDB tables...');
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    
    console.log('All tables:', response.TableNames);
    
    // Check for email rules tables specifically
    const emailRulesTables = response.TableNames.filter(name => 
      name.includes('EmailRules') || name.includes('email-rules')
    );
    
    console.log('Email Rules tables found:', emailRulesTables);
    
    // Check for dev vs prod patterns
    const devTables = response.TableNames.filter(name => name.includes('-dev-'));
    const prodTables = response.TableNames.filter(name => name.includes('-prod-') || (!name.includes('-dev-') && name.startsWith('PracticeTools')));
    
    console.log('Dev tables:', devTables);
    console.log('Prod tables:', prodTables);
    
  } catch (error) {
    console.error('Error listing tables:', error);
  }
}

checkTables();