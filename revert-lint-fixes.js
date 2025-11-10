#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files that were modified by the fix-lint script
const filesToRevert = [
  'app/about/page.js',
  'app/admin/page.js',
  'app/admin/settings/page.js',
  'app/help/page.js',
  'app/issue/[id]/page.js',
  'app/new-issue/page.js',
  'app/practice-information/training-certs/page.js',
  'app/practice-issues/page.js',
  'app/practice-issues-leadership/page.js',
  'app/pre-sales/sa-to-am-mapping/page.js',
  'app/projects/resource-assignments/page.js',
  'app/projects/resource-assignments/[id]/page.js',
  'app/projects/sa-assignments/page.js',
  'components/CardSettingsModal.js',
  'components/CompleteStatusModal.js',
  'components/ContactSettingsModal.js',
  'components/MultiAccountManagerSelector.js',
  'components/MultiResourceSelector.js',
  'components/Navbar.js'
];

function revertUnescapedEntities(content) {
  // Revert the escaped entities back to original
  return content
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

console.log('🔄 Reverting lint fixes...');

let revertedCount = 0;

filesToRevert.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const revertedContent = revertUnescapedEntities(content);
      
      if (content !== revertedContent) {
        fs.writeFileSync(fullPath, revertedContent, 'utf8');
        console.log(`✅ Reverted: ${filePath}`);
        revertedCount++;
      }
    } catch (error) {
      console.log(`❌ Error reverting ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Reverted ${revertedCount} files`);
console.log('Files restored to original state');