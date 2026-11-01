import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  listProjects,
  removeProject,
  discoverProjects,
  updateProjectMetadata,
  listAssessmentLenses,
} from "../api";
import PortfolioTable, { Stats } from "../components/PortfolioTable";
import AddProjectDialog from "../components/AddProjectDialog";
import ScanFolderPanel from "../components/ScanFolderPanel";
export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const lensFilter = params.get("lens") || "all";
  const [lenses, setLenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const refresh = useCallback(
    () =>
      listProjects()
        .then((data) => {
          setProjects(data);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    refresh();
    listAssessmentLenses()
      .then(setLenses)
      .catch((e) => setError(e.message));
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function remove(id) {
    try {
      await removeProject(id);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  async function discover() {
    setDiscovering(true);
    try {
      await discoverProjects();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setDiscovering(false);
    }
  }
  const filtered = projects
    .filter((p) =>
      (p.name + " " + (p.allTags || []).join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
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
                : p.availability !== "available"),
    );
  const visible = filtered
    .filter((p) => lensFilter === "all" || p.effectiveLens?.id === lensFilter)
    .filter((p) => category === "all" || p.category === category)
    .filter((p) => !tag || p.allTags?.includes(tag));
  const tags = [...new Set(projects.flatMap((p) => p.allTags || []))].sort();
  async function classify(project, value) {
    try {
      await updateProjectMetadata(project.id, {
        category: value,
        expectedVersion: project.metadataVersion,
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>
            Purpose meets <em>progress.</em>
          </h1>
          <p className="page-description">
            Every project in view. A clearer case for what comes next.
          </p>
        </div>
        <Link className="btn btn-primary" to="/briefings">
          Executive briefings <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="page-content">
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <Stats
          items={[
            {
              label: "Projects in view",
              value: projects.length,
              note: "Across your workspace",
            },
            {
              label: "GSD adopted",
              value: projects.filter((p) => p.gsdFormat !== "none").length,
              note: "Plans connected to delivery",
            },
            {
              label: "Executive briefs",
              value: projects.filter((p) => p.brief).length,
              note: "Evidence before investment",
            },
            {
              label: "Assessments active",
              value: projects.filter((p) =>
                ["queued", "running"].includes(p.analysis?.status),
              ).length,
              note: "Drafts, never automatic approval",
            },
          ]}
        />
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR PORTFOLIO</p>
            <h2>Work worth understanding.</h2>
          </div>
          <span className="result-count">
            {visible.length} of {projects.length} projects
          </span>
        </div>
        <div className="toolbar">
          <div className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              className="input"
              aria-label="Search projects"
              placeholder="Find a project…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input filter-select"
            aria-label="Project filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All projects</option>
            <option value="gsd">GSD adopted</option>
            <option value="none">GSD not adopted</option>
            <option value="unassessed">Awaiting assessment</option>
            <option value="stale">Changed evidence</option>
            <option value="unavailable">Unavailable folders</option>
          </select>
          <select
            className="input filter-select"
            aria-label="Personal or work filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Personal & work</option>
            <option value="personal">Personal</option>
            <option value="work">Work</option>
            <option value="unclassified">Unclassified</option>
          </select>
          <select
            className="input filter-select"
            aria-label="Project topic filter"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">All topics</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            className="input filter-select"
            aria-label="Assessment lens filter"
            value={lensFilter}
            onChange={(e) =>
              setParams(
                e.target.value === "all" ? {} : { lens: e.target.value },
              )
            }
          >
            <option value="all">All assessment lenses</option>
            {lenses.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            disabled={discovering}
            onClick={discover}
          >
            {discovering ? "Discovering…" : "Refresh discovery"}
          </button>
        </div>
        {loading ? (
          <p className="empty-state">Loading your portfolio…</p>
        ) : (
          <PortfolioTable
            projects={visible}
            onRemove={remove}
            onCategoryChange={classify}
          />
        )}
        <details className="management-panel">
          <summary>
            Manage project folders{" "}
            <span className="muted">
              Add a project or explore another directory
            </span>
          </summary>
          <div className="management-grid">
            <AddProjectDialog onAdded={refresh} />
            <ScanFolderPanel onAdded={refresh} />
          </div>
        </details>
        <footer className="page-footnote">
          <span className="status-dot" /> Discovery runs locally. Analysis and
          GSD adoption start when you choose.
        </footer>
      </div>
    </>
  );
}
