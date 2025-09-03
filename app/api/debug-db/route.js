import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('=== DATABASE DEBUG START ===');
    
    // Test basic database connection
    console.log('Testing database connection...');
    
    // Check if releases table exists and what's in it
    console.log('Checking releases table...');
    let releases = [];
    try {
      releases = await db.getReleases();
      console.log('getReleases() returned:', releases);
    } catch (error) {
      console.error('getReleases() error:', error);
    }
    
    // Try to create a test release
    console.log('Creating test release...');
    const testRelease = {
      version: '0.1.1-test',
      date: '2025-08-22',
      type: 'Test Release',
      features: ['Test feature'],
      improvements: ['Test improvement'],
      bugFixes: ['Test fix'],
      breaking: [],
      timestamp: Date.now()
    };
    
    let saveResult = null;
    try {
      saveResult = await db.saveRelease(testRelease);
      console.log('saveRelease() result:', saveResult);
    } catch (error) {
      console.error('saveRelease() error:', error);
    }
    
    // Try to read releases again
    console.log('Reading releases after save...');
    let releasesAfterSave = [];
    try {
      releasesAfterSave = await db.getReleases();
      console.log('getReleases() after save:', releasesAfterSave);
    } catch (error) {
      console.error('getReleases() after save error:', error);
    }
    
    // Check DynamoDB client configuration
    console.log('DynamoDB client config:', {
      region: process.env.AWS_DEFAULT_REGION,
      hasCredentials: !!process.env.AWS_ACCESS_KEY_ID || 'using IAM role'
    });
    
    console.log('=== DATABASE DEBUG END ===');
    
    return NextResponse.json({
      success: true,
      debug: {
        initialReleases: releases,
        testReleaseSaved: !!saveResult,
        releasesAfterSave: releasesAfterSave,
        releasesCount: releasesAfterSave.length,
        region: process.env.AWS_DEFAULT_REGION
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}