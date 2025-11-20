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
      { table: 'WebexMeetingsRecordings', name: 'Meeting Recordings', description: 'Approved WebEx meeting recordings with transcripts', icon: 'video', filter: true, url: '/company-education/webex-recordings' },
      { table: 'WebexMessages', name: 'Webex Messages', description: 'Messages from monitored WebEx team spaces', icon: 'chat', countUniqueMessages: true, url: '/company-education/webex-messages' },
      { table: 'Documentation', name: 'Documentation', description: 'Uploaded training documents and resources', icon: 'document', countUniqueDocuments: true, url: '/company-education/documentation' },
      { table: 'Issues', name: 'Practice Issues', description: 'Practice issues and questions (filtered by permissions)', icon: 'issue', url: '/practice-issues' },
      { table: 'resource-assignments', name: 'Resource Assignments', description: 'Project resource assignments (filtered by permissions)', icon: 'assignment', url: '/projects/resource-assignments' },
      { table: 'sa-assignments', name: 'SA Assignments', description: 'Sales architect assignments (filtered by permissions)', icon: 'assignment', url: '/projects/sa-assignments' },
      { table: 'SAToAMMappings', name: 'SA to AM Mapping', description: 'Sales architect to account manager mappings', icon: 'mapping', url: '/pre-sales/sa-to-am-mapping' },
      { table: 'TrainingCerts', name: 'Training Certifications', description: 'Practice training certifications (filtered by permissions)', icon: 'certificate', url: '/practice-information/training-certs' },
      { table: 'Companies', name: 'Companies', description: 'Company contact information (filtered by permissions)', icon: 'company', url: '/contact-information' },
      { table: 'Contacts', name: 'Contacts', description: 'Contact information (filtered by permissions)', icon: 'contact', url: '/contact-information' },
      { table: 'Users', name: 'Users', description: 'User information (filtered by permissions)', icon: 'user', url: '/admin/users' },
      { table: 'PracticeInfoPages', name: 'Practice Information', description: 'Practice information pages', icon: 'info', url: '/practice-information' },
      { table: 'Settings', name: 'Practice Boards', description: 'Practice board cards, columns, and topics', icon: 'info', countBoards: true, url: '/practice-information' },
      { table: 'Releases', name: 'Release Notes', description: 'Application release notes and features', icon: 'release', url: '/admin/releases' }
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
      } else if (source.countUniqueDocuments) {
        // Count unique documents (not chunks) from Documentation table
        const result = await docClient.send(new ScanCommand({
          TableName: getTableName(source.table),
          ProjectionExpression: 'id, fileName'
        }));
        const items = result.Items || [];
        // Count unique documents by grouping by fileName or id
        const uniqueDocuments = new Set();
        items.forEach(item => {
          if (item.fileName) {
            uniqueDocuments.add(item.fileName);
          } else if (item.id) {
            uniqueDocuments.add(item.id);
          }
        });
        count = uniqueDocuments.size;
      } else if (source.countUniqueMessages) {
        // Count messages from WebexMessages table
        count = await checkTable(source.table);
      } else if (source.countBoards) {
        // Count practice board cards from Settings table
        const result = await docClient.send(new ScanCommand({
          TableName: getTableName(source.table)
        }));
        const settings = result.Items || [];
        const practiceBoards = settings.filter(setting => 
          setting.key && setting.key.includes('practice_board_')
        );
        
        let cardCount = 0;
        practiceBoards.forEach(board => {
          try {
            const boardData = JSON.parse(board.value);
            if (boardData.columns && Array.isArray(boardData.columns)) {
              boardData.columns.forEach(column => {
                if (column.cards && Array.isArray(column.cards)) {
                  cardCount += column.cards.length;
                }
              });
            }
          } catch (error) {
            // Skip invalid board data
          }
        });
        count = cardCount;
      } else {
        count = await checkTable(source.table);
      }
      
      console.log(`[DATA SOURCES DEBUG] ${source.name}: ${count} items`);
      
      if (count > 0) {
        sources.push({
          name: source.name,
          description: source.description,
          count: count,
          icon: source.icon,
          url: source.url
        });
      }
    }

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
