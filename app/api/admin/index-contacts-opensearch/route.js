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
    
    console.log('Fetching practice groups...');
    const practiceGroups = await db.getPracticeGroups();
    
    console.log('Fetching all companies...');
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    const { getTableName } = await import('../../../../lib/dynamodb.js');
    
    const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
    
    let totalCompanies = 0;
    let totalContacts = 0;
    
    const compResult = await dynamoClient.send(new ScanCommand({ TableName: getTableName('Companies') }));
    const companies = (compResult.Items || []).filter(c => !c.is_deleted);
    console.log(`Found ${companies.length} companies`);
    
    for (const company of companies) {
      const practiceGroup = practiceGroups.find(g => g.id === company.practice_group_id);
      await indexCompany(company, practiceGroup?.displayName || '');
      totalCompanies++;
    }
    
    console.log('Fetching all contacts...');
    const contResult = await dynamoClient.send(new ScanCommand({ TableName: getTableName('Contacts') }));
    const contacts = (contResult.Items || []).filter(c => !c.is_deleted);
    console.log(`Found ${contacts.length} contacts`);
    
    for (const contact of contacts) {
      const company = companies.find(c => c.id === contact.company_id);
      const practiceGroup = practiceGroups.find(g => g.id === company?.practice_group_id);
      await indexContact(contact, company?.name || '', company?.practice_group_id || '', practiceGroup?.displayName || '', company?.contact_type || '');
      totalContacts++;
    }
    
    console.log('Refreshing indices...');
    const { createOpenSearchClient } = await import('../../../../lib/opensearch-setup.js');
    const client = createOpenSearchClient();
    try {
      await client.indices.refresh({ index: '_all' });
    } catch (error) {
      console.log('Refresh skipped (indices may not exist yet)');
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
