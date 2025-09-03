import { NextResponse } from 'next/server';
import { DynamoDBClient, CreateTableCommand, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = new DynamoDBClient({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
  });

  try {
    console.log('=== DIRECT DYNAMODB TEST ===');
    
    // Test 1: Try to create table directly
    console.log('Creating test table...');
    try {
      const createCommand = new CreateTableCommand({
        TableName: 'Test-Releases',
        KeySchema: [{ AttributeName: 'version', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'version', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await client.send(createCommand);
      console.log('✅ Table created successfully');
      
      // Wait for table
      await new Promise(resolve => setTimeout(resolve, 10000));
      
    } catch (createError) {
      console.log('❌ Table creation failed:', createError.message);
      if (createError.name !== 'ResourceInUseException') {
        return NextResponse.json({ 
          error: 'Cannot create DynamoDB table', 
          details: createError.message 
        });
      }
      console.log('Table already exists, continuing...');
    }
    
    // Test 2: Try to write data
    console.log('Writing test data...');
    try {
      const putCommand = new PutItemCommand({
        TableName: 'Test-Releases',
        Item: {
          version: { S: 'test-1.0.0' },
          data: { S: 'test data' },
          timestamp: { S: new Date().toISOString() }
        }
      });
      await client.send(putCommand);
      console.log('✅ Data written successfully');
    } catch (writeError) {
      console.log('❌ Data write failed:', writeError.message);
      return NextResponse.json({ 
        error: 'Cannot write to DynamoDB table', 
        details: writeError.message 
      });
    }
    
    // Test 3: Try to read data
    console.log('Reading test data...');
    try {
      const scanCommand = new ScanCommand({
        TableName: 'Test-Releases'
      });
      const result = await client.send(scanCommand);
      console.log('✅ Data read successfully, items:', result.Items?.length || 0);
      
      return NextResponse.json({
        success: true,
        message: 'DynamoDB test completed successfully',
        itemsFound: result.Items?.length || 0,
        items: result.Items || []
      });
    } catch (readError) {
      console.log('❌ Data read failed:', readError.message);
      return NextResponse.json({ 
        error: 'Cannot read from DynamoDB table', 
        details: readError.message 
      });
    }
    
  } catch (error) {
    console.error('DynamoDB test failed:', error);
    return NextResponse.json({ 
      error: 'DynamoDB test failed', 
      details: error.message 
    }, { status: 500 });
  }
}