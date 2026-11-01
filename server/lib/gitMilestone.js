const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function git(repoPath, args) {
  return execFileSync('git', args, { cwd: repoPath }).toString().trim();
}

function getMilestone(repoPath) {
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    return { status: 'not-a-repo' };
  }

  let upstream;
  try {
    upstream = git(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  } catch {
    return { status: 'no-remote' };
  }

  let tagLines;
  try {
    tagLines = git(repoPath, [
      'for-each-ref',
      '--sort=-creatordate',
      '--format=%(refname:short)%00%(creatordate:iso-strict)%00%(contents:subject)',
      'refs/tags',
    ]);
  } catch {
    tagLines = '';
  }

  if (!tagLines) return { status: 'no-tags' };

  for (const line of tagLines.split('\n').filter(Boolean)) {
    const [tag, date, message] = line.split('\0');
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', `refs/tags/${tag}`, upstream], { cwd: repoPath });
      const commitSha = git(repoPath, ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]);
      return { status: 'ok', tag, date, message, commitSha };
    } catch {
      continue;
    }
  }

  return { status: 'no-tags' };
}

module.exports = { getMilestone };
