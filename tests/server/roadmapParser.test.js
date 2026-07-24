const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('parseRoadmap extracts phases, status, and plans', () => {
  const { parseRoadmap } = require('../../server/lib/roadmapParser');
  const md = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'roadmap-sample.md'), 'utf8');
  const result = parseRoadmap(md);

  assert.equal(result.phases.length, 2);

  const phase1 = result.phases[0];
  assert.equal(phase1.number, '1');
  assert.equal(phase1.title, 'Project Scaffold');
  assert.equal(phase1.status, 'done');
  assert.equal(phase1.goal, 'Basic scaffold works end to end.');
  assert.equal(phase1.dependsOn, 'Nothing (first phase)');
  assert.deepEqual(phase1.requirements, ['FR-1.1', 'FR-1.2']);
  assert.equal(phase1.plans.length, 2);
  assert.deepEqual(phase1.plans[0], { id: '01-01', title: 'Repo structure — create directories', done: true });

  const phase2 = result.phases[1];
  assert.equal(phase2.status, 'pending');
  assert.equal(phase2.plans[1].done, false);
});
