import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 [TEST] TEST BOARDS API CALLED - THIS SHOULD APPEAR IN LOGS');
  return NextResponse.json({ 
    message: 'Test API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT 
  });
}