import { execSync } from 'child_process';

console.log('🔍 CHECKING CURRENT VERSION STATE');
console.log('='.repeat(50));

// Check Git tags
try {
  const tags = execSync('git tag -l', { encoding: 'utf8' }).trim();
  console.log('📋 Git Tags:');
  if (tags) {
    console.log(tags);
  } else {
    console.log('❌ No Git tags found');
  }
} catch (error) {
  console.log('❌ Error checking Git tags');
}

console.log('');

// Check if v1.0.0 tag exists
try {
  const hasV1Tag = execSync('git tag -l "v1.0.0"', { encoding: 'utf8' }).trim();
  if (hasV1Tag) {
    console.log('✅ v1.0.0 tag EXISTS in Git');
  } else {
    console.log('❌ v1.0.0 tag MISSING from Git');
    console.log('💡 This is the problem - app shows v1.0.0 but Git has no tag');
  }
} catch (error) {
  console.log('❌ Error checking v1.0.0 tag');
}

console.log('');
console.log('🎯 SOLUTION OPTIONS:');
console.log('');
console.log('Option A: CREATE MISSING TAG (Recommended)');
console.log('  git tag v1.0.0');
console.log('  git push --tags');
console.log('  → This syncs Git with your app state');
console.log('');
console.log('Option B: RESET APP VERSION');
console.log('  → Manually reset app to v0.0.0 and let semantic-release start fresh');
console.log('');
console.log('Option C: CREATE NEXT VERSION');
console.log('  → Next commit will create v1.1.0 (minor) or v2.0.0 (major)');
console.log('');
console.log('🚨 RECOMMENDATION: Use Option A to avoid conflicts');