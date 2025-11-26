const fs = require('fs');
const path = require('path');

const patterns = [
  /\.email\s*===\s*[^.]/g,
  /===\s*.*\.email/g,
  /\.includes\([^)]*\.email[^)]*\)/g,
  /\.filter\([^)]*\.email[^)]*\)/g,
  /\.find\([^)]*\.email[^)]*\)/g,
  /email:\s*['"`][^'"`]*['"`]/g,
  /Key:\s*{\s*email:/g,
];

function searchFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];
    
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        if (pattern.test(line)) {
          matches.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 100)
          });
        }
      });
    });
    
    return matches;
  } catch (e) {
    return [];
  }
}

function searchDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.startsWith('.')) {
      searchDirectory(filePath, results);
    } else if (file.endsWith('.js') && !file.includes('.test.')) {
      const matches = searchFile(filePath);
      results.push(...matches);
    }
  });
  
  return results;
}

console.log('Searching for email comparison issues...\n');
const results = searchDirectory('app');
results.push(...searchDirectory('lib'));

if (results.length === 0) {
  console.log('No obvious email comparison issues found.');
} else {
  console.log(`Found ${results.length} potential issues:\n`);
  results.forEach(r => {
    console.log(`${r.file}:${r.line}`);
    console.log(`  ${r.content}`);
    console.log('');
  });
}
