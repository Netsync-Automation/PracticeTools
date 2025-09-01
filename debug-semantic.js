import { execSync } from 'child_process';

console.log('🔍 Semantic-Release Debug Analysis');
console.log('='.repeat(50));

// Check if there are any existing tags
try {
  const tags = execSync('git tag -l', { encoding: 'utf8' }).trim();
  console.log('📋 Existing Git Tags:');
  if (tags) {
    console.log(tags);
  } else {
    console.log('❌ No existing tags found');
    console.log('💡 This might be why semantic-release says "no release"');
  }
} catch (error) {
  console.log('❌ Error checking tags:', error.message);
}

console.log('');

// Check the last release
try {
  const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  console.log('🏷️  Last Tag:', lastTag);
  
  // Get commits since last tag
  const commitsSinceTag = execSync(`git log ${lastTag}..HEAD --oneline`, { encoding: 'utf8' }).trim();
  console.log('📝 Commits since last tag:');
  console.log(commitsSinceTag || 'No commits since last tag');
} catch (error) {
  console.log('🏷️  No previous tags found - this is a fresh repository');
  console.log('💡 Semantic-release should create the first release (1.0.0)');
}

console.log('');
console.log('🔧 Possible Issues:');
console.log('1. No initial tag exists (semantic-release needs a starting point)');
console.log('2. Commit-analyzer preset might be wrong');
console.log('3. Repository URL configuration issue');
console.log('');
console.log('🎯 Solution: Create an initial tag or fix configuration');