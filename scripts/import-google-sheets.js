import { google } from 'googleapis';
import readlineSync from 'readline-sync';
import { db } from '../lib/dynamodb.js';

// Resource assignment database columns
const DB_COLUMNS = {
  practice: 'Practice area',
  status: 'Assignment status',
  projectNumber: 'Project number/ID',
  requestDate: 'Request date',
  eta: 'Estimated completion date',
  customerName: 'Customer name',
  projectDescription: 'Project description',
  region: 'Region',
  am: 'Account Manager',
  pm: 'Project Manager',
  resourceAssigned: 'Resource assigned',
  dateAssigned: 'Date assigned',
  notes: 'Notes/Comments'
};

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function suggestMapping(columnName) {
  const lower = columnName.toLowerCase();
  
  if (lower.includes('practice')) return 'practice';
  if (lower.includes('status')) return 'status';
  if (lower.includes('project') && (lower.includes('number') || lower.includes('id'))) return 'projectNumber';
  if (lower.includes('request') && lower.includes('date')) return 'requestDate';
  if (lower.includes('eta') || (lower.includes('completion') && lower.includes('date'))) return 'eta';
  if (lower.includes('customer')) return 'customerName';
  if (lower.includes('description')) return 'projectDescription';
  if (lower.includes('region')) return 'region';
  if (lower.includes('am') || lower.includes('account')) return 'am';
  if (lower.includes('pm') || lower.includes('project manager')) return 'pm';
  if (lower.includes('resource')) return 'resourceAssigned';
  if (lower.includes('assigned') && lower.includes('date')) return 'dateAssigned';
  if (lower.includes('note') || lower.includes('comment')) return 'notes';
  
  return null;
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  
  // Handle various date formats
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  
  return date.toISOString().split('T')[0];
}

async function getSheetData(sheetId) {
  try {
    // Convert to CSV export URL for public sheets
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV to array of arrays
    const rows = [];
    const lines = csvText.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        // Simple CSV parsing (handles basic cases)
        const row = line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim());
        rows.push(row);
      }
    }
    
    return rows;
  } catch (error) {
    console.error('Error accessing Google Sheet:', error.message);
    console.log('\\nTip: Make sure the Google Sheet is publicly accessible (Anyone with the link can view)');
    return null;
  }
}

async function importGoogleSheet() {
  console.log('🔄 Google Sheets to Resource Assignments Import Tool\\n');
  
  // Get Google Sheet URL
  const sheetUrl = readlineSync.question('Enter Google Sheet URL: ');
  const sheetId = extractSheetId(sheetUrl);
  
  if (!sheetId) {
    console.log('❌ Invalid Google Sheet URL');
    return;
  }
  
  console.log('\\n📊 Fetching sheet data...');
  const data = await getSheetData(sheetId);
  
  if (!data || data.length === 0) {
    console.log('❌ No data found in sheet');
    return;
  }
  
  const headers = data[2]; // Row 3 (0-indexed)
  const rows = data.slice(3); // Data starts from row 4
  
  console.log(`\\n✅ Found ${rows.length} rows with ${headers.length} columns\\n`);
  
  // Map columns
  const columnMapping = {};
  
  console.log('📋 Column Mapping (press Enter to accept suggestion, type new mapping, or "skip" to ignore):\\n');
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const suggestion = suggestMapping(header);
    
    if (suggestion) {
      const prompt = `"${header}" → ${DB_COLUMNS[suggestion]} [${suggestion}]: `;
      const input = readlineSync.question(prompt);
      
      if (input.toLowerCase() === 'skip') {
        console.log(`   Skipped: ${header}\\n`);
        continue;
      }
      
      const mapping = input.trim() || suggestion;
      if (DB_COLUMNS[mapping]) {
        columnMapping[i] = mapping;
        console.log(`   Mapped: ${header} → ${DB_COLUMNS[mapping]}\\n`);
      } else {
        console.log(`   Invalid mapping: ${mapping}\\n`);
      }
    } else {
      const prompt = `"${header}" → (enter db column or "skip"): `;
      const input = readlineSync.question(prompt);
      
      if (input.toLowerCase() === 'skip') {
        console.log(`   Skipped: ${header}\\n`);
        continue;
      }
      
      if (DB_COLUMNS[input.trim()]) {
        columnMapping[i] = input.trim();
        console.log(`   Mapped: ${header} → ${DB_COLUMNS[input.trim()]}\\n`);
      } else {
        console.log(`   Invalid mapping: ${input}\\n`);
      }
    }
  }
  
  console.log('\\n📋 Final Column Mapping:');
  Object.entries(columnMapping).forEach(([index, dbColumn]) => {
    console.log(`   ${headers[index]} → ${DB_COLUMNS[dbColumn]}`);
  });
  
  const confirm = readlineSync.question('\\nProceed with import? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Import cancelled');
    return;
  }
  
  console.log('\\n🔄 Importing data...');
  
  let imported = 0;
  let errors = 0;
  
  for (const row of rows) {
    try {
      const assignmentData = {
        practice: '',
        status: 'Unassigned',
        projectNumber: '',
        requestDate: '',
        eta: '',
        customerName: '',
        projectDescription: '',
        region: '',
        am: '',
        pm: '',
        resourceAssigned: '',
        dateAssigned: '',
        notes: ''
      };
      
      // Map row data to assignment fields
      Object.entries(columnMapping).forEach(([index, dbColumn]) => {
        const value = row[index] || '';
        
        if (dbColumn === 'requestDate' || dbColumn === 'eta' || dbColumn === 'dateAssigned') {
          assignmentData[dbColumn] = formatDate(value);
        } else {
          assignmentData[dbColumn] = value.toString().trim();
        }
      });
      
      // Skip rows with no essential data
      if (!assignmentData.projectNumber && !assignmentData.customerName && !assignmentData.projectDescription) {
        continue;
      }
      
      const assignmentId = await db.addAssignment(
        assignmentData.practice,
        assignmentData.status,
        assignmentData.projectNumber,
        assignmentData.requestDate,
        assignmentData.eta,
        assignmentData.customerName,
        assignmentData.projectDescription,
        assignmentData.region,
        assignmentData.am,
        assignmentData.pm,
        assignmentData.resourceAssigned,
        assignmentData.dateAssigned,
        assignmentData.notes
      );
      
      if (assignmentId) {
        imported++;
        console.log(`✅ Imported: ${assignmentData.projectDescription || assignmentData.customerName || 'Assignment'}`);
      } else {
        errors++;
        console.log(`❌ Failed: ${assignmentData.projectDescription || assignmentData.customerName || 'Assignment'}`);
      }
    } catch (error) {
      errors++;
      console.log(`❌ Error importing row: ${error.message}`);
    }
  }
  
  console.log(`\\n📊 Import Summary:`);
  console.log(`   ✅ Successfully imported: ${imported}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📋 Total processed: ${rows.length}`);
}

// Available database columns help
console.log('Available database columns:');
Object.entries(DB_COLUMNS).forEach(([key, description]) => {
  console.log(`   ${key} - ${description}`);
});
console.log('');

importGoogleSheet().catch(console.error);