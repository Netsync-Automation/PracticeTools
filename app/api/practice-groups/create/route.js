import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check.js';
import { db } from '../../../../lib/dynamodb.js';
import { validateCSRFToken } from '../../../../lib/csrf.js';


export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSRF Protection
    const csrfToken = request.headers.get('x-csrf-token');
    if (!validateCSRFToken(csrfToken, process.env.CSRF_SECRET)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Get all practice managers and principals
    const users = await db.getAllUsers();
    const practiceManagers = users.filter(user => 
      user.role === 'practice_manager' || user.role === 'practice_principal'
    );

    if (practiceManagers.length === 0) {
      return NextResponse.json({
        success: true,
        practiceManagersFound: 0,
        results: { created: 0, existing: 0, errors: 0 }
      });
    }

    // Get existing contact types to check what already exists
    const existingContactTypes = await db.getAllSettings();
    const existingGroupIds = new Set();
    
    // Extract practice group IDs from existing contact types
    Object.keys(existingContactTypes).forEach(key => {
      if (key.startsWith('contact_type_')) {
        const typeData = JSON.parse(existingContactTypes[key]);
        if (typeData.practiceGroupId) {
          existingGroupIds.add(typeData.practiceGroupId);
        }
      }
    });

    let created = 0;
    let existing = 0;
    let errors = 0;

    // Create practice groups for each manager
    for (const manager of practiceManagers) {
      if (!manager.practices || manager.practices.length === 0) continue;

      // Use manager email as the group ID (consistent with existing API)
      const groupId = manager.email;
      
      if (existingGroupIds.has(groupId)) {
        existing++;
        continue;
      }

      try {
        // Create default contact type for this practice group
        await db.saveSetting(`contact_type_${groupId}_main`, JSON.stringify({
          id: `${groupId}-main-contact-list`,
          practiceGroupId: groupId,
          name: 'Main Contact List',
          description: 'Primary contact list for this practice group',
          created_at: new Date().toISOString(),
          created_by: validation.user.email
        }));

        created++;
      } catch (error) {
        console.error(`Error creating practice group for ${manager.name}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      practiceManagersFound: practiceManagers.length,
      results: { created, existing, errors }
    });

  } catch (error) {
    console.error('Error creating practice groups:', error);
    return NextResponse.json({ error: 'Failed to create practice groups' }, { status: 500 });
  }
}