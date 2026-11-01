import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listAssessmentLenses,
  createAssessmentLens,
  updateAssessmentLens,
  deleteAssessmentLens,
} from "../api";
const empty = { name: "", description: "", charter: "" };
export default function AssessmentLensesPage() {
  const [lenses, setLenses] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function load() {
    return listAssessmentLenses().then(setLenses);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (draft.id)
        await updateAssessmentLens(draft.id, {
          ...draft,
          expectedVersion: draft.version,
        });
      else await createAssessmentLens(draft);
      setDraft(null);
      setMessage(
        "Lens saved. Future assessments use the new charter; historical assessments keep their original version.",
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(lens) {
    setBusy(true);
    setError("");
    try {
      await deleteAssessmentLens(lens.id, lens.version);
      setMessage(
        `${lens.name} removed from active lenses. Historical charter versions are preserved.`,
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">ASK THE RIGHT QUESTIONS</p>
          <h1>
            Different projects. <em>Different lenses.</em>
          </h1>
          <p className="page-description">
            Define what a useful assessment means, from PuppetWorks to games,
            home utility and experiments.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setDraft({ ...empty });
            setError("");
          }}
        >
          Create assessment lens +
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
        {draft && (
          <form className="card lens-editor" onSubmit={save}>
            <p className="eyebrow">
              {draft.id ? "EDIT CHARTER" : "NEW ASSESSMENT LENS"}
            </p>
            <h2>{draft.id ? draft.name : "A new way to evaluate work."}</h2>
            <label>
              Lens name
              <input
                required
                maxLength={80}
                className="input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Purpose
              <textarea
                className="input"
                maxLength={1000}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label>
              Assessment charter
              <textarea
                required
                minLength={20}
                maxLength={60000}
                className="input charter-editor"
                value={draft.charter}
                onChange={(e) =>
                  setDraft({ ...draft, charter: e.target.value })
                }
              />
            </label>
            <p className="muted">
              Describe the questions, evidence standards, value paths and
              decision gates for this lens. Source-only analysis restrictions
              still apply.
            </p>
            <div className="inline-row">
              <button disabled={busy} className="btn btn-primary" type="submit">
                Save charter version
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        <div className="lens-grid">
          {lenses.map((lens) => (
            <article className="card lens-card" key={lens.id}>
              <div className="lens-card-top">
                <span className="status-pill accent">
                  Version {lens.version}
                </span>
                <span className="muted">
                  {lens.assignedProjects} explicitly assigned
                </span>
              </div>
              <h2>{lens.name}</h2>
              <p>{lens.description}</p>
              <details>
                <summary>Read assessment charter</summary>
                <pre>{lens.charter}</pre>
              </details>
              <div className="inline-row">
                <Link className="btn btn-secondary" to={`/?lens=${lens.id}`}>
                  View projects ↗
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setDraft({ ...lens });
                    setMessage("");
                  }}
                >
                  Edit lens
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={busy || lens.assignedProjects > 0}
                  title={
                    lens.assignedProjects
                      ? "Reassign projects before deleting this lens"
                      : ""
                  }
                  onClick={() => remove(lens)}
                >
                  Delete lens
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="page-footnote">
          Personal/work classification is independent of the lens. Auto lens
          assignments are suggestions; select a lens explicitly on any project.
        </p>
      </div>
    </>
  );
}
