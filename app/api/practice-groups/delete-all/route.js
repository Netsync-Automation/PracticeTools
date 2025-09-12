import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check.js';
import { db } from '../../../../lib/dynamodb.js';
import { validateCSRFToken } from '../../../../lib/csrf.js';

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

    let deletedContactTypesCount = 0;
    let deletedCompaniesCount = 0;
    let deletedContactsCount = 0;

    // Delete all contact types from settings
    try {
      const allSettings = await db.getAllSettings();
      for (const [key, value] of Object.entries(allSettings)) {
        if (key.startsWith('contact_type_')) {
          await db.deleteSetting(key);
          deletedContactTypesCount++;
        }
      }
    } catch (error) {
      console.error('Error deleting contact types:', error);
    }

    // Note: Companies and Contacts tables would need to be implemented
    // For now, just return the contact types count
    deletedCompaniesCount = 0;
    deletedContactsCount = 0;

    return NextResponse.json({
      success: true,
      deletedGroupsCount: deletedContactTypesCount, // Practice groups are represented by contact types
      deletedContactTypesCount,
      deletedCompaniesCount,
      deletedContactsCount
    });

  } catch (error) {
    console.error('Error deleting practice groups:', error);
    return NextResponse.json({ error: 'Failed to delete practice groups' }, { status: 500 });
  }
}