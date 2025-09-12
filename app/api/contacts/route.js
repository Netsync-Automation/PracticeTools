import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

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
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
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

    const savedContact = await db.saveContact({
      ...contact,
      name: contact.name.trim(),
      email: contact.email.trim(),
      role: contact.role.trim(),
      cellPhone: contact.cellPhone.trim(),
      officePhone: contact.officePhone?.trim() || '',
      fax: contact.fax?.trim() || '',
      dateAdded: new Date().toISOString(),
      addedBy: contact.addedBy
    });

    if (!savedContact) {
      return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 });
    }

    return NextResponse.json({ contact: savedContact });
  } catch (error) {
    console.error('Error saving contact:', error);
    return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 });
  }
}