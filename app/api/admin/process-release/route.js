import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';


export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    // Debug environment variable detection
    console.log('🔍 Environment Variable Debug:');
    console.log('  process.env.ENVIRONMENT:', process.env.ENVIRONMENT);
    console.log('  process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('  All env vars containing "ENV":', Object.keys(process.env).filter(key => key.includes('ENV')).map(key => `${key}=${process.env[key]}`));
    
    // Use ENVIRONMENT variable as single source of truth from apprunner.yaml
    const environment = process.env.ENVIRONMENT || 'dev';
    
    console.log(`🌍 Using ENVIRONMENT variable: '${environment}'`);
    console.log(`✅ Processing release for ${environment} environment`);
    console.log(`Using database tables: PracticeTools-${environment}-*`);
    
    // Debug API key authentication
    const authHeader = request.headers.get('authorization');
    const expectedApiKey = process.env.ADMIN_API_KEY;
    console.log('🔑 API Key Debug:');
    console.log('  Auth header present:', !!authHeader);
    console.log('  Expected API key (first 10 chars):', expectedApiKey?.substring(0, 10) + '...');
    
    if (authHeader?.startsWith('Bearer ')) {
      const providedApiKey = authHeader.substring(7);
      console.log('  Provided API key (first 10 chars):', providedApiKey?.substring(0, 10) + '...');
      console.log('  API keys match:', providedApiKey === expectedApiKey);
    }
    
    // Authentication check (moved after debugging)
    
    // Check for API key authentication (from GitHub Actions)
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      if (apiKey !== process.env.ADMIN_API_KEY) {
        console.error('❌ API key authentication failed');
        return NextResponse.json({ 
          error: 'Invalid API key',
          debug: {
            environment,
            expectedKeyPrefix: process.env.ADMIN_API_KEY?.substring(0, 10) + '...',
            providedKeyPrefix: apiKey?.substring(0, 10) + '...'
          }
        }, { status: 401 });
      }
      console.log('✅ API key authentication successful');
    } else {
      // Check for user session authentication
      const userCookie = request.cookies.get('user-session');
      const validation = await validateUserSession(userCookie);
      
      if (!validation.valid || !validation.user.isAdmin) {
        console.error('❌ Session authentication failed');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('✅ Session authentication successful');
    }

    const { version, notes, type, date } = await request.json();
    
    if (!version || !notes) {
      return NextResponse.json({ error: 'Version and notes required' }, { status: 400 });
    }

    // Save release to database
    const release = {
      version,
      date: date || new Date().toISOString().split('T')[0],
      type: type || 'Release',
      notes,
      helpContent: generateHelpContent(notes),
      changes: parseChangesFromNotes(notes)
    };

    console.log(`Saving release ${version} to ${environment} database`);
    await db.saveRelease(release);
    
    // Update current version setting
    await db.saveSetting('current_version', version);
    
    console.log(`Release ${version} saved successfully to ${environment} environment`);
    return NextResponse.json({ 
      success: true, 
      message: `Release ${version} processed successfully in ${environment} environment` 
    });
    
  } catch (error) {
    console.error('Error processing release:', error);
    return NextResponse.json({ error: 'Failed to process release' }, { status: 500 });
  }
}

function parseChangesFromNotes(notes) {
  const changes = { added: 0, modified: 0, removed: 0 };
  
  if (notes.includes('## 🆕') || notes.includes('New Features')) changes.added++;
  if (notes.includes('## 🔧') || notes.includes('Improvements')) changes.modified++;
  if (notes.includes('## ⚠️') || notes.includes('Breaking Changes')) changes.removed++;
  
  return changes;
}

function generateHelpContent(notes) {
  // Extract features from release notes for help system
  const lines = notes.split('\n');
  const helpSections = [];
  
  lines.forEach(line => {
    if (line.startsWith('- **') && line.includes('**:')) {
      const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
      if (match) {
        helpSections.push({
          title: match[1],
          description: match[2]
        });
      }
    }
  });
  
  return helpSections.map(section => 
    `### ${section.title}\n${section.description}\n`
  ).join('\n');
}