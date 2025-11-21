import { NextResponse } from 'next/server';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function ensureTableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      const createCommand = new CreateTableCommand({
        TableName: tableName,
        KeySchema: [{ AttributeName: 'practiceId', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'practiceId', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST'
      });
      await client.send(createCommand);
      
      // Wait for table to be active
      let tableActive = false;
      while (!tableActive) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
        tableActive = desc.Table.TableStatus === 'ACTIVE';
      }
    } else {
      throw error;
    }
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');
    
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 });
    }

    const tableName = getTableName('PracticeBoardLabels');
    await ensureTableExists(tableName);
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { practiceId }
    });

    const result = await docClient.send(command);
    const labels = result.Item?.labels || [];

    return NextResponse.json({ labels });
  } catch (error) {
    console.error('Error loading labels:', error);
    return NextResponse.json({ error: 'Failed to load labels' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { practiceId, name, color } = await request.json();
    
    if (!practiceId || !name || !color) {
      return NextResponse.json({ error: 'Practice ID, name, and color are required' }, { status: 400 });
    }

    const tableName = getTableName('PracticeBoardLabels');
    await ensureTableExists(tableName);
    
    // Get existing labels
    const getCommand = new GetCommand({
      TableName: tableName,
      Key: { practiceId }
    });

    const result = await docClient.send(getCommand);
    const existingLabels = result.Item?.labels || [];
    
    // Check if label name already exists
    if (existingLabels.some(label => label.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'Label name already exists' }, { status: 400 });
    }

    // Add new label
    const newLabel = {
      id: Date.now().toString(),
      name: name.trim(),
      color,
      createdAt: new Date().toISOString()
    };

    const updatedLabels = [...existingLabels, newLabel];

    const putCommand = new PutCommand({
      TableName: tableName,
      Item: {
        practiceId,
        labels: updatedLabels,
        updatedAt: new Date().toISOString()
      }
    });

    await docClient.send(putCommand);

    return NextResponse.json({ labels: updatedLabels });
  } catch (error) {
    console.error('Error adding label:', error);
    return NextResponse.json({ error: 'Failed to add label' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { practiceId, labelId } = await request.json();
    
    if (!practiceId || !labelId) {
      return NextResponse.json({ error: 'Practice ID and label ID are required' }, { status: 400 });
    }

    const tableName = getTableName('PracticeBoardLabels');
    await ensureTableExists(tableName);
    
    const getCommand = new GetCommand({
      TableName: tableName,
      Key: { practiceId }
    });

    const result = await docClient.send(getCommand);
    const existingLabels = result.Item?.labels || [];
    
    const updatedLabels = existingLabels.filter(label => label.id !== labelId);

    const putCommand = new PutCommand({
      TableName: tableName,
      Item: {
        practiceId,
        labels: updatedLabels,
        updatedAt: new Date().toISOString()
      }
    });

    await docClient.send(putCommand);

    return NextResponse.json({ labels: updatedLabels });
  } catch (error) {
    console.error('Error deleting label:', error);
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}