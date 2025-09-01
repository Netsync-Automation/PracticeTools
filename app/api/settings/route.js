import { db } from '../../../lib/dynamodb';

export async function GET() {
  try {
    const settings = await db.getSettings();
    return Response.json({ settings: settings || {} });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const settingsData = await request.json();
    await db.saveSettings(settingsData);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}