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

test('success criteria retain numbered items, continuations and phase boundaries', () => {
  const {parseRoadmap} = require('../../server/lib/roadmapParser');
  const result = parseRoadmap(`### Phase 1: First
**Success Criteria** (what must be TRUE):
  1. A user can select a folder
     and inspect its path.
  2. Registration is explicit.
**Plans**: 1 plan
- [ ] 01-01: Implement
### Phase 2: Second
**Success Criteria**:
- Keep phase data separate.
## Progress
1. Not a criterion.`);
  assert.deepEqual(result.phases[0].successCriteria, ['A user can select a folder and inspect its path.', 'Registration is explicit.']);
  assert.deepEqual(result.phases[1].successCriteria, ['Keep phase data separate.']);
});

test('roadmap plan-file checklist entries are retained alongside success criteria', () => {
  const {parseRoadmap} = require('../../server/lib/roadmapParser');
  const result=parseRoadmap('### Phase 07.1: Closure\n**Success Criteria**:\n1. It works.\n**Plans**: 1\n- [x] 07.1-01-PLAN.md — Close the gaps');
  assert.deepEqual(result.phases[0].plans,[{id:'07.1-01',title:'Close the gaps',done:true}]);
});
