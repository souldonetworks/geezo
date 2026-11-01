const CHECKLIST_RE = /^- \[( |x|X)\] \*\*Phase (\d+(?:\.\d+)?): (.+?)\*\* - (.+)$/;
const PHASE_HEADER_RE = /^### Phase (\d+(?:\.\d+)?): (.+)$/;
const GOAL_RE = /^\*\*Goal\*\*:\s*(.+)$/;
const DEPENDS_RE = /^\*\*Depends on\*\*:\s*(.+)$/;
const REQUIREMENTS_RE = /^\*\*Requirements\*\*:\s*(.+)$/;
const PLAN_RE = /^- \[( |x|X)\] ([\w.]+-\d+): (.+)$/;

function parseRoadmap(markdown) {
  const lines = markdown.split('\n');
  const checklist = new Map();
  const phases = [];
  let current = null;
  let inCriteria = false;

  for (const line of lines) {
    const checklistMatch = CHECKLIST_RE.exec(line);
    if (checklistMatch) {
      const [, doneFlag, number, title, summary] = checklistMatch;
      checklist.set(number, { done: doneFlag.toLowerCase() === 'x', summary });
      continue;
    }

    const headerMatch = PHASE_HEADER_RE.exec(line);
    if (headerMatch) {
      if (current) phases.push(current);
      inCriteria = false;
      const [, number, title] = headerMatch;
      current = { number, title, goal: '', dependsOn: '', requirements: [], successCriteria: [], plans: [] };
      continue;
    }

    if (!current) continue;

    if (/^\*\*Success Criteria\*\*/.test(line)) { inCriteria = true; continue; }
    if (inCriteria) {
      const item = /^\s*(?:\d+[.)]|[-*])\s+(.+)$/.exec(line);
      if (item) { current.successCriteria.push(item[1].trim()); continue; }
      if (/^\s+\S/.test(line) && current.successCriteria.length) {
        current.successCriteria[current.successCriteria.length - 1] += " " + line.trim();
        continue;
      }
      if (!line.trim()) continue;
      inCriteria = false;
    }

    const goalMatch = GOAL_RE.exec(line);
    if (goalMatch) {
      current.goal = goalMatch[1];
      continue;
    }

    const dependsMatch = DEPENDS_RE.exec(line);
    if (dependsMatch) {
      current.dependsOn = dependsMatch[1];
      continue;
    }

    const requirementsMatch = REQUIREMENTS_RE.exec(line);
    if (requirementsMatch) {
      current.requirements = requirementsMatch[1]
        .replace(/[[\]]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }

    const planMatch = PLAN_RE.exec(line) || /^- \[( |x|X)\] ([\w.]+-\d+)-PLAN\.md\s+[—–-]\s+(.+)$/.exec(line);
    if (planMatch) {
      const [, doneFlag, id, title] = planMatch;
      current.plans.push({ id, title, done: doneFlag.toLowerCase() === 'x' });
      continue;
    }
  }
  if (current) phases.push(current);

  const merged = phases.map((phase) => {
    const entry = checklist.get(phase.number);
    return {
      ...phase,
      status: entry && entry.done ? 'done' : 'pending',
      summary: entry ? entry.summary : '',
    };
  });

  return { phases: merged };
}

module.exports = { parseRoadmap };
