import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email') || 'cgarcia@netsync.com';
    const practiceId = searchParams.get('practiceId') || 'audiovisual';
    
    console.log('[DEBUG-PERMISSIONS] Checking permissions for:', userEmail, 'practice:', practiceId);
    
    // Get user data
    const user = await db.getUser(userEmail);
    
    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        userEmail: userEmail
      });
    }
    
    // Check board data
    const environment = process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
    const boardKey = `${environment}_practice_board_${practiceId}`;
    const boardData = await db.getSetting(boardKey);
    
    // Infer practices from practiceId
    const practiceMap = {
      'audiovisual': ['Audio Visual'],
      'collaboration': ['Collaboration'],
      'security': ['Security'],
      'datacenter': ['Data Center'],
      'networking': ['Networking'],
      'cloud': ['Cloud'],
      'wireless': ['Wireless'],
      'contactcenter': ['Contact Center'],
      'iot': ['IoT'],
      'physicalsecurity': ['Physical Security']
    };
    
    const inferredPractices = practiceMap[practiceId] || [];
    
    // Check permissions
    let canEdit = false;
    let permissionReason = '';
    
    if (user.isAdmin) {
      canEdit = true;
      permissionReason = 'User is admin';
    } else if (boardData) {
      const parsed = JSON.parse(boardData);
      
      if (parsed.practices && user.practices) {
        // Direct match
        canEdit = parsed.practices.some(practice => user.practices.includes(practice));
        if (canEdit) {
          permissionReason = 'Direct practice match';
        } else if (user.role === 'practice_principal' || user.role === 'practice_manager') {
          // Case-insensitive match
          canEdit = parsed.practices.some(boardPractice => 
            user.practices.some(userPractice => 
              boardPractice.toLowerCase().replace(/[^a-z]/g, '') === userPractice.toLowerCase().replace(/[^a-z]/g, '')
            )
          );
          if (canEdit) {
            permissionReason = 'Case-insensitive practice match for principal/manager';
          }
        }
        
        if (!canEdit && (!parsed.practices || parsed.practices.length === 0)) {
          canEdit = inferredPractices.some(practice => 
            user.practices.some(userPractice => 
              practice.toLowerCase().replace(/[^a-z]/g, '') === userPractice.toLowerCase().replace(/[^a-z]/g, '')
            )
          );
          if (canEdit) {
            permissionReason = 'Inferred practice match (empty board practices)';
          }
        }
      }
    } else {
      // No board exists - check creation permissions
      if (user.practices) {
        canEdit = inferredPractices.some(practice => 
          user.practices.some(userPractice => 
            practice.toLowerCase().replace(/[^a-z]/g, '') === userPractice.toLowerCase().replace(/[^a-z]/g, '')
          )
        );
        if (canEdit) {
          permissionReason = 'Can create new board for practice';
        }
      }
    }
    
    if (!canEdit) {
      permissionReason = 'No matching practices found';
    }
    
    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
        practices: user.practices,
        auth_method: user.auth_method
      },
      board: {
        exists: !!boardData,
        key: boardKey,
        practices: boardData ? JSON.parse(boardData).practices : null
      },
      permission: {
        canEdit: canEdit,
        reason: permissionReason
      },
      debug: {
        practiceId: practiceId,
        inferredPractices: inferredPractices,
        environment: environment
      }
    });
    
  } catch (error) {
    console.error('[DEBUG-PERMISSIONS] Error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}