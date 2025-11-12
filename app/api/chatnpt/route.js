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
        text: `Type: ${sanitized.issue_type}\nStatus: ${sanitized.status}\nDescription: ${sanitized.description}\nPractice: ${sanitized.practice || 'N/A'}`
      });
    });
    
    filteredAssignments.forEach(assignment => {
      const sanitized = sanitizeDataForAI('assignments', assignment);
      chunksWithMetadata.push({
        source: 'Resource Assignments',
        topic: `Assignment #${sanitized.assignment_number}: ${sanitized.customerName}`,
        text: `Practice: ${sanitized.practice}\nStatus: ${sanitized.status}\nProject: ${sanitized.projectNumber}\nDescription: ${sanitized.projectDescription}\nRegion: ${sanitized.region}`
      });
    });
    
    filteredSaAssignments.forEach(assignment => {
      const sanitized = sanitizeDataForAI('assignments', assignment);
      chunksWithMetadata.push({
        source: 'SA Assignments',
        topic: `SA Assignment #${sanitized.assignment_number}`,
        text: `Practice: ${sanitized.practice}\nStatus: ${sanitized.status}\nProject: ${sanitized.projectNumber}\nDescription: ${sanitized.projectDescription || sanitized.notes}`
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
    
    const context = chunksWithMetadata.map((chunk, idx) => 
      `[Source ${idx}|${chunk.source}|${chunk.topic}${chunk.timestamp ? '|' + chunk.timestamp : ''}]\n${chunk.text}`
    ).join('\n\n');

    const restrictionNote = restrictions.length > 0 
      ? `\n\nIMPORTANT - Access Restrictions:\n${restrictions.join('\n')}\nIf the user asks about restricted data, inform them of these access limitations.\n`
      : '';
    
    const conversationContext = conversationHistory.length > 0
      ? `\n\nConversation History (for context only, cite NEW sources from current data):\n${conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}\n`
      : '';
    
    const systemPrompt = `You are a helpful AI assistant for Netsync Practice Tools. Answer based ONLY on the provided data.

${user ? `User: ${user.name} (${user.role})\nData has been filtered based on user permissions.` : 'Unauthenticated access - limited data available'}${restrictionNote}
Each piece of information has a reference [Source ID|Source Type|Topic|Timestamp].
Cite sources by ID numbers.

Available information:
${context}`;

    const userPrompt = `${conversationContext}\nQuestion: ${question}\n\nAnswer (cite source IDs):`;

    const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: systemPrompt },
          { role: 'assistant', content: 'I understand. I will answer questions based only on the provided data and cite sources by ID numbers.' },
          { role: 'user', content: userPrompt }
        ]
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const answer = responseBody.content[0].text;

    const sourceMatches = answer.match(/Source \d+/g) || [];
    const citedSourceIds = [...new Set(sourceMatches.map(m => parseInt(m.split(' ')[1])))];
    
    const sources = citedSourceIds
      .filter(id => id < chunksWithMetadata.length)
      .map(id => ({
        source: chunksWithMetadata[id].source,
        topic: chunksWithMetadata[id].topic,
        text: chunksWithMetadata[id].text
      }));

    if (user) {
      await logAIAccess(user, 'chatnpt_response', { sourcesCount: sources.length });
    }
    
    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error('ChatNPT error:', error);
    return NextResponse.json({ error: 'Failed to process question. Please try again.' }, { status: 500 });
  }
}
