import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';
import { saMappingAutoCreator } from '../../../lib/sa-mapping-auto-creator.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const users = await db.getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { email, name, password, role, auth_method, specifyPassword, isAdmin, practices, region } = await request.json();
    
    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }
    
    if (role === 'account_manager' && !region) {
      return NextResponse.json({ error: 'Region is required for account managers' }, { status: 400 });
    }
    
    let finalPassword = password;
    let requirePasswordChange = false;
    
    // Generate password if not specified
    if (auth_method === 'local' && !specifyPassword) {
      finalPassword = generatePassword();
      requirePasswordChange = true;
    }
    
    if (auth_method === 'local' && !finalPassword) {
      return NextResponse.json({ error: 'Password is required for local users' }, { status: 400 });
    }
    
    const success = await db.createOrUpdateUser(
      email, 
      name, 
      auth_method || 'local', 
      role || 'practice_member', 
      finalPassword,
      'manual',
      requirePasswordChange,
      isAdmin || false,
      practices || [],
      'active',
      null,
      region
    );
    
    if (success && auth_method === 'local') {
      // Send welcome email for all local users
      try {
        const emailResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/email/welcome-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name,
            password: finalPassword,
            role,
            isTemporary: !specifyPassword
          })
        });
        
        if (!emailResponse.ok) {
          console.error('Failed to send welcome email');
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
      }
    }
    
    if (success) {
      // Auto-create SA mappings if new user is an account manager
      if (role === 'account_manager') {
        try {
          const mappingResult = await saMappingAutoCreator.createMappingsForNewAM(name, email);
          if (mappingResult.success && mappingResult.created > 0) {
            console.log(`Auto-created ${mappingResult.created} SA mappings for new AM: ${name}`);
          }
        } catch (mappingError) {
          console.error('Error auto-creating SA mappings for new AM:', mappingError);
        }
      }
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}