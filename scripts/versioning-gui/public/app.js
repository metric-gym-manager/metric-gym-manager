// Version Manager Frontend

let currentStatus = null;
let currentCommits = [];
let currentChangelog = '';

// ============================================================================
// API Calls
// ============================================================================

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function loadStatus() {
  try {
    const data = await fetchJSON('/api/status');
    currentStatus = data;
    renderStatus(data);
  } catch (error) {
    console.error('Failed to load status:', error);
    document.getElementById('status-loading').textContent = 'Error loading status';
  }
}

async function loadCommits() {
  try {
    const data = await fetchJSON('/api/commits');
    currentCommits = data.commits;
    renderCommits(data.commits);
  } catch (error) {
    console.error('Failed to load commits:', error);
    document.getElementById('commits-loading').textContent = 'Error loading commits';
  }
}

async function loadHistory() {
  try {
    const data = await fetchJSON('/api/history');
    renderHistory(data.history);
  } catch (error) {
    console.error('Failed to load history:', error);
    document.getElementById('history-loading').textContent = 'Error loading history';
  }
}

async function loadChangelog() {
  try {
    const data = await fetchJSON('/api/changelog');
    currentChangelog = data.content;
    renderChangelog(data.content);
  } catch (error) {
    console.error('Failed to load changelog:', error);
    document.getElementById('changelog-loading').textContent = 'Error loading changelog';
  }
}

async function performRelease(bumpType, changelogContent, createTag) {
  const response = await fetch('/api/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bumpType, changelogContent, createTag })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Release failed');
  }

  return data;
}

// ============================================================================
// Rendering Functions
// ============================================================================

function renderStatus(data) {
  document.getElementById('status-loading').style.display = 'none';
  document.getElementById('status-content').style.display = 'block';

  document.getElementById('current-version').textContent = data.currentVersion;
  document.getElementById('last-tag').textContent = data.lastTag || 'none';
  document.getElementById('branch').textContent = data.repository.branch;

  const uncommitted = document.getElementById('uncommitted');
  if (data.repository.hasUncommitted) {
    uncommitted.textContent = `${data.repository.uncommittedFiles} ⚠️`;
    uncommitted.style.color = '#e53e3e';
  } else {
    uncommitted.textContent = '0 ✓';
    uncommitted.style.color = '#38a169';
  }

  document.getElementById('commits-count').textContent = data.commitsSinceLastTag;

  const suggestedBump = document.getElementById('suggested-bump');
  suggestedBump.textContent = data.suggestedBump || 'none';
  suggestedBump.className = `value badge ${data.suggestedBump || 'none'}`;
}

function renderCommits(commits) {
  document.getElementById('commits-loading').style.display = 'none';
  document.getElementById('commits-content').style.display = 'block';

  // Count by type
  let breaking = 0, features = 0, fixes = 0, other = 0;

  commits.forEach(commit => {
    if (commit.breaking) breaking++;
    else if (commit.type === 'feat') features++;
    else if (commit.type === 'fix') fixes++;
    else other++;
  });

  document.getElementById('stat-breaking').textContent = breaking;
  document.getElementById('stat-features').textContent = features;
  document.getElementById('stat-fixes').textContent = fixes;
  document.getElementById('stat-other').textContent = other;

  // Render commit list
  const commitsList = document.getElementById('commits-list');
  commitsList.innerHTML = '';

  if (commits.length === 0) {
    commitsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #a0aec0;">No commits since last release</div>';
    return;
  }

  commits.forEach(commit => {
    const item = document.createElement('div');
    item.className = 'commit-item';

    let typeClass = commit.type;
    if (commit.breaking) typeClass = 'breaking';

    let typeLabel = commit.type;
    if (commit.breaking) typeLabel = 'breaking';

    item.innerHTML = `
      <div class="commit-type ${typeClass}">${typeLabel}</div>
      <div class="commit-message">
        ${commit.scope ? `<span class="commit-scope">${commit.scope}:</span> ` : ''}
        ${escapeHtml(commit.message)}
      </div>
    `;

    commitsList.appendChild(item);
  });
}

function renderHistory(history) {
  document.getElementById('history-loading').style.display = 'none';
  document.getElementById('history-content').style.display = 'block';

  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.innerHTML = '<div style="padding: 20px; text-align: center; color: #a0aec0;">No version history yet</div>';
    return;
  }

  history.forEach(version => {
    const item = document.createElement('div');
    item.className = 'history-item';

    item.innerHTML = `
      <h3>${version.tag}</h3>
      <div class="date">${version.date}</div>
      <div class="message">${escapeHtml(version.message || 'No release notes')}</div>
    `;

    historyList.appendChild(item);
  });
}

function renderChangelog(content) {
  document.getElementById('changelog-loading').style.display = 'none';
  document.getElementById('changelog-content').style.display = 'block';

  const preview = document.getElementById('changelog-preview');
  preview.textContent = content || 'No changelog yet';
}

