import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { pipeline } from '@xenova/transformers';

// Global model instance for reuse
let embeddingModel = null;

// Initialize the ML model
async function getEmbeddingModel() {
  if (!embeddingModel) {
    console.log('Loading ML embedding model...');
    embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('ML embedding model loaded successfully');
  }
  return embeddingModel;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) || 0;
}

// Get semantic embedding for text
async function getEmbedding(text) {
  const model = await getEmbeddingModel();
  const result = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

export async function POST(request) {
  try {
    const { title, description } = await request.json();
    
    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description required' }, { status: 400 });
    }
    
    console.log('Starting ML-based duplicate detection...');
    
    const allIssues = await db.getAllIssues().then(issues => 
      issues.filter(issue => issue.status !== 'Closed')
    );
    
    if (allIssues.length === 0) {
      return NextResponse.json({ similarIssues: [] });
    }
    
    // Get embedding for new issue
    const newIssueText = `${title} ${description}`;
    const newEmbedding = await getEmbedding(newIssueText);
    
    console.log(`Comparing against ${allIssues.length} existing issues...`);
    
    // Calculate similarities with existing issues
    const similarities = await Promise.all(
      allIssues.map(async (issue) => {
        const existingText = `${issue.title} ${issue.description}`;
        const existingEmbedding = await getEmbedding(existingText);
        const similarity = cosineSimilarity(newEmbedding, existingEmbedding);
        
        return {
          issue,
          similarity
        };
      })
    );
    
    const similarIssues = similarities
      .filter(item => item.similarity > 0.7) // Higher threshold for ML (70%)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(item => ({ ...item.issue, similarity: item.similarity }));
    
    console.log(`Found ${similarIssues.length} similar issues with ML detection`);
    
    return NextResponse.json({ similarIssues });
  } catch (error) {
    console.error('ML duplicate check error:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}