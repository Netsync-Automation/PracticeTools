import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkTable(tableName) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: getTableName(tableName),
      Select: 'COUNT'
    }));
    return result.Count || 0;
  } catch (error) {
    return 0;
  }
}

export async function GET() {
  try {
    const sources = [];

    const dataSources = [
      { table: 'WebexMeetingsRecordings', name: 'Meeting Recordings', description: 'Approved WebEx meeting recordings with transcripts', icon: 'video', filter: true },
      { table: 'WebexMessages', name: 'Team Messages', description: 'Messages from monitored WebEx team spaces', icon: 'chat' },
      { table: 'Documentation', name: 'Documentation', description: 'Uploaded training documents and resources', icon: 'document' },
      { table: 'Issues', name: 'Practice Issues', description: 'Practice issues and questions (filtered by permissions)', icon: 'issue' },
      { table: 'resource-assignments', name: 'Resource Assignments', description: 'Project resource assignments (filtered by permissions)', icon: 'assignment' },
      { table: 'sa-assignments', name: 'SA Assignments', description: 'Sales architect assignments (filtered by permissions)', icon: 'assignment' },
      { table: 'SAToAMMappings', name: 'SA to AM Mapping', description: 'Sales architect to account manager mappings', icon: 'mapping' },
      { table: 'TrainingCerts', name: 'Training Certifications', description: 'Practice training certifications (filtered by permissions)', icon: 'certificate' },
      { table: 'Companies', name: 'Companies', description: 'Company contact information (filtered by permissions)', icon: 'company' },
      { table: 'Contacts', name: 'Contacts', description: 'Contact information (filtered by permissions)', icon: 'contact' },
      { table: 'Users', name: 'Users', description: 'User information (filtered by permissions)', icon: 'user' },
      { table: 'PracticeInfoPages', name: 'Practice Information', description: 'Practice information pages', icon: 'info' },
      { table: 'Releases', name: 'Release Notes', description: 'Application release notes and features', icon: 'release' }
    ];

    for (const source of dataSources) {
      let count = 0;
      
      if (source.filter) {
        const result = await docClient.send(new ScanCommand({
          TableName: getTableName(source.table),
          FilterExpression: 'approved = :approved AND attribute_exists(transcriptText)',
          ExpressionAttributeValues: { ':approved': true },
          Select: 'COUNT'
        }));
        count = result.Count || 0;
      } else {
        count = await checkTable(source.table);
      }
      
      if (count > 0) {
        sources.push({
          name: source.name,
          description: source.description,
          count: count,
          icon: source.icon
        });
      }
    }

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
