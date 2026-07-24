import { useState } from 'react';

function Phase({ phase }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 'var(--gap-sm)' }}>
      <div
        onClick={() => setOpen(!open)}
        className="stat"
        style={{ cursor: 'pointer', fontWeight: 'var(--font-weight-semibold)' }}
      >
        <span>
          Phase {phase.number}: {phase.title}
        </span>
        <span className={`badge ${phase.status === 'done' ? '' : 'muted'}`}>{phase.status}</span>
      </div>
      {open && (
        <div style={{ paddingLeft: 'var(--space-4)', paddingTop: 'var(--gap-xs)' }}>
          <p className="empty-state">{phase.goal}</p>
          {phase.plans.map((plan) => (
            <div className="log-line" key={plan.id}>
              <span className={`badge ${plan.done ? '' : 'muted'}`} style={{ marginRight: 'var(--gap-sm)' }}>
                {plan.done ? 'done' : 'pending'}
              </span>
              {plan.id}: {plan.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RoadmapTree({ roadmap }) {
  if (!roadmap || roadmap.phases.length === 0) return <p className="empty-state">No roadmap data found.</p>;
  return (
    <div>
      {roadmap.phases.map((phase) => (
        <Phase key={phase.number} phase={phase} />
      ))}
    </div>
  );
}
