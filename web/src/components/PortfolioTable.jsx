import { Link } from "react-router-dom";
export function Status({ children, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}
export function Stats({ items }) {
  return (
    <div className="metric-grid">
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <span className="metric-label">{item.label}</span>
          <strong>{item.value}</strong>
          <span className="metric-note">{item.note}</span>
        </div>
      ))}
    </div>
  );
}
export default function PortfolioTable({
  projects,
  briefings = false,
  onRemove,
  onCategoryChange,
}) {
  return (
    <div className="table-wrap">
      <table className="portfolio-table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">{briefings ? "Recommendation" : "Delivery"}</th>
            <th scope="col">
              {briefings ? "Review status" : "Executive brief"}
            </th>
            <th scope="col">{briefings ? "Evidence" : "Activity"}</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const job = project.analysis;
            const active = job && ["running", "queued"].includes(job.status);
            const recommendation = project.brief?.recommendation;
            const href = `/project/${project.id}${briefings ? "#executive-brief" : ""}`;
            return (
              <tr key={project.id}>
                <td>
                  <Link className="project-link" to={href}>
                    {project.name}
                    <span aria-hidden="true">↗</span>
                  </Link>
                  <span className="project-meta">
                    {project.availability !== "available"
                      ? "Folder unavailable"
                      : project.gsdFormat === "none"
                        ? "Independent project"
                        : project.gsdFormat === "database"
                          ? "GSD database"
                          : "GSD planning"}
                  </span>
                  <div className="project-topics">
                    <span
                      className={`category-label ${project.category || "unclassified"}`}
                    >
                      {project.category || "unclassified"}
                    </span>
                    {(project.allTags || []).slice(0, 4).map((tag) => (
                      <Link
                        className={`mini-tag ${(project.tags || []).includes(tag) ? "manual" : "suggested"}`}
                        title={
                          (project.tags || []).includes(tag)
                            ? "User tag"
                            : "Suggested from assessment"
                        }
                        key={tag}
                        to={`/discover?q=${encodeURIComponent(tag)}`}
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                  {onCategoryChange && (
                    <select
                      className="category-select"
                      aria-label={`Classify ${project.name}`}
                      value={project.category || "unclassified"}
                      onChange={(e) =>
                        onCategoryChange(project, e.target.value)
                      }
                    >
                      <option value="unclassified">Set personal / work</option>
                      <option value="personal">Personal</option>
                      <option value="work">Work</option>
                    </select>
                  )}
                  {project.inspectionError && (
                    <span className="row-error">
                      Inspection requires attention
                    </span>
                  )}
                </td>
                <td>
                  {briefings ? (
                    <Status
                      tone={
                        recommendation === "Stop"
                          ? "danger"
                          : recommendation === "Rework"
                            ? "warning"
                            : recommendation
                              ? "accent"
                              : "neutral"
                      }
                    >
                      {recommendation || "Not assessed"}
                    </Status>
                  ) : project.progress ? (
                    <>
                      <span className="delivery-percent">
                        {project.progress.percent}%
                      </span>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${project.progress.percent}%` }}
                        />
                      </div>
                      <span className="project-meta">
                        {project.progress.currentPhase || "Planning"}
                      </span>
                    </>
                  ) : (
                    <span className="muted">
                      {project.availability === "available"
                        ? "GSD not adopted"
                        : "Unavailable"}
                    </span>
                  )}
                </td>
                <td>
                  {briefings ? (
                    <>
                      <Status
                        tone={
                          project.brief?.acceptedRevision
                            ? "success"
                            : project.brief
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {project.brief?.acceptedRevision
                          ? "Accepted"
                          : project.brief
                            ? "Draft · needs review"
                            : "No brief yet"}
                      </Status>
                      {project.hasPendingDraft &&
                        project.brief?.acceptedRevision && (
                          <span className="project-meta">
                            New draft available
                          </span>
                        )}
                      {project.draftSource === "import" && (
                        <span className="project-meta">Imported research</span>
                      )}
                    </>
                  ) : (
                    <Status tone={recommendation ? "accent" : "neutral"}>
                      {recommendation || "Awaiting assessment"}
                    </Status>
                  )}
                </td>
                <td>
                  {briefings ? (
                    <>
                      <span className="project-meta evidence-state">
                        {project.brief?.freshness === "fresh"
                          ? "Sources unchanged"
                          : project.brief?.freshness === "stale"
                            ? "Sources changed"
                            : project.brief
                              ? "Review evidence freshness"
                              : "—"}
                      </span>
                      {job && (
                        <Status
                          tone={
                            ["failed", "blocked"].includes(job.status)
                              ? "danger"
                              : active
                                ? "info"
                                : "neutral"
                          }
                        >
                          {active
                            ? `Assessment ${job.status}`
                            : job.status === "completed"
                              ? "Assessment complete"
                              : job.status}
                        </Status>
                      )}
                    </>
                  ) : (
                    <Status
                      tone={active || project.runningCount ? "info" : "neutral"}
                    >
                      {active
                        ? `Assessment ${job.status}`
                        : project.runningCount
                          ? `${project.runningCount} agents`
                          : "Idle"}
                    </Status>
                  )}
                  {["failed", "blocked"].includes(job?.status) && (
                    <span className="row-error" title={job.error}>
                      {job.error?.slice(0, 150)}
                    </span>
                  )}
                </td>
                <td className="table-actions">
                  <Link
                    className="table-open"
                    aria-label={`Open ${project.name}`}
                    to={href}
                  >
                    View <span aria-hidden="true">→</span>
                  </Link>
                  {onRemove && (
                    <button
                      className="icon-button"
                      aria-label={`Remove ${project.name} from portfolio`}
                      title="Remove from portfolio"
                      onClick={() => onRemove(project.id)}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {projects.length === 0 && (
        <p className="empty-state table-empty">
          No projects match these filters.
        </p>
      )}
    </div>
  );
}
