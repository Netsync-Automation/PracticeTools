import { NextResponse } from 'next/server';
import { getTableName } from '../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [tools, partNumbers, customerTypes, billingTypes, terms] = await Promise.all([
      getTools(),
      getPartNumbers(),
      getCustomerTypes(),
      getBillingTypes(),
      getTerms()
    ]);

    return NextResponse.json({
      tools,
      partNumbers,
      customerTypes,
      billingTypes,
      terms
    });
  } catch (error) {
    console.error('Quoting tools GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch quoting tools data' }, { status: 500 });
  }
}

async function getTools() {
  try {
    const tableName = getTableName('QuotingTools');
    const command = new ScanCommand({ TableName: tableName });
    const result = await docClient.send(command);
    return (result.Items || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return [];
    }
    throw error;
  }
}

async function getPartNumbers() {
  try {
    const tableName = getTableName('QuotingPartNumbers');
    const command = new ScanCommand({ TableName: tableName });
    const result = await docClient.send(command);
    return (result.Items || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return [];
    }
    throw error;
  }
}

async function getCustomerTypes() {
  try {
    const tableName = getTableName('QuotingCustomerTypes');
    const command = new ScanCommand({ TableName: tableName });
    const result = await docClient.send(command);
    return (result.Items || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return [];
    }
    throw error;
  }
}

async function getBillingTypes() {
  try {
    const tableName = getTableName('QuotingBillingTypes');
    const command = new ScanCommand({ TableName: tableName });
    const result = await docClient.send(command);
    return (result.Items || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return [];
    }
    throw error;
  }
}

async function getTerms() {
  try {
    const tableName = getTableName('QuotingTerms');
    const command = new ScanCommand({ TableName: tableName });
    const result = await docClient.send(command);
    return (result.Items || []).sort((a, b) => a.months - b.months);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return [];
    }
    throw error;
  }
}