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
    const [recordingsResult, messages, docs, issues, assignments, saAssignments, training, saMappings, companies, contacts, users, practiceInfo, releases, practiceETAs] = await Promise.all([
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
      fetchTable('Releases'),
      fetchTable('SAAssignmentStatusLog')
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
        text: `Practice: ${sanitized.practice}\nStatus: ${sanitized.status}\nProject: ${sanitized.projectNumber}\nDescription: ${sanitized.projectDescription}\nRegion: ${sanitized.region}\nPM: ${sanitized.pm || 'N/A'}\nResource: ${sanitized.resourceAssigned || 'N/A'}\nETA: ${assignment.eta || 'N/A'}`,
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
    
    // Calculate Practice ETAs from status log (same as frontend)
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
    const recentStatusChanges = practiceETAs.filter(log => new Date(log.changed_at) >= twentyOneDaysAgo);
    
    const practiceETAMap = new Map();
    const practices = [...new Set(recentStatusChanges.map(sc => sc.practice).filter(p => p && p !== 'Pending'))];
    
    for (const practice of practices) {
      const transitions = {
        'pending_to_unassigned': { from: 'Pending', to: 'Unassigned', label: 'Practice Assignment' },
        'unassigned_to_assigned': { from: 'Unassigned', to: 'Assigned', label: 'Resource Assignment' },
        'assigned_to_pending_approval': { from: 'Assigned', to: 'Pending Approval', label: 'Management Approvals' },
        'assigned_to_completed': { from: 'Assigned', to: 'Complete', label: 'SA Completion' }
      };
      
      for (const [transitionKey, transition] of Object.entries(transitions)) {
        const matchingChanges = recentStatusChanges.filter(sc => 
          sc.practice === practice && sc.from_status === transition.from && sc.to_status === transition.to
        );
        
        if (matchingChanges.length > 0) {
          const durations = [];
          for (const change of matchingChanges) {
            const assignment = saAssignments.find(a => a.id === change.assignment_id);
            if (assignment?.created_at) {
              const createdDate = new Date(assignment.created_at);
              const changedDate = new Date(change.changed_at);
              const hours = (changedDate - createdDate) / (1000 * 60 * 60);
              if (hours > 0) durations.push(hours);
            }
          }
          
          if (durations.length > 0) {
            const avgHours = durations.reduce((sum, h) => sum + h, 0) / durations.length;
            const avgDays = Math.round((avgHours / 24) * 100) / 100;
            practiceETAMap.set(`${practice}_${transitionKey}`, {
              practice,
              transition: transition.label,
              avgDays,
              sampleSize: durations.length
            });
          }
        }
      }
    }
    
    practiceETAMap.forEach(eta => {
      chunksWithMetadata.push({
        source: 'Practice ETAs',
        topic: `${eta.practice} - ${eta.transition}`,
        text: `Practice: ${eta.practice}\nTransition: ${eta.transition}\nAverage ETA: ${eta.avgDays} days\nSample Size: ${eta.sampleSize} assignments (last 21 days)`
      });
    });
    
    const context = chunksWithMetadata.map((chunk, idx) => {
      const idSuffix = chunk.id ? `|ID:${chunk.id}` : '';
      return `[Source ${idx}|${chunk.source}|${chunk.topic}${chunk.timestamp ? '|' + chunk.timestamp : ''}${idSuffix}]\n${chunk.text}`;
    }).join('\n\n');

    // Use AI to detect list queries and extract filter criteria
    const intentPrompt = `Analyze this question and determine if it's asking for a LIST of ALL items matching specific criteria.

Question: "${question}"

Available data sources:
- Resource Assignments (fields: pm, resourceAssigned, practice, status, region)
- SA Assignments (fields: customer, saAssigned, am, isr, practice, status, region)
- Contacts (fields: company)
- SA to AM Mapping (fields: region, practice)
- Training Certifications (fields: practice)
- Practice Issues (fields: practice, status, issue_type)
- Webex Recordings (fields: topic)
- Webex Messages (fields: person_email)
- Documentation (fields: fileName)
- Practice ETAs (fields: practice, transition)

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "isListQuery": true/false,
  "dataSource": "Resource Assignments" | "SA Assignments" | "Contacts" | "SA to AM Mapping" | "Training Certifications" | "Practice Issues" | "Webex Recordings" | "Webex Messages" | "Documentation" | "Practice ETAs" | null,
  "filterField": "pm" | "resourceAssigned" | "customer" | "saAssigned" | "am" | "isr" | "practice" | "status" | "region" | "company" | "issue_type" | "topic" | "person_email" | "fileName" | "transition" | null,
  "filterValue": "extracted name/value" | null
}`;

    const intentResponse = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 200,
        messages: [{ role: 'user', content: intentPrompt }]
      })
    }));

    const intentBody = JSON.parse(new TextDecoder().decode(intentResponse.body));
    const intentText = intentBody.content[0].text.trim();
    let intent;
    try {
      intent = JSON.parse(intentText);
    } catch (e) {
      intent = { isListQuery: false };
    }

    let matchingChunks = [];
    
    // Apply AI-detected filters
    if (intent.isListQuery && intent.dataSource && intent.filterField && intent.filterValue) {
      const filterValue = intent.filterValue.toLowerCase();
      const fieldMap = {
        'pm': 'pm:',
        'resourceAssigned': 'resource:',
        'customer': 'customer:',
        'saAssigned': 'sa assigned:',
        'am': 'am:',
        'isr': 'isr:',
        'practice': 'practice:',
        'status': 'status:',
        'region': 'region:',
        'company': 'company:',
        'issue_type': 'type:',
        'transition': 'transition:',
        'topic': null,
        'person_email': null,
        'fileName': null
      };
      
      const fieldPrefix = fieldMap[intent.filterField];
      matchingChunks = chunksWithMetadata.filter(chunk => 
        chunk.source === intent.dataSource &&
        chunk.text &&
        (!fieldPrefix || chunk.text.toLowerCase().includes(fieldPrefix)) &&
        chunk.text.toLowerCase().includes(filterValue)
      );
    }
    
    // Apply pre-filtering if matches found - return directly without AI
    if (matchingChunks.length > 0) {
      const fieldLabels = {
        'pm': 'Project Manager',
        'resourceAssigned': 'assigned resource',
        'customer': 'customer',
        'saAssigned': 'Solution Architect',
        'am': 'Account Manager',
        'isr': 'ISR',
        'practice': 'practice',
        'status': 'status',
        'region': 'region',
        'company': 'company',
        'issue_type': 'issue type',
        'transition': 'transition type',
        'topic': 'topic',
        'person_email': 'sender',
        'fileName': 'file name'
      };
      
      const description = `where ${fieldLabels[intent.filterField] || intent.filterField} is ${intent.filterValue}`;
      const sourceTypeMap = {
        'Contacts': 'contacts',
        'SA to AM Mapping': 'SA to AM mappings',
        'Training Certifications': 'training certifications',
        'Practice Issues': 'issues',
        'Webex Recordings': 'recordings',
        'Webex Messages': 'messages',
        'Documentation': 'documents',
        'SA Assignments': 'opportunities',
        'Resource Assignments': 'projects',
        'Practice ETAs': 'ETA metrics'
      };
      const itemType = sourceTypeMap[matchingChunks[0].source] || 'items';
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

    let filteredContext = context;
    
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
