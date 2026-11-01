import { useEffect, useState } from "react";
import {
  getAnalysisConfiguration,
  startAnalysis,
  startPortfolioAnalysis,
  getAnalysisJob,
  listProjects,
} from "../api";
export default function AnalysisPanel({ projectId, onCompleted }) {
  const [config, setConfig] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    getAnalysisConfiguration()
      .then((c) => live && setConfig(c))
      .catch((e) => live && setError(e.message));
    listProjects()
      .then((projects) => {
        if (live)
          setJobs(
            projects
              .filter((p) => (!projectId || p.id === projectId) && p.analysis)
              .map((p) => p.analysis),
          );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [projectId]);
  const active = jobs.some((j) => ["queued", "running"].includes(j.status));
  useEffect(() => {
    if (!active) return;
    let live = true;
    const timer = setInterval(async () => {
      try {
        const next = await Promise.all(
          jobs.map((j) =>
            ["queued", "running"].includes(j.status)
              ? getAnalysisJob(j.id)
              : Promise.resolve(j),
          ),
        );
        if (live) {
          setJobs(next);
          if (next.every((j) => !["queued", "running"].includes(j.status)))
            onCompleted?.();
        }
      } catch (e) {
        if (live) setError(e.message);
      }
    }, 1500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [active, jobs, onCompleted]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      if (projectId) setJobs([await startAnalysis(projectId)]);
      else {
        const projects = await listProjects();
        setJobs(
          await startPortfolioAnalysis(
            projects
              .filter((p) => p.availability === "available")
              .map((p) => p.id),
          ),
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h3>executive analysis</h3>
      {config && (
        <>
          <p>
            Provider: {config.adapter} · {config.executable}
          </p>
          <p className="muted">{config.dataHandling}</p>
          {!config.supported && (
            <p role="alert">
              This adapter is unsupported. Select Claude in Settings.
            </p>
          )}
          <button
            className="btn btn-primary"
            disabled={!config.supported || active || busy}
            onClick={start}
          >
            {busy
              ? "starting…"
              : projectId
                ? "analyze project"
                : "analyze all available projects"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <ul aria-live="polite">
        {jobs.map((job) => (
          <li key={job.id}>
            {projectId ? "" : `${job.projectName || "project"}: `}
            {job.status}
            {job.error && ` — ${job.error}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
