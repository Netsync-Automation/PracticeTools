import { NextResponse } from 'next/server';

export async function POST(request) {
  console.log('🧪 [WEBHOOK-TEST] Test webhook endpoint called');
  console.log('🧪 [WEBHOOK-TEST] Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('🧪 [WEBHOOK-TEST] Request method:', request.method);
  console.log('🧪 [WEBHOOK-TEST] Request URL:', request.url);
  
  try {
    const body = await request.json();
    console.log('🧪 [WEBHOOK-TEST] Request body:', JSON.stringify(body, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test endpoint is reachable',
      timestamp: new Date().toISOString(),
      receivedData: body
    });
  } catch (error) {
    console.error('🧪 [WEBHOOK-TEST] Error processing test request:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request) {
  console.log('🧪 [WEBHOOK-TEST] Test webhook endpoint called via GET');
  return NextResponse.json({ 
    success: true, 
    message: 'Test endpoint is reachable via GET',
    timestamp: new Date().toISOString()
  });
}