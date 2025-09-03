import { NextResponse } from 'next/server';
import { FeatureVersioning } from '../../../lib/auto-versioning.js';
import { validateUserSession } from '../../../lib/auth-check';

export async function POST(request) {
  try {
    console.log('\n🚀 === AUTO-RELEASE API CALLED ===');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    
    const userCookie = request.cookies.get('user-session');
    console.log('🔐 Validating user session...');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      console.log('❌ Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authorized:', validation.user.email);

    const changes = await request.json();
    console.log('📋 Changes received:', JSON.stringify(changes, null, 2));
    
    if (!changes.features && !changes.improvements && !changes.bugFixes) {
      console.log('❌ No changes provided');
      return NextResponse.json({ error: 'At least one change type required' }, { status: 400 });
    }

    console.log('🔄 Creating release...');
    const release = await FeatureVersioning.processDeployment();
    console.log('📦 Release created:', JSON.stringify(release, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      release,
      message: `Release ${release.version} created successfully`
    });
  } catch (error) {
    console.error('💥 Auto-release error:', error);
    console.error('📍 Error stack:', error.stack);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const currentVersion = await FeatureVersioning.getCurrentVersion();
    return NextResponse.json({ currentVersion });
  } catch (error) {
    console.error('Error getting current version:', error);
    return NextResponse.json({ error: 'Failed to get version' }, { status: 500 });
  }
}