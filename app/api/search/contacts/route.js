import { NextResponse } from 'next/server';
import { searchContacts } from '../../../../lib/opensearch-contacts.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('q') || '';
    const practiceGroupId = searchParams.get('practiceGroupId') || '';
    const contactType = searchParams.get('contactType') || '';
    const tier = searchParams.get('tier') || '';
    const technology = searchParams.get('technology') || '';
    const solutionType = searchParams.get('solutionType') || '';

    const filters = {};
    if (practiceGroupId) filters.practiceGroupId = practiceGroupId;
    if (contactType) filters.contactType = contactType;
    if (tier) filters.tier = tier;
    if (technology) filters.technology = technology;
    if (solutionType) filters.solutionType = solutionType;

    const results = await searchContacts(searchTerm, filters);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching contacts:', error);
    return NextResponse.json({ error: 'Search failed', results: [] }, { status: 500 });
  }
}
