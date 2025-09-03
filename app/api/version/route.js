import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use ENVIRONMENT variable as single source of truth from apprunner.yaml
    const environment = process.env.ENVIRONMENT || 'dev';
    
    console.log('Version API called - ENVIRONMENT:', environment);
    console.log('Database table:', `PracticeTools-${environment}-Releases`);
    
    // First try to get current version from settings (faster)
    try {
      const currentVersionSetting = await db.getSetting('current_version');
      if (currentVersionSetting) {
        console.log('Found current_version setting:', currentVersionSetting);
        // Verify it matches the environment
        if ((environment === 'dev' && currentVersionSetting.includes('-dev.')) ||
            (environment === 'prod' && !currentVersionSetting.includes('-dev.'))) {
          return NextResponse.json({ version: currentVersionSetting });
        }
      }
    } catch (error) {
      console.log('No current_version setting found, checking releases table');
    }
    
    // Fallback to releases table
    const releases = await db.getReleases();
    console.log('Releases found:', releases ? releases.length : 0);
    
    if (releases && releases.length > 0) {
      console.log('All releases found:', releases.length);
      
      // Filter releases by environment
      const envReleases = releases.filter(release => {
        if (environment === 'prod') {
          return !release.version.includes('-dev.');
        } else {
          return release.version.includes('-dev.');
        }
      });
      
      console.log(`${environment} releases found:`, envReleases.length);
      console.log('Latest releases:', envReleases.slice(0, 3).map(r => ({ version: r.version, date: r.date })));
      
      // Get all versions (corrected or original) and sort them
      const allVersions = envReleases.map(release => {
        const displayVersion = release.corrected_version || release.version;
        return {
          version: displayVersion,
          release: release
        };
      });
      
      const latestVersionObj = allVersions.sort((a, b) => {
        const parseVersion = (version) => {
          const parts = version.split('.').map(Number);
          return {
            major: parts[0] || 0,
            minor: parts[1] || 0,
            patch: parts[2] || 0
          };
        };
        
        const versionA = parseVersion(a.version);
        const versionB = parseVersion(b.version);
        
        if (versionB.major !== versionA.major) return versionB.major - versionA.major;
        if (versionB.minor !== versionA.minor) return versionB.minor - versionA.minor;
        return versionB.patch - versionA.patch;
      })[0];
      
      const currentVersion = latestVersionObj.version;
      
      // Cache in settings for faster access
      await db.saveSetting('current_version', currentVersion);
      return NextResponse.json({ version: currentVersion });
    }
    
    return NextResponse.json({ version: '1.0.0' });
  } catch (error) {
    console.error('Error in version API:', error);
    return NextResponse.json({ version: '1.0.0' });
  }
}