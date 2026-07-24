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
      '--format=%(refname:short)|%(creatordate:iso-strict)|%(contents:subject)|%(objectname)',
      'refs/tags',
    ]);
  } catch {
    tagLines = '';
  }

  if (!tagLines) return { status: 'no-tags' };

  for (const line of tagLines.split('\n').filter(Boolean)) {
    const [tag, date, message, commitSha] = line.split('|');
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', tag, upstream], { cwd: repoPath });
      return { status: 'ok', tag, date, message, commitSha };
    } catch {
      continue;
    }
  }

  return { status: 'no-tags' };
}

module.exports = { getMilestone };
