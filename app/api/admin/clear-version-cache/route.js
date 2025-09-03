import { db } from '../../../../lib/dynamodb';

export async function POST(request) {
  // Verify admin API key
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    // Clear the cached version setting
    await db.deleteSetting('current_version');
    
    return Response.json({ 
      success: true, 
      message: 'Version cache cleared' 
    });
  } catch (error) {
    console.error('Error clearing version cache:', error);
    return Response.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}