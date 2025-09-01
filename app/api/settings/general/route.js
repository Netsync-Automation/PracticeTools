import { NextResponse } from 'next/server';
import { db } from '../../../../lib/database.js';

export async function GET() {
  try {
    const appName = await db.getSetting('app_name') || 'Practice Tools';
    const appDescription = await db.getSetting('app_description') || 'Development Platform';
    
    return NextResponse.json({
      appName,
      appDescription
    });
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json({
      appName: 'Practice Tools',
      appDescription: 'Development Platform'
    });
  }
}

export async function POST(request) {
  try {
    const { appName, appDescription } = await request.json();
    
    if (appName) {
      await db.saveSetting('app_name', appName);
    }
    
    if (appDescription) {
      await db.saveSetting('app_description', appDescription);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    return NextResponse.json(
      { message: 'Failed to save settings' },
      { status: 500 }
    );
  }
}