import { useEffect, useState, useCallback } from 'react';
import { listProjects, removeProject } from '../api';
import ProjectCard from '../components/ProjectCard';
import AddProjectDialog from '../components/AddProjectDialog';
import ScanFolderPanel from '../components/ScanFolderPanel';

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
    <>
      <div className="page-header">
        <h1>projects</h1>
      </div>
      <div className="page-content">
        <AddProjectDialog onAdded={refresh} />
        <ScanFolderPanel onAdded={refresh} />
        {projects.length === 0 ? (
          <p className="empty-state">No projects yet. Add one above.</p>
        ) : (
          <div className="card-grid">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
