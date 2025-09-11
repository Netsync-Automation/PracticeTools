import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

console.log('📋 [LIST] MODULE LOADED - PRACTICE BOARDS LIST ROUTE');

export async function GET() {
  // Use process.stdout.write for guaranteed log visibility in production
  process.stdout.write('\n🚨 [CRITICAL] PRACTICE BOARDS LIST API CALLED - PRODUCTION TEST\n');
  console.error('🚨 [CRITICAL] PRACTICE BOARDS LIST API CALLED - PRODUCTION TEST');
  console.log('📋 [LIST] ===== GET FUNCTION CALLED =====');
  console.log('📋 [LIST] ===== GET FUNCTION CALLED =====');
  console.log('📋 [LIST] ===== GET FUNCTION CALLED =====');
  console.log('📋 [LIST] ===== PRACTICE BOARDS LIST API CALLED =====');
  console.log('📋 [LIST] Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    ENVIRONMENT: process.env.ENVIRONMENT,
    AWS_EXECUTION_ENV: process.env.AWS_EXECUTION_ENV
  });
  
  try {
    console.log('📋 [LIST] Starting practice boards list API');
    console.log('📋 [LIST] About to call db.getAllSettings()');
    
    // Get all practice board settings
    const allSettings = await db.getAllSettings();
    
    console.log('📋 [LIST] getAllSettings() completed successfully');
    console.log('📋 [LIST] Got settings, total keys:', Object.keys(allSettings).length);
    console.log('📋 [LIST] All settings keys:', Object.keys(allSettings));
    
    // Filter for practice board keys
    const practiceKeys = Object.keys(allSettings).filter(key => key.startsWith('practice_board_'));
    console.log('📋 [LIST] Practice board keys found:', practiceKeys);
    
    const practiceBoards = [];
    
    for (const [key, value] of Object.entries(allSettings)) {
      console.log('📋 [LIST] Processing key:', key);
      
      if (key.startsWith('practice_board_') && key !== 'practice_board_data') {
        console.log('📋 [LIST] Key matches practice_board_ pattern:', key);
        
        const practiceId = key.replace('practice_board_', '');
        console.log('📋 [LIST] Extracted practiceId:', practiceId);
        
        // Skip topic-specific boards (they contain underscores after the practice ID)
        if (practiceId.includes('_')) {
          console.log('📋 [LIST] Skipping topic-specific board (contains underscore):', practiceId);
          continue;
        }
        
        console.log('📋 [LIST] Processing board data for:', practiceId);
        console.log('📋 [LIST] Raw board data:', value);
        
        try {
          const boardData = JSON.parse(value);
          console.log('📋 [LIST] Parsed board data:', boardData);
          
          // Handle legacy boards that don't have practices field
          let practices = boardData.practices;
          if (!practices || practices.length === 0) {
            console.log('📋 [LIST] No practices field, reconstructing from practiceId');
            // Reconstruct practices from practiceId for legacy boards
            practices = practiceId.split('-').map(p => 
              p.split('').map((char, i) => i === 0 ? char.toUpperCase() : char).join('')
            );
            console.log('📋 [LIST] Reconstructed practices:', practices);
          }
          
          const board = {
            practiceId,
            practices,
            managerId: boardData.managerId,
            createdAt: boardData.createdAt
          };
          
          console.log('📋 [LIST] Adding board to results:', board);
          practiceBoards.push(board);
          
        } catch (parseError) {
          console.error('📋 [LIST] Error parsing board data for key:', key, parseError);
        }
      } else {
        console.log('📋 [LIST] Skipping non-practice-board key:', key);
      }
    }
    
    console.log('📋 [LIST] Final practice boards array:', practiceBoards);
    console.log('📋 [LIST] Returning boards count:', practiceBoards.length);
    console.log('📋 [LIST] Response object:', { boards: practiceBoards });
    
    const response = { boards: practiceBoards, debug: { totalSettings: Object.keys(allSettings).length, practiceKeys: Object.keys(allSettings).filter(k => k.startsWith('practice_board_')) } };
    console.log('📋 [LIST] FINAL RESPONSE:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('📋 [LIST] ERROR listing practice boards:', error);
    console.error('📋 [LIST] Error stack:', error.stack);
    console.error('📋 [LIST] Error name:', error.name);
    console.error('📋 [LIST] Error message:', error.message);
    return NextResponse.json({ error: 'Failed to list practice boards', details: error.message }, { status: 500 });
  }
}