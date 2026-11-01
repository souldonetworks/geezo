import { useEffect, useState, useRef } from 'react';
import { subscribeActivity } from '../api';

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default function RunningNowPanel({ projectId, onCompleted }) {
  const [running, setRunning] = useState([]);

  const completedRef = useRef(onCompleted);
  completedRef.current = onCompleted;
  useEffect(() => {
    let live = true;
    let previous = null;
    setRunning([]);
    const unsubscribe = subscribeActivity(projectId, (entries) => {
      if (!live) return;
      const next = new Set(entries.map(a => JSON.stringify([a.sessionId, a.startedAt, a.agentType, a.description])));
      const finished = previous && [...previous].some(key => !next.has(key));
      previous = next;
      setRunning(entries);
      if (finished) completedRef.current?.();
    });
    return () => { live = false; unsubscribe(); };
  }, [projectId]);

  if (running.length === 0) return <p className="empty-state">Idle — no subagents currently running.</p>;

  return (
    <div>
      {running.map((agent) => (
        <div className="log-line" key={`${agent.agentType}-${agent.startedAt}`}>
          <strong style={{ color: 'var(--color-primary)' }}>{agent.agentType}</strong>: {agent.description} (
          {formatElapsed(agent.elapsedMs)})
        </div>
      ))}
    </div>
  );
}
