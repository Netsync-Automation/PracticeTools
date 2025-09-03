import { NextResponse } from 'next/server';
import { samlService } from '../../../../../lib/saml.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metadata = await samlService.getMetadata();
    
    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'inline; filename="metadata.xml"'
      }
    });
  } catch (error) {
    console.error('SAML metadata error:', error);
    return NextResponse.json({ error: 'Failed to generate metadata' }, { status: 500 });
  }
}