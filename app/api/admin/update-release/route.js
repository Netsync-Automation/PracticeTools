import { db } from '../../../../lib/dynamodb';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const updateData = await request.json();
    
    const release = {
      version: updateData.version,
      date: '2025-08-26',
      type: 'Major Release',
      features: updateData.features || [],
      improvements: updateData.improvements || [],
      bugFixes: updateData.bugFixes || [],
      breaking: updateData.breaking || [],
      notes: updateData.notes || '',
      helpContent: ''
    };
    
    const success = await db.saveRelease(release);
    
    if (success) {
      return Response.json({ 
        success: true, 
        message: `Release ${updateData.version} updated successfully` 
      });
    } else {
      return Response.json({ error: 'Failed to update release' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating release:', error);
    return Response.json({ error: 'Failed to update release' }, { status: 500 });
  }
}