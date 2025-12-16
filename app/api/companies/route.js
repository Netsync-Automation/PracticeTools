import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';
import { validateUserSession } from '../../../lib/auth-check.js';
import { indexCompany, deleteCompanyFromIndex } from '../../../lib/opensearch-contacts.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId');
    const contactType = searchParams.get('contactType');
    
    if (!practiceGroupId || !contactType) {
      return NextResponse.json({ error: 'Practice group ID and contact type are required' }, { status: 400 });
    }

    const companies = await db.getCompanies(practiceGroupId, contactType);
    return NextResponse.json({ companies });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await request.json();
    
    // Validate required fields
    if (!company.name?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }
    if (!company.msaSigned?.trim()) {
      return NextResponse.json({ error: 'MSA status is required' }, { status: 400 });
    }
    if (!company.tier?.trim()) {
      return NextResponse.json({ error: 'Tier is required' }, { status: 400 });
    }
    if (!Array.isArray(company.technology) || company.technology.length === 0) {
      return NextResponse.json({ error: 'At least one technology is required' }, { status: 400 });
    }
    if (!Array.isArray(company.solutionType) || company.solutionType.length === 0) {
      return NextResponse.json({ error: 'At least one solution type is required' }, { status: 400 });
    }
    if (!company.website?.trim()) {
      return NextResponse.json({ error: 'Website is required' }, { status: 400 });
    }
    if (!company.practiceGroupId?.trim()) {
      return NextResponse.json({ error: 'Practice group ID is required' }, { status: 400 });
    }
    if (!company.contactType?.trim()) {
      return NextResponse.json({ error: 'Contact type is required' }, { status: 400 });
    }
    if (!company.addedBy?.trim()) {
      return NextResponse.json({ error: 'Added by is required' }, { status: 400 });
    }

    const savedCompany = await db.saveCompany({
      ...company,
      name: company.name.trim(),
      technology: company.technology,
      solutionType: company.solutionType,
      website: company.website.trim(),
      dateAdded: new Date().toISOString()
    }, validation.user);

    if (!savedCompany) {
      return NextResponse.json({ error: 'Failed to save company' }, { status: 500 });
    }

    // Index in OpenSearch
    const practiceGroups = await db.getPracticeGroups();
    const practiceGroup = practiceGroups.find(g => g.id === company.practiceGroupId);
    await indexCompany(savedCompany, practiceGroup?.displayName || 'Unknown');

    return NextResponse.json({ company: savedCompany });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save company' }, { status: 500 });
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
      return NextResponse.json({ error: 'Company ID and changes are required' }, { status: 400 });
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

    const success = await db.updateCompany(id, changes, user);

    if (!success) {
      return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
    }

    // Re-index in OpenSearch
    const updatedCompany = await db.getCompanyById(id);
    if (updatedCompany) {
      const practiceGroups = await db.getPracticeGroups();
      const practiceGroup = practiceGroups.find(g => g.id === practiceGroupId);
      await indexCompany(updatedCompany, practiceGroup?.displayName || 'Unknown');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
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
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
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

    const success = await db.deleteCompany(id, user);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
    }

    // Mark as deleted in OpenSearch
    await deleteCompanyFromIndex(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}