import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../lib/dynamodb.js';

export async function GET() {
  try {
    let mappings = await db.getEmailFieldMappings();
    
    // If no mappings exist, create default ones
    if (!mappings || mappings.length === 0) {
      await createDefaultMappings();
      mappings = await db.getEmailFieldMappings();
    }
    
    return NextResponse.json({ 
      success: true, 
      mappings: (mappings || []).sort((a, b) => a.label.localeCompare(b.label))
    });
  } catch (error) {
    console.error('Error fetching email field mappings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function createDefaultMappings() {
  const defaultMappings = [
    { value: 'projectNumber', label: 'Project Number' },
    { value: 'clientName', label: 'Client Name' },
    { value: 'requestedBy', label: 'Requested By' },
    { value: 'skillsRequired', label: 'Skills Required' },
    { value: 'startDate', label: 'Start Date' },
    { value: 'endDate', label: 'End Date' },
    { value: 'description', label: 'Description' },
    { value: 'priority', label: 'Priority' },
    { value: 'region', label: 'Region' },
    { value: 'pm', label: 'PM' },
    { value: 'documentationLink', label: 'Documentation Link' },
    { value: 'notes', label: 'Notes' },
    { value: 'resource_assignment_notification_users', label: 'Notification Users' }
  ];
  
  for (const mapping of defaultMappings) {
    try {
      await db.createEmailFieldMapping({
        id: mapping.value,
        value: mapping.value,
        label: mapping.label,
        created_at: new Date().toISOString(),
        environment: getEnvironment()
      });
    } catch (error) {
      console.error(`Error creating mapping ${mapping.value}:`, error);
    }
  }
}