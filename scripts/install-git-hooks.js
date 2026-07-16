#!/usr/bin/env node

/**
 * Install Git Hooks
 *
 * Copies hook scripts from scripts/hooks/ to .git/hooks/
 * and makes them executable.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOOKS_SOURCE_DIR = path.join(__dirname, 'hooks');
const HOOKS_TARGET_DIR = path.join(__dirname, '../.git/hooks');

const HOOKS = ['pre-commit', 'commit-msg', 'post-merge'];

console.log('📦 Installing Git Hooks...\n');

// Check if .git directory exists
if (!fs.existsSync(path.join(__dirname, '../.git'))) {
  console.error('❌ Error: .git directory not found');
  console.error('   Make sure you are running this from a git repository');
  process.exit(1);
}

// Create hooks directory if it doesn't exist
if (!fs.existsSync(HOOKS_TARGET_DIR)) {
  fs.mkdirSync(HOOKS_TARGET_DIR, { recursive: true });
}

let installed = 0;
let skipped = 0;

HOOKS.forEach(hookName => {
  const sourcePath = path.join(HOOKS_SOURCE_DIR, hookName);
  const targetPath = path.join(HOOKS_TARGET_DIR, hookName);

  if (!fs.existsSync(sourcePath)) {
    console.log(`⚠️  Skipping ${hookName}: source file not found`);
    skipped++;
    return;
  }

  // Copy hook file
  fs.copyFileSync(sourcePath, targetPath);

  // Make executable (Unix-like systems)
  if (process.platform !== 'win32') {
    try {
      execSync(`chmod +x "${targetPath}"`);
    } catch (error) {
      console.warn(`⚠️  Failed to make ${hookName} executable:`, error.message);
    }
  }

  console.log(`✅ Installed: ${hookName}`);
  installed++;
});

console.log(`\n📊 Summary:`);
console.log(`   Installed: ${installed}`);
if (skipped > 0) {
  console.log(`   Skipped: ${skipped}`);
}

console.log(`\n✨ Git hooks installed successfully!\n`);
console.log(`Active hooks:`);
console.log(`   pre-commit  - Runs lint-staged (eslint --fix, prettier, related tests)`);
console.log(`   commit-msg  - Validates commit message format`);
console.log(`   post-merge  - Generates draft changelog after merge\n`);

console.log(`💡 Tip: To bypass hooks (not recommended):`);
console.log(`   git commit --no-verify\n`);
