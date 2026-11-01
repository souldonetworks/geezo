import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  getAllIn,
  runAllIn,
  getAllInReport,
  getSettings,
  saveSettings,
  listAssessmentLenses,
  listWorkspaces,
  previewWorkspace,
  createLinkedWorkspace,
  archiveLinkedWorkspace,
  restoreLinkedWorkspace,
} from "../api";
import { Stats } from "../components/PortfolioTable";
export default function AllInPage() {
  const [state, setState] = useState(null);
  const [report, setReport] = useState(null);
  const [selected, setSelected] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [lenses, setLenses] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [review, setReview] = useState(null);
  const [plan, setPlan] = useState(null);
  const reviewRef = useRef(null);
  const [reviewRequest, setReviewRequest] = useState(0);
  useEffect(() => {
    if (!reviewRequest || !reviewRef.current) return;
    reviewRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    reviewRef.current.focus({ preventScroll: true });
  }, [reviewRequest]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      Promise.all([getAllIn(), listWorkspaces()]).then(([next, groups]) => {
        setState(next);
        setWorkspaces(groups);
        if (!selected) setReport(next.currentReport);
      }),
    [selected],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const timer = setInterval(
      () => load().catch((e) => setError(e.message)),
      5000,
    );
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    getSettings()
      .then((s) => setSchedule(s.allIn))
      .catch((e) => setError(e.message));
    listAssessmentLenses()
      .then(setLenses)
      .catch((e) => setError(e.message));
  }, []);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(value) {
    setSelected(value);
    setReport(value ? await getAllInReport(value) : state.currentReport);
    setReview(null);
    setPlan(null);
  }
  function openReview(proposal) {
    setReviewRequest((n) => n + 1);
    const names = proposal.projectIds.map((id) =>
      report.sourceProjects.find((p) => p.id === id),
    );
    setReview({
      reportId: report.id,
      proposalId: proposal.id,
      name: proposal.workingName,
      category: "unclassified",
      lensId: proposal.proposedLensId || "",
      members: names,
    });
    setPlan(null);
    setError("");
  }
  const running = ["queued", "running"].includes(state?.run?.status);
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">THE WHOLE IS MORE THAN THE PARTS</p>
          <h1>
            All <em>In.</em>
          </h1>
          <p className="page-description">
            One portfolio view. Less duplicated effort. More useful
            possibilities.
          </p>
        </div>
        <button
          className="btn btn-primary"
          disabled={busy || running}
          onClick={() =>
            action(async () => {
              await runAllIn();
              setSelected("");
              setNotice(
                "Portfolio review started. Existing recommendations remain available until the new report succeeds.",
              );
            })
          }
        >
          {running ? "Review in progress…" : "Run All In now ↗"}
        </button>
      </div>
      <div className="page-content">
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice-banner" role="status">
            {notice}
          </p>
        )}
        {state?.run && (
          <p className="run-state" role="status">
            Latest review: <strong>{state.run.status}</strong>
            {state.run.error && ` — ${state.run.error}`}
          </p>
        )}
        {schedule && (
          <details className="card schedule-panel">
            <summary>
              Daily review ·{" "}
              {schedule.enabled
                ? `${schedule.time} ${schedule.timeZone}`
                : "disabled"}
            </summary>
            <p>
              Runs daily while Geezo is running. Missed reviews catch up at the
              next launch. Repository organization always requires your review.
            </p>
            <div className="schedule-fields">
              <label>
                Enabled
                <input
                  type="checkbox"
                  checked={schedule.enabled}
                  onChange={(e) =>
                    setSchedule({ ...schedule, enabled: e.target.checked })
                  }
                />
              </label>
              <label>
                Local time
                <input
                  className="input"
                  type="time"
                  value={schedule.time}
                  onChange={(e) =>
                    setSchedule({ ...schedule, time: e.target.value })
                  }
                />
              </label>
              <label>
                Timezone
                <input
                  className="input"
                  value={schedule.timeZone}
                  onChange={(e) =>
                    setSchedule({ ...schedule, timeZone: e.target.value })
                  }
                />
              </label>
              <label>
                Workspace directory
                <input
                  className="input"
                  value={schedule.workspaceRoot}
                  onChange={(e) =>
                    setSchedule({ ...schedule, workspaceRoot: e.target.value })
                  }
                />
              </label>
            </div>
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await saveSettings({ allIn: schedule });
                  setNotice("All In schedule saved.");
                })
              }
            >
              Save daily schedule
            </button>
          </details>
        )}
        {report ? (
          <>
            <Stats
              items={[
                {
                  label: "Projects considered",
                  value: report.coverage.total,
                  note: "Snapshot, not a fresh code test",
                },
                {
                  label: "With assessments",
                  value: report.coverage.assessed,
                  note: `${report.coverage.accepted} accepted sources`,
                },
                {
                  label: "With descriptions",
                  value: report.coverage.described,
                  note: "Best guesses stay labelled",
                },
                {
                  label: "Proposed directions",
                  value: report.recommendations.length,
                  note: "Review before creating a workspace",
                },
              ]}
            />
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE CURRENT DIRECTION</p>
                <h2>What could this become?</h2>
              </div>
              <label className="report-history">
                Report history
                <select
                  className="input"
                  value={selected}
                  onChange={(e) =>
                    choose(e.target.value).catch((err) => setError(err.message))
                  }
                >
                  <option value="">Current report</option>
                  {state?.history.map((r) => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.createdAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <section className="card portfolio-verdict">
              <p>{report.summary}</p>
              <p className="muted">
                Generated {new Date(report.createdAt).toLocaleString()} ·{" "}
                {Object.entries(report.coverage.byLens)
                  .map(([name, count]) => `${name}: ${count}`)
                  .join(" · ")}
              </p>
              {report.gaps.length > 0 && (
                <details>
                  <summary>Evidence gaps and portfolio limits</summary>
                  <ul>
                    {report.gaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </details>
              )}
              <a
                className="table-open"
                href={`/api/all-in/snapshots/${report.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Inspect the source snapshot ↗
              </a>
            </section>
            <div className="proposal-list">
              {report.recommendations.map((proposal) => (
                <article className="card proposal-card" key={proposal.id}>
                  <div className="proposal-heading">
                    <span className="status-pill accent">{proposal.type}</span>
                    <span className="claim-status hypothesis">
                      {proposal.confidence}
                    </span>
                  </div>
                  <h2>{proposal.workingName}</h2>
                  <p className="proposal-description">{proposal.description}</p>
                  <div className="tag-list">
                    {proposal.projectIds.map((id) => (
                      <Link
                        className="topic-tag"
                        key={id}
                        to={`/project/${id}`}
                      >
                        {report.sourceProjects.find((p) => p.id === id)?.name ||
                          id}{" "}
                        ↗
                      </Link>
                    ))}
                  </div>
                  <dl className="proposal-value">
                    <div>
                      <dt>Who benefits</dt>
                      <dd>{proposal.audience}</dd>
                    </div>
                    <div>
                      <dt>Why this matters</dt>
                      <dd>{proposal.problem}</dd>
                    </div>
                    <div>
                      <dt>What would improve</dt>
                      <dd>{proposal.value}</dd>
                    </div>
                  </dl>
                  <h3>The next investment</h3>
                  <ol>
                    {proposal.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <h3>Why back this?</h3>
                  <ul>
                    {proposal.reasons.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                  <h3>What could change the decision?</h3>
                  <ul>
                    {proposal.risks.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                  <h3>What would justify continuing?</h3>
                  <ul>
                    {proposal.successCriteria.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                  <details>
                    <summary>Supporting project evidence</summary>
                    <ul>
                      {proposal.evidence.map((e, i) => (
                        <li key={i}>
                          <Link to={`/project/${e.projectId}`}>
                            {
                              report.sourceProjects.find(
                                (p) => p.id === e.projectId,
                              )?.name
                            }
                          </Link>{" "}
                          · {e.field}: {e.observation}
                        </li>
                      ))}
                    </ul>
                  </details>
                  {proposal.type !== "keep-separate" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => openReview(proposal)}
                    >
                      Review linked workspace →
                    </button>
                  )}
                </article>
              ))}
            </div>
            {report.recommendations.length === 0 && (
              <p className="empty-state">
                No combination is justified by this snapshot. The evidence gaps
                show what to validate next.
              </p>
            )}
          </>
        ) : (
          <section className="card">
            <h2>A portfolio direction, grounded in evidence.</h2>
            <p>
              {running
                ? "Geezo is reviewing the portfolio. The first report will appear here when validated."
                : "Run the first All In review to identify duplicated effort, reusable components and possible combined offerings."}
            </p>
          </section>
        )}
        {review && (
          <section className="card workspace-review" ref={reviewRef} tabIndex={-1} aria-labelledby="workspace-review-title">
            <p className="eyebrow">REVIEW BEFORE APPLYING</p>
            <h2 id="workspace-review-title">Create a linked workspace</h2>
            <button className="btn btn-secondary" onClick={() => { setReview(null); setPlan(null); setError(""); }}>Close review</button>
            {error && <p className="error-banner" role="alert">{error}</p>}
            <p>
              The original repositories stay where they are. This creates a new
              product workspace, links, description and proposed integration
              plan. It does not merge or move code.
            </p>
            <label>
              Workspace name
              <input
                className="input"
                value={review.name}
                onChange={(e) => {
                  setReview({ ...review, name: e.target.value });
                  setPlan(null);
                }}
              />
            </label>
            <div className="metadata-form">
              <label>
                Classification
                <select
                  className="input"
                  value={review.category}
                  onChange={(e) => {
                    setReview({ ...review, category: e.target.value });
                    setPlan(null);
                  }}
                >
                  <option value="unclassified">Unclassified</option>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                </select>
              </label>
              <label>
                Assessment lens
                <select
                  className="input"
                  value={review.lensId}
                  onChange={(e) => {
                    setReview({ ...review, lensId: e.target.value });
                    setPlan(null);
                  }}
                >
                  <option value="">Propose from members</option>
                  {lenses.map((l) => (
                    <option value={l.id} key={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              disabled={busy}
              className="btn btn-secondary"
              onClick={() =>
                action(async () => setPlan(await previewWorkspace(review)))
              }
            >
              Preview exact folders & links
            </button>
            {plan && (
              <>
                <div className="source-provenance">
                  <strong>Target: {plan.targetPath}</strong>
                  <ul>
                    {plan.members.map((member) => (
                      <li key={member.projectId}>
                        <code>repositories/{member.alias}</code> →{" "}
                        {member.sourcePath}
                      </li>
                    ))}
                  </ul>
                  <p>
                    New files: README, workspace manifest and proposed GSD
                    planning artifacts.
                  </p>
                </div>
                <button
                  disabled={busy || plan.status === "created"}
                  className="btn btn-primary"
                  onClick={() =>
                    action(async () => {
                      const created = await createLinkedWorkspace(plan);
                      setPlan(created);
                      setNotice(
                        "Linked workspace created. Original repositories were not changed.",
                      );
                    })
                  }
                >
                  {plan.status === "created"
                    ? "Workspace created"
                    : "Create this linked workspace"}
                </button>
                {plan.status === "created" && plan.projectId && (
                  <Link
                    className="btn btn-secondary"
                    to={`/project/${plan.projectId}`}
                  >
                    Open workspace →
                  </Link>
                )}
              </>
            )}
          </section>
        )}
        {workspaces.some((w) =>
          ["created", "archived", "failed", "interrupted"].includes(w.status),
        ) && (
          <section className="card">
            <h2>Managed linked workspaces</h2>
            {workspaces
              .filter((w) =>
                ["created", "archived", "failed", "interrupted"].includes(
                  w.status,
                ),
              )
              .map((w) => (
                <div className="stat" key={w.id}>
                  <div>
                    <strong>{w.name}</strong>
                    <span className="project-meta">
                      {w.status} · {w.targetPath}
                      {w.error && <span className="row-error">{w.error}</span>}
                    </span>
                  </div>
                  <div className="inline-row">
                    {w.status !== "archived" ? (
                      <>
                        {w.status === "created" && w.projectRecord && (
                          <Link
                            className="table-open"
                            to={`/project/${w.projectId}`}
                          >
                            View ↗
                          </Link>
                        )}
                        <button
                          disabled={busy}
                          className="btn btn-secondary"
                          onClick={() =>
                            action(() => archiveLinkedWorkspace(w.id))
                          }
                        >
                          Archive workspace
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={busy}
                        className="btn btn-secondary"
                        onClick={() =>
                          action(() => restoreLinkedWorkspace(w.id))
                        }
                      >
                        Restore workspace
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </section>
        )}
      </div>
    </>
  );
}
