import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../../lib/auth-check.js';

export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const history = await db.getCompanyChangeHistory(id);
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch company history' }, { status: 500 });
  }
}