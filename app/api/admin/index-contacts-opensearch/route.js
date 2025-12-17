import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check.js';
import { db } from '../../../../lib/dynamodb.js';
import { deleteContactIndices, createContactIndices, indexCompany, indexContact } from '../../../../lib/opensearch-contacts.js';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Deleting old OpenSearch indices...');
    await deleteContactIndices();
    
    console.log('Creating OpenSearch indices...');
    await createContactIndices();
    
    console.log('Fetching all companies...');
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const { getTableName } = await import('../../../../lib/dynamodb.js');
    
    const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
    
    let totalCompanies = 0;
    let totalContacts = 0;
    
    const compResult = await dynamoClient.send(new ScanCommand({ TableName: getTableName('Companies') }));
    const companies = compResult.Items || [];
    console.log(`Found ${companies.length} companies`);
    
    for (const company of companies) {
      await indexCompany(company, '');
      totalCompanies++;
    }
    
    console.log('Fetching all contacts...');
    const contResult = await dynamoClient.send(new ScanCommand({ TableName: getTableName('Contacts') }));
    const contacts = contResult.Items || [];
    console.log(`Found ${contacts.length} contacts`);
    
    for (const contact of contacts) {
      const company = companies.find(c => c.id === contact.company_id);
      await indexContact(contact, company?.name || '', company?.practice_group_id || '', '', company?.contact_type || '');
      totalContacts++;
    }
    
    return NextResponse.json({
      success: true,
      message: 'OpenSearch indexing complete',
      totalCompanies,
      totalContacts
    });
    
  } catch (error) {
    console.error('Error indexing contacts:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
