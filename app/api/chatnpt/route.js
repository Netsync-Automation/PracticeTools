import { NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../lib/dynamodb';
import { getUserFromRequest, logAIAccess } from '../../../lib/ai-user-context';
import { filterDataForUser, sanitizeDataForAI } from '../../../lib/ai-access-control';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function parseVTTTranscript(vttText) {
  const chunks = [];
  const lines = vttText.split('\n');
  let currentTimestamp = null;
  let currentText = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^\d{2}:\d{2}:\d{2}/)) {
      if (currentTimestamp && currentText.length > 0) {
        chunks.push({ timestamp: currentTimestamp, text: currentText.join(' ') });
      }
      currentTimestamp = line.split(' --> ')[0];
      currentText = [];
    } else if (line && !line.startsWith('WEBVTT') && !line.match(/^\d+$/)) {
      currentText.push(line);
    }
  }
  if (currentTimestamp && currentText.length > 0) {
    chunks.push({ timestamp: currentTimestamp, text: currentText.join(' ') });
  }
  return chunks;
}

async function fetchTable(tableName, filterExpression = null, expressionAttributeValues = null) {
  try {
    const params = { TableName: getTableName(tableName) };
    if (filterExpression) {
      params.FilterExpression = filterExpression;
      params.ExpressionAttributeValues = expressionAttributeValues;
    }
    const result = await docClient.send(new ScanCommand(params));
    console.log(`Fetched ${tableName}: ${result.Items?.length || 0} items`);
    return result.Items || [];
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error.message);
    return [];
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    const { question, conversationHistory = [] } = await request.json();
    
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }
    
    if (user) {
      await logAIAccess(user, 'chatnpt_query', { questionLength: question.length });
    }

    // Fetch ALL data from environment-specific tables
    const [recordingsResult, messages, docs, issues, assignments, saAssignments, training, saMappings, companies, contacts, users, practiceInfo, releases] = await Promise.all([
      docClient.send(new ScanCommand({
        TableName: getTableName('WebexMeetingsRecordings'),
        FilterExpression: 'approved = :approved AND attribute_exists(transcriptText)',
        ExpressionAttributeValues: { ':approved': true }
      })),
      fetchTable('WebexMessages'),
      fetchTable('Documentation'),
      fetchTable('Issues'),
      fetchTable('resource-assignments'),
      fetchTable('sa-assignments'),
      fetchTable('TrainingCerts'),
      fetchTable('SAToAMMappings'),
      fetchTable('Companies', 'attribute_not_exists(is_deleted) OR is_deleted = :false', { ':false': false }),
      fetchTable('Contacts', 'attribute_not_exists(is_deleted) OR is_deleted = :false', { ':false': false }),
      fetchTable('Users'),
      fetchTable('PracticeInfoPages'),
      fetchTable('Releases')
    ]);

    const recordings = recordingsResult.Items || [];
    
    // Filter data using same methods as application APIs
    const issuesResult = user ? await filterDataForUser('issues', issues, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    const assignmentsResult = user ? await filterDataForUser('assignments', assignments, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    const saAssignmentsResult = user ? await filterDataForUser('sa_assignments', saAssignments, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    const trainingResult = user ? await filterDataForUser('training_certs', training, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    const companiesResult = user ? await filterDataForUser('companies', companies, user.email) : { filtered: companies, restricted: false, reason: null };
    const contactsResult = user ? await filterDataForUser('contacts', contacts, user.email) : { filtered: contacts, restricted: false, reason: null };
    
    const filteredIssues = issuesResult.filtered;
    const filteredAssignments = assignmentsResult.filtered;
    const filteredSaAssignments = saAssignmentsResult.filtered;
    const filteredTraining = trainingResult.filtered;
    const filteredCompanies = companiesResult.filtered;
    const filteredContacts = contactsResult.filtered;
    
    // Collect restriction info for user feedback
    const restrictions = [];
    if (issuesResult.restricted && issuesResult.reason) restrictions.push(`Issues: ${issuesResult.reason}`);
    if (assignmentsResult.restricted && assignmentsResult.reason) restrictions.push(`Assignments: ${assignmentsResult.reason}`);
    if (contactsResult.restricted && contactsResult.reason) restrictions.push(`Contacts: ${contactsResult.reason}`);

    const chunksWithMetadata = [];
    
    recordings.forEach(rec => {
      const chunks = parseVTTTranscript(rec.transcriptText);
      chunks.forEach(chunk => {
        chunksWithMetadata.push({
          source: 'Webex Recordings',
          topic: rec.topic,
          timestamp: chunk.timestamp,
          text: chunk.text
        });
      });
    });

    messages.forEach(msg => {
      chunksWithMetadata.push({
        source: 'Webex Messages',
        topic: `Message from ${msg.person_email}`,
        text: msg.text
      });
      msg.attachments?.forEach(att => {
        if (att.extractedText) {
          chunksWithMetadata.push({
            source: 'Webex Messages',
            topic: `Attachment: ${att.fileName}`,
            text: att.extractedText
          });
        }
      });
    });

    docs.forEach(doc => {
      chunksWithMetadata.push({
        source: 'Documentation',
        topic: doc.fileName,
        text: doc.extractedText || `Document: ${doc.fileName}`
      });
    });

    filteredIssues.forEach(issue => {
      const sanitized = sanitizeDataForAI('issues', issue);
      chunksWithMetadata.push({
        source: 'Practice Issues',
        topic: `Issue #${sanitized.issue_number}: ${sanitized.title}`,
        text: `Type: ${sanitized.issue_type}\nStatus: ${sanitized.status}\nDescription: ${sanitized.description}\nPractice: ${sanitized.practice || 'N/A'}`,
        url: `/issues/${issue.id}`,
        id: issue.id
      });
    });
    

    
    filteredAssignments.forEach(assignment => {
      const sanitized = sanitizeDataForAI('assignments', assignment);
      chunksWithMetadata.push({
        source: 'Resource Assignments',
        topic: `Assignment #${sanitized.assignment_number}: ${sanitized.customerName}`,
        text: `Practice: ${sanitized.practice}\nStatus: ${sanitized.status}\nProject: ${sanitized.projectNumber}\nDescription: ${sanitized.projectDescription}\nRegion: ${sanitized.region}\nPM: ${sanitized.pm || 'N/A'}\nResource: ${sanitized.resourceAssigned || 'N/A'}`,
        url: `/projects/resource-assignments/${assignment.id}`,
        id: assignment.id
      });
    });
    
    filteredSaAssignments.forEach(assignment => {
      const sanitized = sanitizeDataForAI('assignments', assignment);
      chunksWithMetadata.push({
        source: 'SA Assignments',
        topic: `SA Assignment #${sanitized.sa_assignment_number}: ${sanitized.customerName || 'Unknown Customer'}`,
        text: `Customer: ${sanitized.customerName || 'N/A'}\nPractice: ${sanitized.practice}\nStatus: ${sanitized.status}\nOpportunity: ${sanitized.opportunityName || 'N/A'}\nOpportunity ID: ${sanitized.opportunityId || 'N/A'}\nSA Assigned: ${sanitized.saAssigned || 'Unassigned'}\nAM: ${sanitized.am || 'N/A'}\nISR: ${sanitized.isr || 'N/A'}\nRegion: ${sanitized.region || 'N/A'}`,
        url: `/projects/sa-assignments/${assignment.id}`,
        id: assignment.id
      });
    });
    
    filteredTraining.forEach(cert => {
      const sanitized = sanitizeDataForAI('training_certs', cert);
      const quantityNeeded = parseInt(cert.quantity_needed || cert.quantityNeeded) || 0;
      const signUps = Array.isArray(cert.sign_ups) ? cert.sign_ups : (Array.isArray(cert.signUps) ? cert.signUps : []);
      const totalSignUps = signUps.reduce((sum, signup) => sum + (signup.iterations || 1), 0);
      const totalCompleted = signUps.reduce((sum, signup) => sum + (signup.completed_iterations || signup.completedIterations || 0), 0);
      chunksWithMetadata.push({
        source: 'Training Certifications',
        topic: `${sanitized.vendor} - ${sanitized.name}`,
        text: `Practice: ${sanitized.practice}\nType: ${sanitized.type}\nVendor: ${sanitized.vendor}\nName: ${sanitized.name}\nLevel: ${sanitized.level || 'N/A'}\nCode: ${sanitized.code || 'N/A'}\nQuantity Needed: ${quantityNeeded}\nTotal Sign-Ups: ${totalSignUps}\nTotal Completed: ${totalCompleted}\nPrerequisites: ${sanitized.prerequisites || 'None'}`
      });
    });
    
    saMappings.forEach(mapping => {
      chunksWithMetadata.push({
        source: 'SA to AM Mapping',
        topic: `${mapping.sa_name} → ${mapping.am_name}`,
        text: `SA: ${mapping.sa_name} (${mapping.sa_email})\nAM: ${mapping.am_name} (${mapping.am_email})\nRegion: ${mapping.region || 'N/A'}\nPractice: ${mapping.practice || 'N/A'}`
      });
    });
    
    filteredCompanies.forEach(company => {
      chunksWithMetadata.push({
        source: 'Companies',
        topic: company.name,
        text: `Company: ${company.name}\nTier: ${company.tier}\nTechnology: ${Array.isArray(company.technology) ? company.technology.join(', ') : company.technology}\nWebsite: ${company.website}`
      });
    });
    
    filteredContacts.forEach(contact => {
      const company = filteredCompanies.find(c => c.id === contact.companyId);
      chunksWithMetadata.push({
        source: 'Contacts',
        topic: `${contact.name} - ${company?.name || 'Unknown Company'}`,
        text: `Name: ${contact.name}\nCompany: ${company?.name || 'Unknown'}\nEmail: ${contact.email}\nRole: ${contact.role}\nPhone: ${contact.cellPhone || contact.cell_phone || 'N/A'}`
      });
    });
    
    users.forEach(u => {
      const sanitized = sanitizeDataForAI('users', u);
      chunksWithMetadata.push({
        source: 'Users',
        topic: sanitized.name,
        text: `Name: ${sanitized.name}\nEmail: ${sanitized.email}\nRole: ${sanitized.role}\nPractices: ${Array.isArray(sanitized.practices) ? sanitized.practices.join(', ') : 'N/A'}`
      });
    });
    
    practiceInfo.forEach(page => {
      chunksWithMetadata.push({
        source: 'Practice Information',
        topic: page.title,
        text: `Title: ${page.title}\nDescription: ${page.description}\nContent: ${page.content}`
      });
    });
    
    releases.forEach(release => {
      chunksWithMetadata.push({
        source: 'Release Notes',
        topic: `Version ${release.version}`,
        text: `Version: ${release.version}\nDate: ${release.date}\nType: ${release.type}\nNotes: ${release.notes}`
      });
    });
    
    const context = chunksWithMetadata.map((chunk, idx) => {
      const idSuffix = chunk.id ? `|ID:${chunk.id}` : '';
      return `[Source ${idx}|${chunk.source}|${chunk.topic}${chunk.timestamp ? '|' + chunk.timestamp : ''}${idSuffix}]\n${chunk.text}`;
    }).join('\n\n');

    // Detect if this is a "show all" query that needs pre-filtering
    let filteredContext = context;
    let preFilteredCount = 0;
    let matchingChunks = [];
    
    // Pattern 1: "show all projects where X is PM"
    const pmMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:project|assignment).*?\s+(\w[\w\s]+?)\s+is\s+(?:the\s+)?(?:pm|project manager)/i);
    if (pmMatch) {
      const pmName = pmMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'Resource Assignments' && 
        chunk.text && 
        chunk.text.toLowerCase().includes('pm:') &&
        chunk.text.toLowerCase().includes(pmName)
      );
    }
    
    // Pattern 2: "show all opportunities/SA assignments for X" (customer)
    const customerMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:opportunit(?:y|ies)|sa assignment).*(?:for|with|at)\s+([a-z\s&]+?)(?:\?|$)/i);
    if (!matchingChunks.length && customerMatch) {
      const customerName = customerMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'SA Assignments' && 
        chunk.text && 
        chunk.text.toLowerCase().includes('customer:') &&
        chunk.text.toLowerCase().includes(customerName)
      );
    }
    
    // Pattern 3: "show all opportunities where X is SA"
    const saMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:opportunit(?:y|ies)|sa assignment).*(?:where|with)\s+([a-z\s]+?)\s+is\s+(?:the\s+)?(?:sa|solution architect)/i);
    if (!matchingChunks.length && saMatch) {
      const saName = saMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'SA Assignments' && 
        chunk.text && 
        chunk.text.toLowerCase().includes('sa assigned:') &&
        chunk.text.toLowerCase().includes(saName)
      );
    }
    
    // Pattern 4: "what projects is X assigned to" (resource)
    const resourceMatch = question.match(/(?:what|which).*(?:project|assignment).*(?:is|are)\s+(\w[\w\s]+?)\s+assigned/i);
    if (!matchingChunks.length && resourceMatch) {
      const resourceName = resourceMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'Resource Assignments' && 
        chunk.text && 
        chunk.text.toLowerCase().includes('resource:') &&
        chunk.text.toLowerCase().includes(resourceName)
      );
    }
    
    // Pattern 5: Practice-based queries
    const practiceMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:project|assignment|opportunit).*(?:in|for)\s+(\w[\w\s]+?)\s+practice/i);
    if (!matchingChunks.length && practiceMatch) {
      const practiceName = practiceMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        (chunk.source === 'Resource Assignments' || chunk.source === 'SA Assignments') &&
        chunk.text &&
        chunk.text.toLowerCase().includes('practice:') &&
        chunk.text.toLowerCase().includes(practiceName)
      );
    }
    
    // Pattern 6: Status-based queries
    const statusMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:project|assignment|opportunit).*(?:with|in)\s+(\w+)\s+status/i);
    if (!matchingChunks.length && statusMatch) {
      const statusName = statusMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        (chunk.source === 'Resource Assignments' || chunk.source === 'SA Assignments') &&
        chunk.text &&
        chunk.text.toLowerCase().includes('status:') &&
        chunk.text.toLowerCase().includes(statusName)
      );
    }
    
    // Pattern 7: Region-based queries
    const regionMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:project|assignment|opportunit).*(?:in|for)\s+([a-z\-]+)\s+region/i);
    if (!matchingChunks.length && regionMatch) {
      const regionName = regionMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        (chunk.source === 'Resource Assignments' || chunk.source === 'SA Assignments') &&
        chunk.text &&
        chunk.text.toLowerCase().includes('region:') &&
        chunk.text.toLowerCase().includes(regionName)
      );
    }
    
    // Pattern 8: AM (Account Manager) queries
    const amMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:opportunit|sa assignment).*(?:where|with)\s+([a-z\s]+?)\s+is\s+(?:the\s+)?(?:am|account manager)/i);
    if (!matchingChunks.length && amMatch) {
      const amName = amMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'SA Assignments' &&
        chunk.text &&
        chunk.text.toLowerCase().includes('am:') &&
        chunk.text.toLowerCase().includes(amName)
      );
    }
    
    // Pattern 9: ISR (Inside Sales Rep) queries
    const isrMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:opportunit|sa assignment).*(?:where|with)\s+([a-z\s]+?)\s+is\s+(?:the\s+)?isr/i);
    if (!matchingChunks.length && isrMatch) {
      const isrName = isrMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'SA Assignments' &&
        chunk.text &&
        chunk.text.toLowerCase().includes('isr:') &&
        chunk.text.toLowerCase().includes(isrName)
      );
    }
    
    // Pattern 10: Contact information queries
    const contactMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:contact|people|person).*(?:at|for|from)\s+([a-z\s&]+?)(?:\?|$)/i);
    if (!matchingChunks.length && contactMatch) {
      const companyName = contactMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'Contacts' &&
        chunk.text &&
        chunk.text.toLowerCase().includes('company:') &&
        chunk.text.toLowerCase().includes(companyName)
      );
    }
    
    // Pattern 11: SA to AM Mapping queries
    const saMappingMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:sa|mapping|am).*(?:for|with|in)\s+([a-z\s\-]+?)\s+(?:region|practice)/i);
    if (!matchingChunks.length && saMappingMatch) {
      const filterValue = saMappingMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'SA to AM Mapping' &&
        chunk.text &&
        chunk.text.toLowerCase().includes(filterValue)
      );
    }
    
    // Pattern 12: Training Certifications queries
    const trainingMatch = question.match(/(?:show|list|find|get).*(?:all|every).*(?:training|cert|certification).*(?:for|in)\s+([a-z\s]+?)(?:\s+practice|\?|$)/i);
    if (!matchingChunks.length && trainingMatch) {
      const practiceName = trainingMatch[1].trim().toLowerCase();
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === 'Training Certifications' &&
        chunk.text &&
        chunk.text.toLowerCase().includes('practice:') &&
        chunk.text.toLowerCase().includes(practiceName)
      );
    }
    
    // Apply pre-filtering if matches found - return directly without AI
    if (matchingChunks.length > 0) {
      let description = '';
      if (pmMatch) description = `where ${pmMatch[1].trim()} is the Project Manager`;
      else if (resourceMatch) description = `where ${resourceMatch[1].trim()} is assigned as a resource`;
      else if (customerMatch) description = `for customer ${customerMatch[1].trim()}`;
      else if (saMatch) description = `where ${saMatch[1].trim()} is the Solution Architect`;
      else if (practiceMatch) description = `in the ${practiceMatch[1].trim()} practice`;
      else if (statusMatch) description = `with ${statusMatch[1].trim()} status`;
      else if (regionMatch) description = `in the ${regionMatch[1].trim()} region`;
      else if (amMatch) description = `where ${amMatch[1].trim()} is the Account Manager`;
      else if (isrMatch) description = `where ${isrMatch[1].trim()} is the ISR`;
      else if (contactMatch) description = `at ${contactMatch[1].trim()}`;
      else if (saMappingMatch) description = `for ${saMappingMatch[1].trim()}`;
      else if (trainingMatch) description = `for the ${trainingMatch[1].trim()} practice`;
      
      const itemType = matchingChunks[0].source === 'Contacts' ? 'contacts' : 
                       (matchingChunks[0].source === 'SA to AM Mapping' ? 'SA to AM mappings' : 
                       (matchingChunks[0].source === 'Training Certifications' ? 'training certifications' : 
                       (matchingChunks[0].source === 'SA Assignments' ? 'opportunities' : 'projects')));
      const answer = `Found ${matchingChunks.length} ${itemType} ${description}.\n\nAll ${matchingChunks.length} items are listed in the sources below. Click "View all ${matchingChunks.length} citations" to see the complete list with details.`;
      
      const sources = matchingChunks.map(chunk => ({
        source: chunk.source,
        topic: chunk.topic,
        text: chunk.text,
        url: chunk.url,
        id: chunk.id
      }));
      
      if (user) {
        await logAIAccess(user, 'chatnpt_response', { sourcesCount: sources.length, preFiltered: true });
      }
      
      return NextResponse.json({ answer, sources });
    }

    const restrictionNote = restrictions.length > 0 
      ? `\n\nIMPORTANT - Access Restrictions:\n${restrictions.join('\n')}\nIf the user asks about restricted data, inform them of these access limitations.\n`
      : '';
    
    const conversationContext = conversationHistory.length > 0
      ? `\n\nConversation History (for context only, cite NEW sources from current data):\n${conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}\n`
      : '';
    
    const systemPrompt = `You are a helpful AI assistant for Netsync Practice Tools. Answer based ONLY on the provided data.

${user ? `User: ${user.name} (${user.role})\nData has been filtered based on user permissions.` : 'Unauthenticated access - limited data available'}${restrictionNote}

Each piece of information has a reference [Source ID|Source Type|Topic|Timestamp|ID:database_id].

CRITICAL SOURCE CITATION RULES:
- ONLY cite a source if you are using information from that EXACT source
- Double-check that the Source ID matches the data you are referencing
- If you cite "Source 439", the information MUST come from the text under [Source 439|...]
- NEVER cite a source number unless you have verified it contains the information you are stating
- When multiple sources contain similar information, cite the SPECIFIC source you used

CRITICAL INSTRUCTIONS:
- When asked to find ALL items matching criteria (e.g., "all projects where X is PM"), you MUST search through EVERY source and list EVERY match
- Do NOT limit results to just a few examples - provide the COMPLETE list
- Count the total matches and state the count clearly
- If there are many matches, list them all systematically

Available information:
${filteredContext}`;
    
    const userPrompt = `${conversationContext}\nQuestion: ${question}\n\nIMPORTANT: If this question asks for ALL items (e.g., "all projects", "show me all", "list all"), you must:
1. Search through EVERY source in the data
2. List EVERY matching item - do not limit to examples
3. Use ULTRA-COMPACT format: ONLY "Project# - Customer [Source#]" - NO extra text, descriptions, or formatting
4. Provide the total count at the end
5. Example format:
200001 - Company A [Source 0]
200002 - Company B [Source 1]
...
Total: X projects

Answer (cite source IDs):`;

    const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 8192,
        messages: [
          { role: 'user', content: systemPrompt },
          { role: 'assistant', content: 'I understand. I will answer questions based only on the provided data and cite sources by ID numbers.' },
          { role: 'user', content: userPrompt }
        ]
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    let answer = responseBody.content[0].text;
    const stopReason = responseBody.stop_reason;

    const sourceMatches = answer.match(/Source \d+/g) || [];
    const citedSourceIds = [...new Set(sourceMatches.map(m => parseInt(m.split(' ')[1])))];
    
    // Use matchingChunks if pre-filtering was applied, otherwise use all chunks
    const sourceChunks = matchingChunks.length > 0 ? matchingChunks : chunksWithMetadata;
    
    const sources = citedSourceIds
      .filter(id => id >= 0 && id < sourceChunks.length)
      .map(id => {
        const chunk = sourceChunks[id];
        if (!chunk) return null;
        return {
          source: chunk.source,
          topic: chunk.topic,
          text: chunk.text,
          url: chunk.url,
          id: chunk.id,
          sourceIndex: id
        };
      })
      .filter(s => s !== null);

    // Check if response was truncated due to token limit - return all sources
    if (stopReason === 'max_tokens' && sourceChunks.length > sources.length) {
      // AI hit token limit and didn't cite all sources - return them all
      const allSources = sourceChunks.map(chunk => ({
        source: chunk.source,
        topic: chunk.topic,
        text: chunk.text,
        url: chunk.url,
        id: chunk.id
      }));
      
      answer = `Found ${allSources.length} matching items.\n\nDue to the large result set, all ${allSources.length} items are listed in the sources below. Click "View all ${allSources.length} citations" to see the complete list with details.`;
      
      if (user) {
        await logAIAccess(user, 'chatnpt_response', { sourcesCount: allSources.length, truncated: true, autoExpanded: true });
      }
      
      return NextResponse.json({ answer, sources: allSources, truncated: true });
    }

    if (user) {
      await logAIAccess(user, 'chatnpt_response', { sourcesCount: sources.length, truncated: stopReason === 'max_tokens' });
    }
    
    return NextResponse.json({ answer, sources, truncated: stopReason === 'max_tokens' });
  } catch (error) {
    console.error('ChatNPT error:', error);
    return NextResponse.json({ error: 'Failed to process question. Please try again.' }, { status: 500 });
  }
}
