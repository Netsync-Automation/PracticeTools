import { NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../lib/dynamodb';
import { getUserFromRequest, logAIAccess } from '../../../lib/ai-user-context';
import { filterDataForUser, sanitizeDataForAI } from '../../../lib/ai-access-control';
import { createOpenSearchClient } from '../../../lib/opensearch-setup.js';

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

async function generateEmbedding(text) {
  const params = {
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text
    })
  };
  
  const command = new InvokeModelCommand(params);
  const result = await bedrockClient.send(command);
  const response = JSON.parse(new TextDecoder().decode(result.body));
  return response.embedding;
}

async function searchDocumentChunks(embedding, tenantId, maxResults) {
  try {
    const opensearchClient = createOpenSearchClient();
    
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Use KNN vector search for semantic similarity
    const searchQuery = {
      size: maxResults,
      query: {
        bool: {
          must: [
            {
              knn: {
                vector: {
                  vector: embedding,
                  k: maxResults
                }
              }
            }
          ],
          filter: [
            {
              term: {
                tenantId: tenantId
              }
            }
          ],
          should: [
            {
              bool: {
                must_not: {
                  exists: {
                    field: 'expirationDate'
                  }
                }
              }
            },
            {
              range: {
                expirationDate: {
                  gte: currentDate
                }
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      _source: ['documentId', 'chunkIndex', 'text', 's3Key', 'tenantId', 'expirationDate']
    };
    
    const response = await opensearchClient.search({
      index: 'document-vectors',
      body: searchQuery
    });
    
    // OpenSearch results now contain auto-generated _id and _source fields
    // The _source contains our logical documentId and chunkIndex for correlation
    return response.body.hits.hits.map(hit => ({
      ...hit._source,
      osDocId: hit._id, // Store the auto-generated OpenSearch document ID
      score: hit._score
    }));
  } catch (error) {
    console.error('Error searching document chunks:', error);
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

    // Generate embedding for semantic search of document chunks
    let documentChunks = [];
    try {
      const questionEmbedding = await generateEmbedding(question);
      documentChunks = await searchDocumentChunks(questionEmbedding, 'documentation', 10);
      console.log(`[CHATNPT DEBUG] Found ${documentChunks.length} document chunks for question: "${question}"`);
      if (documentChunks.length > 0) {
        console.log(`[CHATNPT DEBUG] First chunk preview:`, documentChunks[0].text?.substring(0, 200));
      }
    } catch (error) {
      console.error('Error searching document chunks:', error);
    }

    // Fetch ALL data from environment-specific tables
    const [recordingsResult, messages, docs, issues, assignments, saAssignments, training, saMappings, companies, contacts, users, practiceInfo, releases, practiceETAs, settingsResult] = await Promise.all([
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
      fetchTable('SAAssignmentStatusLog'),
      fetchTable('Settings')
    ]);

    const recordings = recordingsResult.Items || [];
    const settings = settingsResult || [];
    
    // Filter data using same methods as application APIs
    const issuesResult = user ? await filterDataForUser('issues', issues, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    const assignmentsResult = user ? await filterDataForUser('assignments', assignments, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    const saAssignmentsResult = user ? await filterDataForUser('sa_assignments', saAssignments, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    const trainingResult = user ? await filterDataForUser('training_certs', training, user.email) : { filtered: [], restricted: true, reason: 'Authentication required' };
    
    const filteredIssues = issuesResult.filtered;
    const filteredAssignments = assignmentsResult.filtered;
    const filteredSaAssignments = saAssignmentsResult.filtered;
    const filteredTraining = trainingResult.filtered;
    const filteredCompanies = companies; // No filtering - anyone can view
    const filteredContacts = contacts; // No filtering - anyone can view
    
    // Collect restriction info for user feedback
    const restrictions = [];
    if (issuesResult.restricted && issuesResult.reason) restrictions.push(`Issues: ${issuesResult.reason}`);
    if (assignmentsResult.restricted && assignmentsResult.reason) restrictions.push(`Assignments: ${assignmentsResult.reason}`);

    const chunksWithMetadata = [];
    
    // Add new document chunks from RAG system FIRST (highest priority for indexing)
    documentChunks.forEach(chunk => {
      // Find the document name from the Documentation table
      const doc = docs.find(d => d.id === chunk.documentId);
      const documentName = doc?.fileName || chunk.documentId;
      
      chunksWithMetadata.push({
        source: 'Documents',
        topic: `${documentName} - Chunk ${chunk.chunkIndex}`,
        text: chunk.text,
        documentId: chunk.documentId,
        s3Key: chunk.s3Key,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        expirationDate: chunk.expirationDate,
        fileName: documentName
      });
    });
    
    recordings.forEach(rec => {
      const chunks = parseVTTTranscript(rec.transcriptText);
      chunks.forEach(chunk => {
        chunksWithMetadata.push({
          source: 'Webex Recordings',
          topic: rec.topic,
          timestamp: chunk.timestamp,
          text: chunk.text,
          url: `/company-education/webex-recordings`,
          downloadUrl: rec.downloadUrl || rec.s3Url,
          recordingId: rec.id
        });
      });
    });

    messages.forEach(msg => {
      chunksWithMetadata.push({
        source: 'Webex Messages',
        topic: `Message from ${msg.person_email}`,
        text: msg.text,
        url: `/company-education/webex-messages?id=${msg.message_id}`,
        messageId: msg.message_id,
        personEmail: msg.person_email,
        date: msg.created,
        attachments: msg.attachments
      });
      msg.attachments?.forEach(att => {
        if (att.extractedText) {
          chunksWithMetadata.push({
            source: 'Webex Messages',
            topic: `Attachment: ${att.fileName}`,
            text: att.extractedText,
            url: `/company-education/webex-messages?id=${msg.message_id}`,
            messageId: msg.message_id,
            personEmail: msg.person_email,
            date: msg.created,
            attachments: msg.attachments
          });
        }
      });
    });

    // Add legacy documentation (for backward compatibility) - filter out expired documents
    const currentDate = new Date();
    docs.forEach(doc => {
      if (doc.extractedText && doc.extractedText.trim()) {
        // Skip expired documents
        if (doc.expirationDate && new Date(doc.expirationDate) < currentDate) {
          return;
        }
        
        chunksWithMetadata.push({
          source: 'Documentation',
          topic: doc.fileName,
          text: doc.extractedText,
          docId: doc.id,
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
          expirationDate: doc.expirationDate
        });
      }
    });

    // Document chunks already added at the beginning for proper indexing

    filteredIssues.forEach(issue => {
      const sanitized = sanitizeDataForAI('issues', issue);
      chunksWithMetadata.push({
        source: 'Practice Issues',
        topic: `Issue #${sanitized.issue_number}: ${sanitized.title}`,
        text: `Type: ${sanitized.issue_type}\nStatus: ${sanitized.status}\nDescription: ${sanitized.description}\nPractice: ${sanitized.practice || 'N/A'}`,
        url: `/issue/${issue.id}`,
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
        text: `Practice: ${sanitized.practice}\nType: ${sanitized.type}\nVendor: ${sanitized.vendor}\nName: ${sanitized.name}\nLevel: ${sanitized.level || 'N/A'}\nCode: ${sanitized.code || 'N/A'}\nQuantity Needed: ${quantityNeeded}\nTotal Sign-Ups: ${totalSignUps}\nTotal Completed: ${totalCompleted}\nPrerequisites: ${sanitized.prerequisites || 'None'}`,
        url: `/practice-information/training-certs`,
        id: cert.id
      });
    });
    
    saMappings.forEach(mapping => {
      chunksWithMetadata.push({
        source: 'SA to AM Mapping',
        topic: `${mapping.sa_name} supports AM ${mapping.am_name}`,
        text: `SA Support Relationship: ${mapping.sa_name} (${mapping.sa_email}) organizationally supports AM ${mapping.am_name} (${mapping.am_email})\nRegion: ${mapping.region || 'N/A'}\nPractice: ${mapping.practice || 'N/A'}\nNote: This is an organizational support mapping, not an opportunity assignment`,
        url: `/pre-sales/sa-to-am-mapping`,
        id: mapping.id
      });
    });
    
    filteredCompanies.forEach(company => {
      chunksWithMetadata.push({
        source: 'Companies',
        topic: company.name,
        text: `Company: ${company.name}\nTier: ${company.tier}\nTechnology: ${Array.isArray(company.technology) ? company.technology.join(', ') : company.technology}\nWebsite: ${company.website}`,
        url: `/contact-information`,
        id: company.id
      });
    });
    
    filteredContacts.forEach(contact => {
      const company = filteredCompanies.find(c => c.id === contact.company_id);
      const companyName = company?.name || 'Unknown Company';
      chunksWithMetadata.push({
        source: 'Contacts',
        topic: `${contact.name} - ${companyName}`,
        text: `Name: ${contact.name}\nCompany: ${companyName}\nEmail: ${contact.email || 'N/A'}\nRole: ${contact.role || 'N/A'}\nCell Phone: ${contact.cell_phone || 'N/A'}\nOffice Phone: ${contact.office_phone || 'N/A'}\nFax: ${contact.fax || 'N/A'}\nNotes: ${contact.notes || 'N/A'}`,
        url: `/contact-information`,
        id: contact.id
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
    
    // Extract practice board data from Settings table
    const practiceBoards = settings.filter(setting => 
      setting.setting_key && setting.setting_key.includes('practice_board_')
    );
    
    // Helper to strip HTML tags from text
    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    };
    
    let totalCardsIndexed = 0;
    practiceBoards.forEach(board => {
      try {
        const boardData = JSON.parse(board.setting_value);
        const boardName = board.setting_key.replace(/^(dev|prod)_practice_board_/, '').replace(/_/g, ' ');
        const topic = boardData.topic || 'Main Topic';
        
        if (boardData.columns && Array.isArray(boardData.columns)) {
          boardData.columns.forEach(column => {
            if (column.cards && Array.isArray(column.cards)) {
              column.cards.forEach(card => {
                const cleanDescription = stripHtml(card.description);
                const cardUrl = `/practice-information?card=${card.id}`;
                const cardText = [
                  `Board: ${boardName}`,
                  `Topic: ${topic}`,
                  `Column: ${column.title}`,
                  `Card Title: ${card.title}`,
                  cleanDescription ? `Description: ${cleanDescription}` : '',
                  card.assignedTo && card.assignedTo.length > 0 ? `Assigned To: ${card.assignedTo.join(', ')}` : '',
                  card.dueDate ? `Due Date: ${card.dueDate}` : '',
                  card.labels && card.labels.length > 0 ? `Labels: ${card.labels.join(', ')}` : '',
                  card.checklists && card.checklists.length > 0 ? `Checklists: ${card.checklists.map(cl => `${cl.name} (${cl.items.length} items)`).join(', ')}` : '',
                  card.comments && card.comments.length > 0 ? `Comments: ${card.comments.map(c => `${c.author}: ${stripHtml(c.text)}`).join(' | ')}` : ''
                ].filter(Boolean).join('\n');
                
                // Extract practice ID from setting key for proper navigation
                const practiceIdMatch = board.setting_key.match(/^(dev|prod)_practice_board_([^_]+(?:-[^_]+)*?)(?:_.*)?$/);
                const practiceId = practiceIdMatch ? practiceIdMatch[2].split('-').join('-') : board.setting_key;
                
                chunksWithMetadata.push({
                  source: 'Practice Information',
                  topic: `${boardName} - ${topic} - ${column.title} - ${card.title}`,
                  text: cardText,
                  id: card.id,
                  boardId: practiceId,
                  boardTopic: topic
                });
                totalCardsIndexed++;
              });
            }
          });
        }
      } catch (error) {
        console.error('[CHATNPT] Error parsing practice board data:', error);
      }
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
    
    // Use only semantically relevant sources for context
    const relevantChunks = [];
    
    // Always include document chunks first (from semantic search)
    documentChunks.forEach(chunk => {
      const doc = docs.find(d => d.id === chunk.documentId);
      const documentName = doc?.fileName || chunk.documentId;
      relevantChunks.push({
        source: 'Documents',
        topic: `${documentName} - Chunk ${chunk.chunkIndex}`,
        text: chunk.text,
        documentId: chunk.documentId,
        s3Key: chunk.s3Key,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        expirationDate: chunk.expirationDate,
        fileName: documentName
      });
    });
    
    // Add other sources based on semantic relevance scoring
    const questionLower = question.toLowerCase();
    const questionWords = questionLower.split(' ').filter(word => word.length > 2);
    
    const scoredSources = chunksWithMetadata
      .filter(chunk => chunk.source !== 'Documents') // Already added above
      .map(chunk => {
        const textLower = chunk.text?.toLowerCase() || '';
        const topicLower = chunk.topic?.toLowerCase() || '';
        
        // Calculate relevance score based on keyword matches
        let score = 0;
        questionWords.forEach(word => {
          if (topicLower.includes(word)) score += 3; // Topic matches are more important
          if (textLower.includes(word)) score += 1;
        });
        
        // Special handling for specific queries that should include all practice issues
        if (questionLower.includes('issues') || questionLower.includes('problems') || questionLower.includes('bugs')) {
          if (chunk.source === 'Practice Issues') {
            score += 2; // Boost practice issues for issue-related queries
          }
        }
        
        return { chunk, score };
      })
      .filter(item => item.score > 0) // Only include sources with some relevance
      .sort((a, b) => b.score - a.score) // Sort by relevance score
      .map(item => item.chunk);
    
    relevantChunks.push(...scoredSources);
    
    const context = relevantChunks.map((chunk, idx) => {
      const idSuffix = chunk.id ? `|ID:${chunk.id}` : '';
      const sourceRef = `[Source ${idx}|${chunk.source}|${chunk.topic}${chunk.timestamp ? '|' + chunk.timestamp : ''}${idSuffix}]\n${chunk.text}`;
      

      
      return sourceRef;
    }).join('\n\n');
    
    // sourceChunks will be set later after matchingChunks is populated

    // Use AI to detect list queries and extract filter criteria
    const intentPrompt = `Analyze this question and determine if it's asking for a LIST of ALL items matching specific criteria.

Question: "${question}"

Available data sources:
- Resource Assignments (fields: pm, resourceAssigned, practice, status, region)
- SA Assignments (fields: customer, saAssigned, am, isr, practice, status, region)
- Contacts (fields: company)
- SA to AM Mapping (fields: saName, amName, region, practice)
- Training Certifications (fields: practice)
- Practice Issues (fields: practice, status, issue_type)
- Webex Recordings (fields: topic)
- Webex Messages (fields: person_email)
- Documentation (fields: fileName)
- Documents (fields: documentId, s3Key)
- Practice ETAs (fields: practice, transition)

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "isListQuery": true/false,
  "dataSource": "Resource Assignments" | "SA Assignments" | "Contacts" | "SA to AM Mapping" | "Training Certifications" | "Practice Issues" | "Webex Recordings" | "Webex Messages" | "Documentation" | "Documents" | "Practice ETAs" | null,
  "filterField": "pm" | "resourceAssigned" | "customer" | "saAssigned" | "am" | "isr" | "practice" | "status" | "region" | "company" | "issue_type" | "topic" | "person_email" | "fileName" | "documentId" | "s3Key" | "transition" | "saName" | "amName" | null,
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
        'saName': 'sa support relationship:',
        'amName': 'organizationally supports am',
        'topic': null,
        'person_email': null,
        'fileName': null,
        'documentId': null,
        's3Key': null
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
        'fileName': 'file name',
        'documentId': 'document ID',
        's3Key': 'document path'
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
        'Documents': 'document chunks',
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
        id: chunk.id,
        boardId: chunk.boardId,
        boardTopic: chunk.boardTopic,
        downloadUrl: chunk.downloadUrl,
        recordingId: chunk.recordingId,
        messageId: chunk.messageId,
        personEmail: chunk.personEmail,
        date: chunk.date,
        attachments: chunk.attachments,
        docId: chunk.docId,
        uploadedBy: chunk.uploadedBy,
        uploadedAt: chunk.uploadedAt,
        documentId: chunk.documentId,
        s3Key: chunk.s3Key,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        expirationDate: chunk.expirationDate,
        fileName: chunk.fileName
      }));
      
      if (user) {
        await logAIAccess(user, 'chatnpt_response', { sourcesCount: sources.length, preFiltered: true });
      }
      
      const responseData = { answer, sources };
      const jsonString = JSON.stringify(responseData);
      return new Response(jsonString, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
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

CRITICAL DATA SOURCE DISTINCTIONS:
- "SA to AM Mapping" sources show ORGANIZATIONAL SUPPORT relationships (which AMs an SA supports)
- "SA Assignments" sources show OPPORTUNITY ASSIGNMENTS (which specific opportunities/customers an SA is assigned to)
- "Documentation" sources show legacy uploaded documents with full text extraction
- "Documents" sources show semantically relevant chunks from documents processed by the RAG system
- When asked "which AMs does [SA] support?" or "who does [SA] support?", use ONLY "SA to AM Mapping" sources
- When asked "which opportunities is [SA] assigned to?" or "what projects is [SA] working on?", use ONLY "SA Assignments" sources
- For document-related questions, prioritize "Documents" sources as they contain more relevant, chunked content

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
    
    console.log(`[DEBUG] AI cited sources: ${citedSourceIds.join(', ')}`);
    console.log(`[DEBUG] Total sources available: ${chunksWithMetadata.length}`);
    
    // Use matchingChunks if pre-filtering was applied, otherwise use relevant chunks
    const sourceChunks = matchingChunks.length > 0 ? matchingChunks : relevantChunks;
    

    
    const sources = citedSourceIds
      .filter(id => id >= 0 && id < sourceChunks.length)
      .map(id => {
        const chunk = sourceChunks[id];
        if (!chunk) return null;
        const sourceObj = {
          source: chunk.source,
          topic: chunk.topic,
          text: chunk.text,
          url: chunk.url,
          id: chunk.id,
          boardId: chunk.boardId,
          boardTopic: chunk.boardTopic,
          downloadUrl: chunk.downloadUrl,
          recordingId: chunk.recordingId,
          messageId: chunk.messageId,
          personEmail: chunk.personEmail,
          date: chunk.date,
          attachments: chunk.attachments,
          docId: chunk.docId,
          uploadedBy: chunk.uploadedBy,
          uploadedAt: chunk.uploadedAt,
          documentId: chunk.documentId,
          s3Key: chunk.s3Key,
          chunkIndex: chunk.chunkIndex,
          score: chunk.score,
          expirationDate: chunk.expirationDate,
          fileName: chunk.fileName,
          sourceIndex: id
        };
        if (chunk.url) {
          console.log(`[CHATNPT] Returning source with URL - Source: ${chunk.source}, URL: ${chunk.url}`);
        }
        return sourceObj;
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
        id: chunk.id,
        boardId: chunk.boardId,
        boardTopic: chunk.boardTopic,
        downloadUrl: chunk.downloadUrl,
        recordingId: chunk.recordingId,
        messageId: chunk.messageId,
        personEmail: chunk.personEmail,
        date: chunk.date,
        attachments: chunk.attachments,
        docId: chunk.docId,
        uploadedBy: chunk.uploadedBy,
        uploadedAt: chunk.uploadedAt,
        documentId: chunk.documentId,
        s3Key: chunk.s3Key,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        expirationDate: chunk.expirationDate,
        fileName: chunk.fileName
      }));
      
      answer = `Found ${allSources.length} matching items.\n\nDue to the large result set, all ${allSources.length} items are listed in the sources below. Click "View all ${allSources.length} citations" to see the complete list with details.`;
      
      if (user) {
        await logAIAccess(user, 'chatnpt_response', { sourcesCount: allSources.length, truncated: true, autoExpanded: true });
      }
      
      const responseData = { answer, sources: allSources, truncated: true };
      const jsonString = JSON.stringify(responseData);
      return new Response(jsonString, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (user) {
      await logAIAccess(user, 'chatnpt_response', { sourcesCount: sources.length, truncated: stopReason === 'max_tokens' });
    }
    
    const responseData = { answer, sources, truncated: stopReason === 'max_tokens' };
    const jsonString = JSON.stringify(responseData);
    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('ChatNPT error:', error);
    return NextResponse.json({ error: 'Failed to process question. Please try again.' }, { status: 500 });
  }
}
