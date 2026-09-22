/**
 * PMT Flow - Frontend & Backend Syntax Verification Script
 * --------------------------------------------------------
 * Validates that all critical JavaScript files parse without any SyntaxErrors
 * before committing or deploying.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filesToCheck = [
  'public/js/db.js',
  'public/js/auth.js',
  'public/js/app.js',
  'public/js/userMgmt.js',
  'public/js/app.hooks.js'
];

console.log('🔍 Validating JavaScript syntax across frontend files...\n');

let hasError = false;

filesToCheck.forEach(relPath => {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${relPath}`);
    return;
  }

  const code = fs.readFileSync(fullPath, 'utf8');
  try {
    new vm.Script(code, { filename: relPath });
    console.log(`✅ [OK] ${relPath} (${(code.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    hasError = true;
    console.error(`\n❌ [SYNTAX ERROR] in ${relPath}:`);
    console.error(`   ${err.name}: ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split('\n');
      console.error(`   ${lines.slice(0, 4).join('\n   ')}`);
    }
    console.error('\n');
  }
});

if (hasError) {
  console.error('💥 Build aborted: Fix the syntax errors above before committing or deploying!\n');
  process.exit(1);
} else {
  console.log('\n🎉 All frontend JavaScript files passed syntax verification!\n');
}
