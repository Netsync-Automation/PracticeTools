import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use ENVIRONMENT variable as single source of truth from apprunner.yaml (same as version API)
    const environment = process.env.ENVIRONMENT || 'dev';
    
    return NextResponse.json({ environment });
  } catch (error) {
    console.error('Error in environment API:', error);
    return NextResponse.json({ environment: 'dev' });
  }
}