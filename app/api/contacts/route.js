import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';
import { validateUserSession } from '../../../lib/auth-check.js';
import { validatePhoneNumber } from '../../../lib/phone-utils.js';
import { indexContact, deleteContactFromIndex } from '../../../lib/opensearch-contacts.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const contacts = await db.getContacts(companyId);
    return NextResponse.json({ contacts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contact = await request.json();
    
    // Validate required fields
    const required = ['name', 'email', 'role', 'cellPhone', 'companyId', 'addedBy'];
    for (const field of required) {
      if (!contact[field]?.trim()) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Phone number validation
    const phoneFields = ['cellPhone', 'officePhone', 'fax'];
    for (const field of phoneFields) {
      if (contact[field] && contact[field].trim()) {
        const validation = validatePhoneNumber(contact[field]);
        if (!validation.isValid) {
          return NextResponse.json({ error: `Invalid ${field}: ${validation.error}` }, { status: 400 });
        }
      }
    }

    const savedContact = await db.saveContact({
      ...contact,
      name: contact.name.trim(),
      email: contact.email.trim(),
      role: contact.role.trim(),
      cellPhone: contact.cellPhone,
      officePhone: contact.officePhone || '',
      fax: contact.fax || '',
      notes: contact.notes?.trim() || '',
      dateAdded: new Date().toISOString(),
      addedBy: contact.addedBy.trim()
    }, validation.user);

    if (!savedContact) {
      return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 });
    }

    // Index in OpenSearch
    const company = await db.getCompanyById(contact.companyId);
    if (company) {
      const practiceGroups = await db.getPracticeGroups();
      const practiceGroupId = company.practice_group_id || company.practiceGroupId;
      const contactType = company.contact_type || company.contactType;
      const practiceGroup = practiceGroups.find(g => g.id === practiceGroupId);
      await indexContact(savedContact, company.name, practiceGroupId, practiceGroup?.displayName || 'Unknown', contactType);
    }

    return NextResponse.json({ contact: savedContact });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, changes, practiceGroupId } = await request.json();
    
    if (!id || !changes) {
      return NextResponse.json({ error: 'Contact ID and changes are required' }, { status: 400 });
    }

    // Check permissions
    const user = validation.user;
    let canEdit = user.isAdmin || user.role === 'executive';
    
    if (!canEdit && ['practice_manager', 'practice_principal', 'practice_member'].includes(user.role)) {
      // Get practice group data to check permissions
      const allUsers = await db.getAllUsers();
      const practiceManager = allUsers.find(u => u.email === practiceGroupId && u.role === 'practice_manager');
      
      if (practiceManager && practiceManager.practices && user.practices) {
        // Check if user has any overlapping practices with the practice group
        canEdit = practiceManager.practices.some(practice => user.practices.includes(practice));
      }
    }
    
    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const success = await db.updateContact(id, changes, user);

    if (!success) {
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
    }

    // Re-index in OpenSearch
    const updatedContact = await db.getContactById(id);
    if (updatedContact) {
      const companyId = updatedContact.companyId || updatedContact.company_id;
      const company = await db.getCompanyById(companyId);
      if (company) {
        const practiceGroups = await db.getPracticeGroups();
        const practiceGroupId = company.practice_group_id || company.practiceGroupId;
        const contactType = company.contact_type || company.contactType;
        const practiceGroup = practiceGroups.find(g => g.id === practiceGroupId);
        await indexContact(updatedContact, company.name, practiceGroupId, practiceGroup?.displayName || 'Unknown', contactType);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const practiceGroupId = searchParams.get('practiceGroupId');
    
    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    // Check permissions
    const user = validation.user;
    let canDelete = user.isAdmin || user.role === 'executive';
    
    if (!canDelete && ['practice_manager', 'practice_principal', 'practice_member'].includes(user.role)) {
      // Get practice group data to check permissions
      const allUsers = await db.getAllUsers();
      const practiceManager = allUsers.find(u => u.email === practiceGroupId && u.role === 'practice_manager');
      
      if (practiceManager && practiceManager.practices && user.practices) {
        // Check if user has any overlapping practices with the practice group
        canDelete = practiceManager.practices.some(practice => user.practices.includes(practice));
      }
    }
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const success = await db.deleteContact(id, user);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
    }

    // Mark as deleted in OpenSearch
    await deleteContactFromIndex(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}