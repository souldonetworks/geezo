import { useState } from 'react';

function Phase({ phase }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
        {phase.status === 'done' ? '[x]' : '[ ]'} Phase {phase.number}: {phase.title}
      </div>
      {open && (
        <div style={{ paddingLeft: '1.5rem' }}>
          <p>{phase.goal}</p>
          <ul>
            {phase.plans.map((plan) => (
              <li key={plan.id}>
                {plan.done ? '[x]' : '[ ]'} {plan.id}: {plan.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function RoadmapTree({ roadmap }) {
  if (!roadmap || roadmap.phases.length === 0) return <p>No roadmap data found.</p>;
  return (
    <div>
      {roadmap.phases.map((phase) => (
        <Phase key={phase.number} phase={phase} />
      ))}
    </div>
  );
}
