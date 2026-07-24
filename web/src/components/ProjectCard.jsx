import { Link } from 'react-router-dom';

export default function ProjectCard({ project, onRemove }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
      <h3>
        <Link to={`/project/${project.id}`}>{project.name}</Link>
      </h3>
      <div>Progress: {project.progress.percent}%</div>
      <div>Current phase: {project.progress.currentPhase || 'n/a'}</div>
      <div>
        Milestone:{' '}
        {project.git.status === 'ok'
          ? `${project.git.tag} (${project.git.message})`
          : project.git.status.replace(/-/g, ' ')}
      </div>
      {project.runningCount > 0 && <div>{project.runningCount} agent(s) running</div>}
      <button onClick={() => onRemove(project.id)}>Remove</button>
    </div>
  );
}
