import { NextResponse } from 'next/server';
import { saAutoAssignment } from '../../../../lib/sa-auto-assignment.js';
import { logger } from '../../../../lib/safe-logger.js';

export async function POST(request) {
  try {
    const { saAssignmentId } = await request.json();
    
    if (!saAssignmentId) {
      return NextResponse.json(
        { error: 'SA assignment ID is required' },
        { status: 400 }
      );
    }
    
    logger.info('Auto-assignment API called', { saAssignmentId });
    
    // Process auto-assignment
    const result = await saAutoAssignment.processAutoAssignment(saAssignmentId);
    
    logger.info('Auto-assignment result', { 
      saAssignmentId, 
      success: result.success,
      message: result.message 
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    logger.error('Error in SA auto-assignment API', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}