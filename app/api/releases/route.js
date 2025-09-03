import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export async function GET() {
  try {
    // Use ENVIRONMENT variable as single source of truth from apprunner.yaml
    const environment = process.env.ENVIRONMENT || 'dev';
    console.log('Releases API called - ENVIRONMENT:', environment);
    console.log('Database table:', `PracticeTools-${environment}-Releases`);
    
    const releases = await db.getReleases(environment);
    console.log('Releases found:', releases ? releases.length : 0);
    

    
    // Sort releases by version (newest first)
    const sortedReleases = releases.sort((a, b) => {
      return compareVersions(b.version, a.version);
    });
    
    console.log('Returning releases:', sortedReleases.length);
    console.log('Latest releases:', sortedReleases.slice(0, 3).map(r => ({ version: r.version, date: r.date })));

    return NextResponse.json(sortedReleases);
  } catch (error) {
    console.error('Error fetching releases:', error);
    return NextResponse.json({ error: 'Failed to fetch releases' }, { status: 500 });
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