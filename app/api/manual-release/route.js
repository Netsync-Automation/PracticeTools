import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🚀 Manual release creation triggered');
    
    // Get current version
    const releases = await db.getReleases();
    let currentVersion = '1.0.0';
    
    if (releases && releases.length > 0) {
      const latest = releases.sort((a, b) => {
        const parseVersion = (version) => {
          const parts = version.split('.').map(Number);
          return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
        };
        const versionA = parseVersion(a.version);
        const versionB = parseVersion(b.version);
        if (versionB.major !== versionA.major) return versionB.major - versionA.major;
        if (versionB.minor !== versionA.minor) return versionB.minor - versionA.minor;
        return versionB.patch - versionA.patch;
      })[0];
      currentVersion = latest.version;
    }
    
    // Increment version
    const parts = currentVersion.split('.').map(Number);
    const newVersion = `${parts[0]}.${parts[1]}.${(parts[2] || 0) + 1}`;
    
    // Create release
    const releaseData = {
      version: newVersion,
      date: new Date().toISOString().split('T')[0],
      type: 'Manual Release',
      features: [],
      improvements: ['Manual release created'],
      bugFixes: [],
      breaking: []
    };
    
    await db.saveRelease(releaseData);
    console.log(`✅ Manual release ${newVersion} created successfully`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Release ${newVersion} created successfully`,
      version: newVersion,
      releaseData
    });
  } catch (error) {
    console.error('❌ Error creating manual release:', error);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}