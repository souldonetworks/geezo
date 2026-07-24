import { useEffect, useState, useCallback } from 'react';
import { listProjects, removeProject } from '../api';
import ProjectCard from '../components/ProjectCard';
import AddProjectDialog from '../components/AddProjectDialog';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);

  const refresh = useCallback(() => {
    listProjects().then(setProjects);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRemove(id) {
    await removeProject(id);
    refresh();
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>GSD Projects</h1>
      <AddProjectDialog onAdded={refresh} />
      {projects.length === 0 ? (
        <p>No projects yet. Add one above.</p>
      ) : (
        projects.map((project) => <ProjectCard key={project.id} project={project} onRemove={handleRemove} />)
      )}
    </div>
  );
}
