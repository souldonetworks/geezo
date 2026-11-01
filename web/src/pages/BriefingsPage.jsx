import { useEffect, useState, useCallback } from "react";
import {
  listBriefings,
  importAssessment,
  startPortfolioAnalysis,
  resumeAnalysis,
} from "../api";
import PortfolioTable, { Stats } from "../components/PortfolioTable";
import AnalysisPanel from "../components/AnalysisPanel";
export default function BriefingsPage() {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const refresh = useCallback(
    () =>
      listBriefings()
        .then(setProjects)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  const available = projects.filter((p) => p.importAvailable);
  const active = projects.filter((p) =>
    ["queued", "running"].includes(p.analysis?.status),
  );
  const completed = projects.filter((p) => p.analysis?.status === "completed");
  const failed = projects.filter((p) =>
    ["failed", "interrupted", "blocked"].includes(p.analysis?.status),
  );
  async function importExisting() {
    setBusy(true);
    setError("");
    try {
      let imported = 0;
      for (const project of available) {
        const result = await importAssessment(project.id);
        if (!result.alreadyImported) imported++;
      }
      setMessage(
        imported
          ? `${imported} source-linked research draft${imported === 1 ? "" : "s"} imported. Original files are unchanged.`
          : "Existing research is already imported.",
      );
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function retryFailed() {
    setBusy(true);
    try {
      await resumeAnalysis();
      const jobs = await startPortfolioAnalysis(failed.map((p) => p.id));
      setMessage(`${jobs.length} assessments queued for retry.`);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = projects
    .filter((p) => category === "all" || p.category === category)
    .filter((p) =>
      (p.name + " " + (p.allTags || []).join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (p) =>
        filter === "all" ||
        (filter === "draft"
          ? p.hasPendingDraft
          : filter === "accepted"
            ? !!p.brief?.acceptedRevision
            : filter === "unassessed"
              ? !p.brief
              : filter === "active"
                ? ["queued", "running"].includes(p.analysis?.status)
                : filter === "failed"
                  ? ["failed", "interrupted", "blocked"].includes(
                      p.analysis?.status,
                    )
                  : p.brief?.recommendation === filter),
    );
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">EVIDENCE BEFORE INVESTMENT</p>
          <h1>
            A brief for <em>every decision.</em>
          </h1>
          <p className="page-description">
            What exists, why it matters, and what still needs to be proven.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          Run assessments <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="page-content">
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice-banner" role="status">
            {message}
          </p>
        )}
        <Stats
          items={[
            {
              label: "Briefs available",
              value: projects.filter((p) => p.brief).length,
              note: `${projects.length} projects in the portfolio`,
            },
            {
              label: "Drafts to review",
              value: projects.filter((p) => p.hasPendingDraft).length,
              note: "Imported research & new assessments",
            },
            {
              label: "Accepted briefs",
              value: projects.filter((p) => p.brief?.acceptedRevision).length,
              note: "Reviewed, with history preserved",
            },
            {
              label: "Awaiting evidence",
              value: projects.filter((p) => !p.brief).length,
              note: "Unknowns stay visible",
            },
          ]}
        />
        {(active.length > 0 || completed.length > 0 || failed.length > 0) && (
          <section className="assessment-progress card">
            <div>
              <p className="eyebrow">PORTFOLIO ASSESSMENT</p>
              <h2>
                {active.length
                  ? "Research is under way."
                  : "Your assessment results."}
              </h2>
              <p>
                {completed.length} completed ·{" "}
                {active.filter((p) => p.analysis.status === "running").length}{" "}
                running ·{" "}
                {active.filter((p) => p.analysis.status === "queued").length}{" "}
                queued · {failed.length} need attention
              </p>
            </div>
            <div className="batch-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${projects.length ? (completed.length / projects.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <span>
                Same assessment framework. Each project's own evidence.
              </span>
              {failed.length > 0 && (
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={retryFailed}
                >
                  Resume / retry {failed.length} assessments
                </button>
              )}
            </div>
          </section>
        )}
        {showAnalysis && <AnalysisPanel onCompleted={refresh} />}
        <section className="research-callout">
          <div className="research-symbol" aria-hidden="true">
            ↳
          </div>
          <div>
            <p className="eyebrow">EXISTING RESEARCH</p>
            <h3>Good work deserves a record.</h3>
            <p>
              {available.length
                ? `${available.length} project${available.length === 1 ? " has" : "s have"} an existing research assessment ready to import.`
                : "Existing imported research stays alongside new assessments."}{" "}
              Original findings retain their source, date and verification
              limits.
            </p>
          </div>
          {available.length > 0 && (
            <button
              disabled={busy}
              className="btn btn-secondary"
              onClick={importExisting}
            >
              {busy ? "Importing…" : "Import existing research"}
            </button>
          )}
        </section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE DECISION REGISTER</p>
            <h2>From enthusiasm to evidence.</h2>
          </div>
          <span className="result-count">{filtered.length} projects</span>
        </div>
        <div className="toolbar">
          <div className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              className="input"
              aria-label="Search executive briefings"
              placeholder="Find a project or brief…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input filter-select"
            aria-label="Briefing filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ["all", "All briefings"],
              ["draft", "Drafts to review"],
              ["accepted", "Accepted"],
              ["unassessed", "Awaiting assessment"],
              ["active", "Assessments active"],
              ["failed", "Needs attention"],
              ["Explore", "Explore"],
              ["Pilot", "Pilot"],
              ["Scale/Transition", "Scale / transition"],
              ["Rework", "Rework"],
              ["Stop", "Stop"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="briefing-category-filter">
          <label>
            Project category
            <select
              className="input"
              aria-label="Briefing project category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Personal & work</option>
              <option value="personal">Personal</option>
              <option value="work">Work</option>
              <option value="unclassified">Unclassified</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p className="empty-state">Loading executive briefings…</p>
        ) : (
          <PortfolioTable projects={filtered} briefings />
        )}
        <footer className="page-footnote">
          Historical tests are reported as historical. Source inspection is not
          a fresh test run or a customer commitment.
        </footer>
      </div>
    </>
  );
}
