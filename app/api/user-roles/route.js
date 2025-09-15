import { NextResponse } from 'next/server';
import { db, getTableName, getEnvironment } from '../../../lib/dynamodb.js';

export async function GET() {
  try {
    let roles = await db.getUserRoles();
    
    // If no roles exist, create default ones
    if (!roles || roles.length === 0) {
      await createDefaultRoles();
      roles = await db.getUserRoles();
    }
    
    return NextResponse.json({ 
      success: true, 
      roles: (roles || []).sort((a, b) => a.label.localeCompare(b.label))
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function createDefaultRoles() {
  const defaultRoles = [
    { value: 'account_manager', label: 'Account Manager' },
    { value: 'netsync_employee', label: 'NetSync Employee' },
    { value: 'practice_manager', label: 'Practice Manager' },
    { value: 'practice_member', label: 'Practice Member' },
    { value: 'practice_principal', label: 'Practice Principal' }
  ];
  
  for (const role of defaultRoles) {
    try {
      await db.createUserRole({
        id: role.value,
        value: role.value,
        label: role.label,
        created_at: new Date().toISOString(),
        environment: getEnvironment()
      });
    } catch (error) {
      console.error(`Error creating role ${role.value}:`, error);
    }
  }
}