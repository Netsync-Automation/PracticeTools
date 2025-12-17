import { createOpenSearchClient } from './opensearch-setup.js';
import { getEnvironment } from './dynamodb.js';

const env = getEnvironment();
const COMPANIES_INDEX = `practicetools-${env}-companies`;
const CONTACTS_INDEX = `practicetools-${env}-contacts`;

export const deleteContactIndices = async () => {
  const client = createOpenSearchClient();
  
  try {
    await client.indices.delete({ index: COMPANIES_INDEX });
  } catch (error) {
    // Index might not exist
  }
  
  try {
    await client.indices.delete({ index: CONTACTS_INDEX });
  } catch (error) {
    // Index might not exist
  }
};

export const createContactIndices = async () => {
  const client = createOpenSearchClient();
  
  const companiesIndexBody = {
    mappings: {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        website: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        msaSigned: { type: 'keyword' },
        tier: { type: 'keyword' },
        technology: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        solutionType: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        practiceGroupId: { type: 'keyword' },
        practiceGroupName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        contactType: { type: 'keyword' },
        deleted: { type: 'boolean' }
      }
    }
  };

  const contactsIndexBody = {
    mappings: {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        email: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        role: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        cellPhone: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        officePhone: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        companyId: { type: 'keyword' },
        companyName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        practiceGroupId: { type: 'keyword' },
        practiceGroupName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        contactType: { type: 'keyword' },
        deleted: { type: 'boolean' }
      }
    }
  };

  try {
    await client.indices.create({ index: COMPANIES_INDEX, body: companiesIndexBody });
  } catch (error) {
    if (error.meta?.body?.error?.type !== 'resource_already_exists_exception') {
      console.error('Error creating companies index:', error);
    }
  }

  try {
    await client.indices.create({ index: CONTACTS_INDEX, body: contactsIndexBody });
  } catch (error) {
    if (error.meta?.body?.error?.type !== 'resource_already_exists_exception') {
      console.error('Error creating contacts index:', error);
    }
  }
};

export const indexCompany = async (company, practiceGroupName) => {
  const client = createOpenSearchClient();
  
  try {
    await client.index({
      index: COMPANIES_INDEX,
      id: company.id,
      body: {
        ...company,
        practiceGroupName,
        deleted: false
      }
    });
  } catch (error) {
    console.error('Error indexing company:', error);
  }
};

export const indexContact = async (contact, companyName, practiceGroupId, practiceGroupName, contactType) => {
  const client = createOpenSearchClient();
  
  try {
    await client.index({
      index: CONTACTS_INDEX,
      id: contact.id,
      body: {
        ...contact,
        companyName,
        practiceGroupId,
        practiceGroupName,
        contactType,
        deleted: false
      }
    });
  } catch (error) {
    console.error('Error indexing contact:', error);
  }
};

export const deleteCompanyFromIndex = async (companyId) => {
  const client = createOpenSearchClient();
  
  try {
    await client.update({
      index: COMPANIES_INDEX,
      id: companyId,
      body: {
        doc: { deleted: true }
      }
    });
  } catch (error) {
    console.error('Error marking company as deleted:', error);
  }
};

export const deleteContactFromIndex = async (contactId) => {
  const client = createOpenSearchClient();
  
  try {
    await client.update({
      index: CONTACTS_INDEX,
      id: contactId,
      body: {
        doc: { deleted: true }
      }
    });
  } catch (error) {
    console.error('Error marking contact as deleted:', error);
  }
};

export const searchContacts = async (searchTerm, filters = {}) => {
  const client = createOpenSearchClient();
  
  const must = [
    { term: { deleted: false } }
  ];

  if (searchTerm) {
    must.push({
      multi_match: {
        query: searchTerm,
        fields: ['name^2', 'website', 'email', 'role', 'cellPhone', 'companyName'],
        type: 'best_fields',
        fuzziness: 'AUTO'
      }
    });
  }

  if (filters.practiceGroupId) {
    must.push({ term: { practiceGroupId: filters.practiceGroupId } });
  }

  if (filters.contactType) {
    must.push({ term: { contactType: filters.contactType } });
  }

  if (filters.tier) {
    must.push({ term: { tier: filters.tier } });
  }

  if (filters.technology) {
    must.push({ match: { technology: filters.technology } });
  }

  if (filters.solutionType) {
    must.push({ match: { solutionType: filters.solutionType } });
  }

  try {
    const [companiesResult, contactsResult] = await Promise.all([
      client.search({
        index: COMPANIES_INDEX,
        body: {
          query: { bool: { must } },
          size: 50
        }
      }),
      client.search({
        index: CONTACTS_INDEX,
        body: {
          query: { bool: { must } },
          size: 50
        }
      })
    ]);

    const companies = companiesResult.body.hits.hits.map(hit => ({
      ...hit._source,
      type: 'company',
      matchText: hit._source.name
    }));

    const contacts = contactsResult.body.hits.hits.map(hit => ({
      ...hit._source,
      type: 'contact',
      matchText: `${hit._source.name} (${hit._source.companyName})`
    }));

    return [...companies, ...contacts].slice(0, 10);
  } catch (error) {
    console.error('Error searching contacts:', error);
    throw error;
  }
};
