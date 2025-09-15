import { NextResponse } from 'next/server';
import { autoMappingUtility } from '../../../../lib/auto-mapping-utility.js';
import { logger } from '../../../../lib/safe-logger.js';

export async function POST(request) {
  try {
    const { amEmail } = await request.json();
    
    if (!amEmail) {
      return NextResponse.json(
        { error: 'Account Manager email is required' },
        { status: 400 }
      );
    }
    
    logger.info('Manual auto-mapping triggered', { amEmail });
    
    const createdMappings = await autoMappingUtility.createMappingsForNewAM(amEmail);
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdMappings?.length || 0} mappings for Account Manager`,
      createdMappings: createdMappings || []
    });
    
  } catch (error) {
    logger.error('Error in manual auto-mapping', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}