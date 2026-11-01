import { useEffect, useState } from "react";
import {
  getAnalysisConfiguration,
  startAnalysis,
  startPortfolioAnalysis,
  getAnalysisJob,
  listBriefings,
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
    listBriefings()
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
        const projects = await listBriefings();
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
      <h3>Run the portfolio assessment</h3>
      <p>
        The same framework used in Geezer: capability, reuse, verification
        limits, investment tiers and executive questions. No project commands
        are executed.
      </p>
      {config && (
        <>
          <p>
            Provider:{" "}
            {config.adapter === "codex" ? "ChatGPT (Codex)" : config.adapter} ·{" "}
            {config.executable}
          </p>
          <p className="muted">{config.dataHandling}</p>
          {!config.supported && (
            <p role="alert">
              Choose a supported analysis provider in Settings.
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
