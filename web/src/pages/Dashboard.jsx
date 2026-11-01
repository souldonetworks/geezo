import { useEffect, useState, useCallback } from "react";
import { listProjects, removeProject, discoverProjects } from "../api";
import AnalysisPanel from "../components/AnalysisPanel";
import ProjectCard from "../components/ProjectCard";
import AddProjectDialog from "../components/AddProjectDialog";
import ScanFolderPanel from "../components/ScanFolderPanel";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
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
        {error && <p role="alert">{error}</p>}
        <div className="card inline-row">
          <input
            className="input"
            aria-label="Search projects"
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input"
            aria-label="Project filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">all projects</option>
            <option value="none">GSD not adopted</option>
            <option value="gsd">GSD adopted</option>
            <option value="unavailable">unavailable</option>
            <option value="unassessed">unassessed</option>
            <option value="stale">stale briefs</option>
          </select>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await discoverProjects();
                refresh();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            discover folders
          </button>
        </div>
        <AnalysisPanel onCompleted={refresh} />
        <AddProjectDialog onAdded={refresh} />
        <ScanFolderPanel onAdded={refresh} />
        {projects.length === 0 ? (
          <p className="empty-state">No projects yet. Add one above.</p>
        ) : (
          <div className="card-grid">
            {projects
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .filter(
                (p) =>
                  filter === "all" ||
                  (filter === "none"
                    ? p.gsdFormat === "none"
                    : filter === "gsd"
                      ? p.gsdFormat !== "none"
                      : filter === "unassessed"
                        ? !p.brief
                        : filter === "stale"
                          ? p.brief?.freshness === "stale"
                          : p.availability === "unavailable"),
              )
              .map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onRemove={handleRemove}
                />
              ))}
          </div>
        )}
      </div>
    </>
  );
}
