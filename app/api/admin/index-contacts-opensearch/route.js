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
    
    console.log(`Found ${practiceGroups.length} practice groups`);
    
    let totalCompanies = 0;
    let totalContacts = 0;
    
    for (const group of practiceGroups) {
      console.log(`Processing practice group: ${group.displayName}`);
      
      const contactTypes = await db.getContactTypes(group.id);
      const types = ['Main Contact List', ...(contactTypes || [])];
      
      for (const contactType of types) {
        console.log(`  Processing contact type: ${contactType}`);
        
        const companies = await db.getCompanies(group.id, contactType);
        console.log(`    Found ${companies.length} companies`);
        
        for (const company of companies) {
          await indexCompany(company, group.displayName);
          totalCompanies++;
          
          const contacts = await db.getContacts(company.id);
          
          for (const contact of contacts) {
            await indexContact(contact, company.name, group.id, group.displayName, contactType);
            totalContacts++;
          }
        }
      }
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
