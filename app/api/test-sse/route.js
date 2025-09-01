import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { getClientInfo, notifyClients } = await import('../events/route');
    const clientInfo = getClientInfo();
    
    return NextResponse.json({
      success: true,
      clientInfo,
      totalChannels: Object.keys(clientInfo).length,
      allChannelClients: clientInfo['all'] || [],
      allChannelCount: clientInfo['all']?.length || 0
    });
  } catch (error) {
    console.error('Error getting client info:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { channel = 'all', message = 'Test message' } = await request.json();
    
    const { notifyClients } = await import('../events/route');
    notifyClients(channel, {
      type: 'test_message',
      message,
      timestamp: Date.now()
    });
    
    return NextResponse.json({
      success: true,
      message: `Test message sent to channel: ${channel}`
    });
  } catch (error) {
    console.error('Error sending test message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}