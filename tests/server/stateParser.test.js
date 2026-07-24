const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('parseState extracts frontmatter and current position', () => {
  const { parseState } = require('../../server/lib/stateParser');
  const md = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'state-sample.md'), 'utf8');
  const result = parseState(md);

  assert.equal(result.milestone, 'v1.0');
  assert.equal(result.status, 'executing');
  assert.equal(result.progress.percent, 89);
  assert.equal(result.progress.completed_plans, 8);
  assert.equal(result.stoppedAt, 'context exhaustion at 91% (2026-04-16)');
  assert.equal(result.currentPhase, '02 (test-pattern-catalog) — EXECUTING');
  assert.equal(result.currentStatus, 'Executing Phase 02');
});
