#!/usr/bin/env node

/**
 * Version Manager GUI Server
 *
 * Provides a local web interface for managing versions and release notes.
 * Launches on http://localhost:3001
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const url = require('url');

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ROOT_DIR = path.join(__dirname, '../..');

const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');

// Load helper scripts
const versionBump = require('../version-bump.js');
const changelog = require('../generate-changelog.js');

// ============================================================================
// Utility Functions
// ============================================================================

function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', cwd: ROOT_DIR }).trim();
  } catch (error) {
    return '';
  }
}

function getRepositoryInfo() {
  const branch = execCommand('git rev-parse --abbrev-ref HEAD');
  const status = execCommand('git status --porcelain');
  const hasUncommitted = status.length > 0;

  return {
    branch,
    hasUncommitted,
    uncommittedFiles: status.split('\n').filter(Boolean).length
  };
}

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  return packageJson.version;
}

function getVersionHistory() {
  const tags = execCommand('git tag --sort=-version:refname')
    .split('\n')
    .filter(tag => tag.match(/^v?\d+\.\d+\.\d+$/));

  return tags.map(tag => {
    const version = tag.replace(/^v/, '');
    const date = execCommand(`git log -1 --format=%ai ${tag}`).split(' ')[0];
    const message = execCommand(`git tag -l --format="%(contents)" ${tag}`);

    return { version, tag, date, message };
  });
}

function getCommitsSinceLastTag() {
  const lastTag = versionBump.getLastVersionTag();
  const commits = versionBump.getCommitsSinceTag(lastTag);

  return commits.map(subject => {
    // Parse commit to extract type, scope, message
    const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)/);

    if (match) {
      const [, type, scope, breaking, message] = match;
      return {
        type,
        scope: scope || null,
        breaking: !!breaking,
        message,
        original: subject
      };
    }

    return {
      type: 'other',
      scope: null,
      breaking: false,
      message: subject,
      original: subject
    };
  });
}

function getChangelogContent() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return '';
  }
  return fs.readFileSync(CHANGELOG_PATH, 'utf8');
}

// ============================================================================
// API Handlers
// ============================================================================

const apiHandlers = {
  '/api/status': (req, res) => {
    const currentVersion = getCurrentVersion();
    const repo = getRepositoryInfo();
    const lastTag = versionBump.getLastVersionTag();
    const commits = getCommitsSinceLastTag();
    const analysis = versionBump.analyzeCommits(commits.map(c => c.original));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      currentVersion,
      lastTag,
      repository: repo,
      commitsSinceLastTag: commits.length,
      suggestedBump: analysis.bumpType,
      analysis: {
        breaking: analysis.breaking.length,
        features: analysis.features.length,
        fixes: analysis.fixes.length,
        other: analysis.others.length
      }
    }));
  },

  '/api/commits': (req, res) => {
    const commits = getCommitsSinceLastTag();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ commits }));
  },

  '/api/history': (req, res) => {
    const history = getVersionHistory();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ history }));
  },

  '/api/changelog': (req, res) => {
    const content = getChangelogContent();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content }));
  },

  '/api/release': (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { bumpType, changelogContent, createTag } = JSON.parse(body);

        // Validate bump type
        if (!['major', 'minor', 'patch'].includes(bumpType)) {
          throw new Error('Invalid bump type');
        }

        const currentVersion = getCurrentVersion();
        const newVersion = versionBump.bumpVersion(currentVersion, bumpType);

        // Update package.json
        versionBump.updatePackageJson(newVersion);

        // Update changelog if provided
        if (changelogContent) {
          fs.writeFileSync(CHANGELOG_PATH, changelogContent);
        } else {
          // Auto-generate changelog
          execCommand('node scripts/generate-changelog.js');
        }

        // Regenerate PWA assets
        versionBump.regeneratePWAAssets();

        // Create git tag if requested
        let tag = null;
        if (createTag) {
          tag = versionBump.createGitTag(newVersion);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          oldVersion: currentVersion,
          newVersion,
          tag
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
  }
};

// ============================================================================
// HTTP Server
// ============================================================================

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle API routes
  if (apiHandlers[pathname]) {
    try {
      apiHandlers[pathname](req, res);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Serve static files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Determine content type
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json'
  };
  const contentType = contentTypes[ext] || 'text/plain';

  // Read and serve file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

// ============================================================================
// Start Server
// ============================================================================

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   Version Manager GUI                     ║
╚═══════════════════════════════════════════╝

🌐 Server running at: http://localhost:${PORT}

📊 Features:
  - View current version and commit history
  - Analyze commits since last release
  - Generate and edit release notes
  - Bump version (major/minor/patch)
  - Create git tags

Press Ctrl+C to stop the server
`);

  // Attempt to open browser (cross-platform)
  const openCommand =
    process.platform === 'win32' ? 'start' :
    process.platform === 'darwin' ? 'open' :
    'xdg-open';

  try {
    execSync(`${openCommand} http://localhost:${PORT}`, { stdio: 'ignore' });
  } catch (error) {
    // Silently fail if browser doesn't open
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
