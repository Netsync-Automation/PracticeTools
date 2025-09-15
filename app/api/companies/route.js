import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

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
    const company = await request.json();
    
    // Validate required fields
    const required = ['name', 'msaSigned', 'tier', 'technology', 'solutionType', 'website', 'practiceGroupId', 'contactType', 'addedBy'];
    for (const field of required) {
      if (!company[field]?.trim()) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    const savedCompany = await db.saveCompany({
      ...company,
      name: company.name.trim(),
      technology: company.technology.trim(),
      solutionType: company.solutionType.trim(),
      website: company.website.trim(),
      dateAdded: new Date().toISOString()
    });

    if (!savedCompany) {
      return NextResponse.json({ error: 'Failed to save company' }, { status: 500 });
    }

    return NextResponse.json({ company: savedCompany });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save company' }, { status: 500 });
  }
}