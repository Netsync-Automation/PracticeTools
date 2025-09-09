import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[RELEASES-API-DEBUG] === ENVIRONMENT DETECTION ===');
    console.log('[RELEASES-API-DEBUG] process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('[RELEASES-API-DEBUG] process.env.ENVIRONMENT:', process.env.ENVIRONMENT);
    console.log('[RELEASES-API-DEBUG] All env vars starting with NODE_:', Object.keys(process.env).filter(k => k.startsWith('NODE_')));
    console.log('[RELEASES-API-DEBUG] All env vars starting with ENV:', Object.keys(process.env).filter(k => k.includes('ENV')));
    
    // Use ENVIRONMENT variable as single source of truth from apprunner.yaml
    const environment = process.env.ENVIRONMENT || 'dev';
    console.log('[RELEASES-API-DEBUG] Detected environment:', environment);
    console.log('[RELEASES-API-DEBUG] Expected database table:', `PracticeTools-${environment}-Releases`);
    
    // Force environment detection in database layer
    console.log('[RELEASES-API-DEBUG] Calling db.getReleases with environment:', environment);

    
    // Always return an array, even if empty
    if (!releases || releases.length === 0) {
      console.log('[RELEASES-API-DEBUG] No releases found - checking both environments');
      try {
        const prodReleases = await db.getReleases('prod');
        const devReleases = await db.getReleases('dev');
        console.log('[RELEASES-API-DEBUG] Prod releases available:', prodReleases ? prodReleases.length : 0);
        console.log('[RELEASES-API-DEBUG] Dev releases available:', devReleases ? devReleases.length : 0);
      } catch (debugError) {
        console.log('[RELEASES-API-DEBUG] Debug query failed:', debugError.message);
      }
      console.log('[RELEASES-API] Returning empty array');
      return NextResponse.json([]);
    }
    
    // Filter releases by environment (same logic as version API)
    const envReleases = releases.filter(release => {
      if (environment === 'prod') {
        return !release.version.includes('-dev.');
      } else {
        return release.version.includes('-dev.');
      }
    });
    
    console.log(`[RELEASES-API] ${environment} releases found:`, envReleases.length);
    console.log('[RELEASES-API] Sample filtered releases:', envReleases.slice(0, 2).map(r => ({ 
      version: r.version, 
      date: r.date, 
      type: r.type,
      notes: r.notes ? r.notes.substring(0, 50) + '...' : 'No notes'
    })));
    
    // Sort releases by version (newest first)
    const sortedReleases = envReleases.sort((a, b) => {
      return compareVersions(b.version, a.version);
    });
    
    console.log('[RELEASES-API] Returning releases:', sortedReleases.length);
    console.log('[RELEASES-API] Latest releases:', sortedReleases.slice(0, 3).map(r => ({ version: r.version, date: r.date })));

    return NextResponse.json(sortedReleases);
  } catch (error) {
    console.error('[RELEASES-API] Error fetching releases:', error);
    console.error('[RELEASES-API] Error stack:', error.stack);
    // Always return an empty array instead of error object to prevent frontend crashes
    console.log('[RELEASES-API] Returning empty array due to error');
    return NextResponse.json([]);
  }
}

function compareVersions(a, b) {
  const parseVersion = (v) => {
    const [base, dev] = v.split('-dev.');
    const [major, minor, patch] = base.split('.').map(Number);
    return { major, minor, patch, dev: dev ? parseInt(dev) : null };
  };
  
  const vA = parseVersion(a);
  const vB = parseVersion(b);
  
  if (vA.major !== vB.major) return vA.major - vB.major;
  if (vA.minor !== vB.minor) return vA.minor - vB.minor;
  if (vA.patch !== vB.patch) return vA.patch - vB.patch;
  
  if (vA.dev === null && vB.dev === null) return 0;
  if (vA.dev === null) return 1;
  if (vB.dev === null) return -1;
  
  return vA.dev - vB.dev;
}