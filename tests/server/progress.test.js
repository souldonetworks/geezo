const test = require('node:test');
const assert = require('node:assert/strict');

test('computeProgress prefers state.progress.percent when present', () => {
  const { computeProgress } = require('../../server/lib/progress');
  const roadmap = { phases: [{ number: '1', title: 'A', status: 'done', plans: [{ done: true }] }] };
  const state = { status: 'executing', currentPhase: '02', progress: { percent: 89 } };

  const result = computeProgress(roadmap, state);
  assert.equal(result.percent, 89);
  assert.equal(result.currentPhase, '02');
  assert.equal(result.status, 'executing');
  assert.equal(result.source, 'state');
});

test('computeProgress falls back to roadmap checkbox counts when state is null', () => {
  const { computeProgress } = require('../../server/lib/progress');
  const roadmap = {
    phases: [
      { number: '1', title: 'A', status: 'done', plans: [{ done: true }, { done: true }] },
      { number: '2', title: 'B', status: 'pending', plans: [{ done: false }] },
    ],
  };

  const result = computeProgress(roadmap, null);
  assert.equal(result.percent, 67);
  assert.equal(result.currentPhase, 'Phase 2: B');
  assert.equal(result.status, 'unknown');
  assert.equal(result.source, 'roadmap-fallback');
});

test('computeProgress reports completion when all phases are done', () => {
  const { computeProgress } = require('../../server/lib/progress');
  const roadmap = { phases: [{ number: '1', title: 'A', status: 'done', plans: [{ done: true }] }] };

  const result = computeProgress(roadmap, null);
  assert.equal(result.percent, 100);
  assert.equal(result.currentPhase, 'All phases complete');
});
