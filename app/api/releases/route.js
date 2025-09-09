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
    console.log('[RELEASES-API-DEBUG] Database table:', `PracticeTools-${environment}-Releases`);
    
    const releases = await db.getReleases(environment);
    console.log('[RELEASES-API] Raw releases from DB:', releases ? releases.length : 0);
    
    if (!releases) {
      console.log('[RELEASES-API] No releases returned from database');
      return NextResponse.json([]);
    }
    
    if (releases.length === 0) {
      console.log('[RELEASES-API] Empty releases array from database');
      return NextResponse.json([]);
    }
    
    console.log('[RELEASES-API] Sample releases:', releases.slice(0, 2).map(r => ({ 
      version: r.version, 
      date: r.date, 
      type: r.type,
      notes: r.notes ? r.notes.substring(0, 50) + '...' : 'No notes'
    })));
    
    // Sort releases by version (newest first)
    const sortedReleases = releases.sort((a, b) => {
      return compareVersions(b.version, a.version);
    });
    
    console.log('[RELEASES-API] Returning releases:', sortedReleases.length);
    console.log('[RELEASES-API] Latest releases:', sortedReleases.slice(0, 3).map(r => ({ version: r.version, date: r.date })));

    return NextResponse.json(sortedReleases);
  } catch (error) {
    console.error('[RELEASES-API] Error fetching releases:', error);
    console.error('[RELEASES-API] Error stack:', error.stack);
    return NextResponse.json({ error: 'Failed to fetch releases', details: error.message }, { status: 500 });
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