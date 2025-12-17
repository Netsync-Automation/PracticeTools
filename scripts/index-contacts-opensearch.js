import { db } from '../lib/dynamodb.js';
import { createContactIndices, indexCompany, indexContact } from '../lib/opensearch-contacts.js';

async function indexAllContacts() {
  console.log('Creating OpenSearch indices...');
  await createContactIndices();
  
  console.log('Fetching practice groups...');
  const practiceGroups = await db.getPracticeGroups();
  
  console.log(`Found ${practiceGroups.length} practice groups`);
  
  let totalCompanies = 0;
  let totalContacts = 0;
  
  for (const group of practiceGroups) {
    console.log(`\nProcessing practice group: ${group.displayName}`);
    
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
        console.log(`      Indexing ${contacts.length} contacts for ${company.name}`);
        
        for (const contact of contacts) {
          await indexContact(contact, company.name, group.id, group.displayName, contactType);
          totalContacts++;
        }
      }
    }
  }
  
  console.log(`\n✓ Indexing complete!`);
  console.log(`  Total companies indexed: ${totalCompanies}`);
  console.log(`  Total contacts indexed: ${totalContacts}`);
}

indexAllContacts().catch(console.error);
