#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files to fix based on lint output
const filesToFix = [
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

function fixUnescapedEntities(content) {
  // Fix unescaped quotes and apostrophes in JSX text
  return content
    .replace(/([^=])"([^"]*)"([^=])/g, '$1&quot;$2&quot;$3')
    .replace(/([^=])'([^']*)'([^=])/g, '$1&#39;$2&#39;$3')
    .replace(/don't/g, 'don&#39;t')
    .replace(/can't/g, 'can&#39;t')
    .replace(/won't/g, 'won&#39;t')
    .replace(/isn't/g, 'isn&#39;t')
    .replace(/doesn't/g, 'doesn&#39;t')
    .replace(/haven't/g, 'haven&#39;t')
    .replace(/shouldn't/g, 'shouldn&#39;t')
    .replace(/wouldn't/g, 'wouldn&#39;t')
    .replace(/couldn't/g, 'couldn&#39;t');
}

console.log('🔧 Fixing lint issues...');

let fixedCount = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const fixedContent = fixUnescapedEntities(content);
      
      if (content !== fixedContent) {
        fs.writeFileSync(fullPath, fixedContent, 'utf8');
        console.log(`✅ Fixed: ${filePath}`);
        fixedCount++;
      }
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files`);
console.log('Run "npm run lint" to check remaining issues');