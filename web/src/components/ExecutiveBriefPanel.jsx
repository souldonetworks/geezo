import { useEffect, useState } from "react";
import BriefEditor from "./BriefEditor";
import EvidencePanel from "./EvidencePanel";
import { getBrief, saveBrief, acceptBrief } from "../api";
const headings = {
  recommendation: "Recommendation",
  customerPromise: "Customer promise",
  whyNow: "Why now / why PuppetWorks",
  valueModel: "Value model",
  delivery: "Delivery and ownership",
  executiveAsk: "Executive ask",
  unansweredQuestions: "Unanswered questions",
};
const blank = {
  purpose: "unknown",
  recommendation: {
    decision: "Explore",
    claims: [
      {
        text: "Assessment has not yet been completed.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
  },
  customerPromise: [
    {
      text: "Audience, baseline, target and supporting evidence are unknown.",
      status: "unknown",
      evidenceRefs: [],
    },
  ],
  whyNow: [
    {
      text: "Alternatives, organizational gap and relevant pillars are unknown.",
      status: "unknown",
      evidenceRefs: [],
    },
  ],
  valueModel: [
    {
      text: "Commercial and community value have not been validated.",
      status: "unknown",
      evidenceRefs: [],
    },
  ],
  delivery: [
    {
      text: "Scope, cost, owners and off-ramp remain unknown.",
      status: "unknown",
      evidenceRefs: [],
    },
  ],
  executiveAsk: [
    {
      text: "Resources, review date, success and stop criteria remain unknown.",
      status: "unknown",
      evidenceRefs: [],
    },
  ],
  unansweredQuestions: [
    {
      text: "Investigator unknown; next step is to review existing project context.",
      status: "unknown",
      evidenceRefs: [],
    },
  ],
  opportunities: [],
};
export default function ExecutiveBriefPanel({ projectId, refreshKey }) {
  const [record, setRecord] = useState(null);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function load(preferred) {
    return getBrief(projectId)
      .then((r) => {
        setRecord(r);
        setSelected(
          preferred ||
            r.latestHuman ||
            r.acceptedRevision ||
            r.latestDraft ||
            "",
        );
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    setRecord(null);
    setEditing(false);
    load();
  }, [projectId, refreshKey]);
  const revision = record?.revisions.find((r) => r.id === selected);
  const brief = revision?.brief;
  async function save(updatedBrief) {
    setSaving(true);
    try {
      const saved = await saveBrief(projectId, {
        brief: updatedBrief,
        parentRevision: selected || null,
        expectedHead:
          record.latestHuman || record.acceptedRevision || record.latestDraft,
      });
      setEditing(false);
      await load(saved.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function accept() {
    setSaving(true);
    try {
      await acceptBrief(projectId, {
        revisionId: selected,
        expectedAcceptedRevision: record.acceptedRevision,
      });
      await load(selected);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="card">
      <h2>executive project brief</h2>
      {error && <p role="alert">{error}</p>}
      {!record ? (
        <p>Loading…</p>
      ) : (
        <>
          {record.revisions.length > 0 && (
            <label>
              Revision history
              <select
                className="input"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setEditing(false);
                }}
              >
                {[...record.revisions].reverse().map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.createdAt} · {r.source}
                    {r.id === record.acceptedRevision
                      ? " · accepted"
                      : " · draft"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {brief ? (
            <>
              <p>
                <strong>{brief.recommendation.decision}</strong> ·{" "}
                {brief.purpose} ·{" "}
                {record.acceptedRevision === selected ? "accepted" : "draft"}
              </p>
              {Object.entries(headings).map(([key, title]) => (
                <div key={key}>
                  <h3>{title}</h3>
                  <ul>
                    {(key === "recommendation"
                      ? brief.recommendation.claims
                      : brief[key]
                    ).map((claim, index) => (
                      <li key={index}>
                        <span className={`claim-status ${claim.status}`}>
                          {claim.status}
                        </span>{" "}
                        {claim.text}
                        {claim.evidenceRefs.length > 0 && (
                          <small className="evidence-ref">
                            Evidence: {claim.evidenceRefs.join(", ")}
                          </small>
                        )}
                      </li>
                    ))}
                  </ul>
                  {(key === "recommendation"
                    ? brief.recommendation.claims
                    : brief[key]
                  ).length === 0 && (
                    <p className="muted">unknown — no evidence recorded.</p>
                  )}
                </div>
              ))}
              <p>
                Prompt: {revision.promptVersion} · Evidence snapshot:{" "}
                {revision.evidenceId || "none"}
              </p>
              <div className="inline-row">
                <button
                  disabled={saving || record.acceptedRevision === selected}
                  className="btn btn-primary"
                  onClick={accept}
                >
                  accept this revision
                </button>
                <a
                  className="btn btn-secondary"
                  href={`/api/projects/${projectId}/brief/export?revision=${selected}`}
                >
                  export Markdown
                </a>
              </div>
            </>
          ) : (
            <p>
              No brief yet. Analyze this project or create a human assessment.
            </p>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setEditing(!editing)}
          >
            edit brief
          </button>
          {editing && (
            <BriefEditor
              initial={brief || blank}
              onSave={save}
              onCancel={() => setEditing(false)}
              saving={saving}
            />
          )}
          <EvidencePanel
            projectId={projectId}
            evidenceId={revision?.evidenceId}
          />
        </>
      )}
    </section>
  );
}
