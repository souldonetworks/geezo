import { Link } from "react-router-dom";

function gitBadge(git) {
  if (git.status === "ok") return { label: `${git.tag}`, variant: "" };
  if (git.status === "not-a-repo")
    return { label: "not a repo", variant: "muted" };
  if (git.status === "no-remote")
    return { label: "no remote", variant: "muted" };
  return { label: "no tags", variant: "muted" };
}

export default function ProjectCard({ project, onRemove }) {
  const git = gitBadge(project.git);

  return (
    <div className="card">
      <h3>
        <Link to={`/project/${project.id}`}>{project.name}</Link>
        {project.runningCount > 0 && (
          <span className="badge">{project.runningCount} running</span>
        )}
      </h3>

      {project.inspectionError && (
        <p role="alert">Inspection error: {project.inspectionError}</p>
      )}
      {project.discoveryRootError && (
        <p role="alert">
          Discovery root unavailable: {project.discoveryRootError}
        </p>
      )}
      <div className="stat">
        <span>phase</span>
        <span className="stat-val">
          {project.progress?.currentPhase ||
            (project.availability !== "available"
              ? project.availability
              : "GSD not adopted")}
        </span>
      </div>
      {project.progress && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${project.progress.percent}%` }}
          />
        </div>
      )}
      <p className="muted">
        {project.brief?.recommendation || "unassessed"} ·{" "}
        {project.brief?.freshness || "no brief"}
      </p>

      <div className="stat" style={{ marginTop: "var(--gap-sm)" }}>
        <span>milestone</span>
        <span className={`badge ${git.variant}`}>{git.label}</span>
      </div>

      <button
        className="btn btn-ghost"
        style={{ marginTop: "var(--gap-sm)", padding: "4px 8px" }}
        onClick={() => onRemove(project.id)}
      >
        remove
      </button>
    </div>
  );
}
