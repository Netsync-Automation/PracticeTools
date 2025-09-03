import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { db } from '../../../../lib/dynamodb.js';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resourceEmailEnabled = await db.getSetting('resource_email_enabled') === 'true';
    const resourceRules = JSON.parse(await db.getSetting('resource_email_rules') || '[]');

    return NextResponse.json({
      resourceEmailEnabled,
      resourceRules
    });

  } catch (error) {
    console.error('Error loading resource settings:', error);
    return NextResponse.json(
      { error: 'Failed to load resource settings' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resourceEmailEnabled, resourceRules } = await request.json();

    // Save settings to database
    await db.saveSetting('resource_email_enabled', resourceEmailEnabled ? 'true' : 'false');
    await db.saveSetting('resource_email_rules', JSON.stringify(resourceRules || []));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error saving resource settings:', error);
    return NextResponse.json(
      { error: 'Failed to save resource settings' },
      { status: 500 }
    );
  }
}