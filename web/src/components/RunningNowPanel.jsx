import { useEffect, useState } from 'react';
import { subscribeActivity } from '../api';

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default function RunningNowPanel({ projectId }) {
  const [running, setRunning] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeActivity(projectId, setRunning);
    return unsubscribe;
  }, [projectId]);

  if (running.length === 0) return <p>Idle — no subagents currently running.</p>;

  return (
    <ul>
      {running.map((agent) => (
        <li key={`${agent.agentType}-${agent.startedAt}`}>
          <strong>{agent.agentType}</strong>: {agent.description} ({formatElapsed(agent.elapsedMs)})
        </li>
      ))}
    </ul>
  );
}