// ============================================================================
// Form Handling
// ============================================================================

function setupFormHandlers() {
  const bumpTypeSelect = document.getElementById('bump-type');
  const versionPreview = document.getElementById('version-preview');
  const releaseBtn = document.getElementById('release-btn');

  // Update version preview when bump type changes
  bumpTypeSelect.addEventListener('change', (e) => {
    const bumpType = e.target.value;

    if (!bumpType || !currentStatus) {
      versionPreview.textContent = '';
      releaseBtn.disabled = true;
      return;
    }

    const [major, minor, patch] = currentStatus.currentVersion.split('.').map(Number);
    let newVersion;

    switch (bumpType) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }

    versionPreview.textContent = `${currentStatus.currentVersion} → ${newVersion}`;
    releaseBtn.disabled = false;

    // Auto-generate changelog preview
    generateChangelogPreview(bumpType, newVersion);
  });

  // Release button
  releaseBtn.addEventListener('click', async () => {
    const bumpType = bumpTypeSelect.value;
    const createTag = document.getElementById('create-tag').checked;
    const changelogContent = document.getElementById('changelog-edit').value;

    if (!bumpType) {
      showResult('error', 'Please select a version bump type');
      return;
    }

    if (!confirm(`Release new ${bumpType} version?\n\nThis will:\n- Update package.json\n- Regenerate PWA assets\n- Update CHANGELOG.md${createTag ? '\n- Create git tag' : ''}`)) {
      return;
    }

    releaseBtn.disabled = true;
    releaseBtn.textContent = 'Releasing...';

    try {
      const result = await performRelease(bumpType, changelogContent, createTag);

      showResult('success',
        `✅ Released ${result.newVersion}!\n\n` +
        `Version: ${result.oldVersion} → ${result.newVersion}\n` +
        (result.tag ? `Tag: ${result.tag}\n` : '') +
        `\nNext steps:\n` +
        `1. Review changes in package.json and CHANGELOG.md\n` +
        `2. Commit: git add . && git commit -m "chore: release ${result.newVersion}"\n` +
        (result.tag ? `3. Push with tags: git push origin main --tags` : `3. Push: git push origin main`)
      );

      // Reload data
      setTimeout(() => {
        location.reload();
      }, 3000);

    } catch (error) {
      showResult('error', `❌ Release failed: ${error.message}`);
      releaseBtn.disabled = false;
      releaseBtn.textContent = 'Release New Version';
    }
  });

  // Regenerate changelog button
  document.getElementById('regenerate-changelog').addEventListener('click', () => {
    const bumpType = bumpTypeSelect.value;
    if (!bumpType) {
      alert('Please select a bump type first');
      return;
    }

    const [major, minor, patch] = currentStatus.currentVersion.split('.').map(Number);
    let newVersion;

    switch (bumpType) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }

    generateChangelogPreview(bumpType, newVersion);
  });
}

function generateChangelogPreview(bumpType, newVersion) {
  const today = new Date().toISOString().split('T')[0];

  let changelog = `## [${newVersion}] - ${today}\n\n`;

  // Group commits
  const breaking = currentCommits.filter(c => c.breaking);
  const features = currentCommits.filter(c => !c.breaking && c.type === 'feat');
  const fixes = currentCommits.filter(c => c.type === 'fix');
  const perf = currentCommits.filter(c => c.type === 'perf');

  if (breaking.length > 0) {
    changelog += `### ⚠️ BREAKING CHANGES\n\n`;
    breaking.forEach(c => {
      changelog += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.message}\n`;
    });
    changelog += '\n';
  }

  if (features.length > 0) {
    changelog += `### Added\n\n`;
    features.forEach(c => {
      changelog += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.message}\n`;
    });
    changelog += '\n';
  }

  if (fixes.length > 0) {
    changelog += `### Fixed\n\n`;
    fixes.forEach(c => {
      changelog += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.message}\n`;
    });
    changelog += '\n';
  }

  if (perf.length > 0) {
    changelog += `### Performance\n\n`;
    perf.forEach(c => {
      changelog += `- ${c.scope ? `**${c.scope}**: ` : ''}${c.message}\n`;
    });
    changelog += '\n';
  }

  document.getElementById('changelog-edit').value = changelog;
}

function showResult(type, message) {
  const resultEl = document.getElementById('release-result');
  resultEl.className = `result ${type}`;
  resultEl.textContent = message;
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Initialize
// ============================================================================

async function init() {
  console.log('🚀 Version Manager GUI loaded');

  // Load all data
  await Promise.all([
    loadStatus(),
    loadCommits(),
    loadHistory(),
    loadChangelog()
  ]);

  // Setup form handlers
  setupFormHandlers();

  console.log('✅ All data loaded');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
