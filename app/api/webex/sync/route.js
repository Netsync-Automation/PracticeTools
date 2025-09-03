import { NextResponse } from 'next/server';
import { WebexSync } from '../../../../lib/webex-sync';

export async function POST() {
  try {
    const result = await WebexSync.syncRoomMembers();
    
    if (result) {
      return NextResponse.json({ success: true, message: 'Users synchronized successfully' });
    } else {
      return NextResponse.json({ error: 'Synchronization failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}