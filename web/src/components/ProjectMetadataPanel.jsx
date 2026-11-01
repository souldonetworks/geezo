import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  listBriefings,
  updateProjectMetadata,
  getRelatedProjects,
} from "../api";
export default function ProjectMetadataPanel({ projectId }) {
  const currentId = useRef(projectId);
  currentId.current = projectId;
  const mounted = useRef(true);
  const [project, setProject] = useState(null);
  const [category, setCategory] = useState("unclassified");
  const [text, setText] = useState("");
  const [related, setRelated] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  function load(
    isCurrent = () => mounted.current && currentId.current === projectId,
  ) {
    return Promise.all([listBriefings(), getRelatedProjects(projectId)]).then(
      ([all, matches]) => {
        if (!isCurrent()) return;
        const p = all.find((p) => p.id === projectId);
        if (!p) throw new Error("Project no longer tracked");
        setProject(p);
        setCategory(p.category);
        setText(p.tags.join(", "));
        setRelated(matches.slice(0, 4));
      },
    );
  }
  useEffect(() => {
    let active = true;
    mounted.current = true;
    setProject(null);
    setCategory("unclassified");
    setText("");
    setRelated([]);
    setError("");
    setBusy(false);
    setSaved(false);
    load(() => active && currentId.current === projectId).catch((e) => {
      if (active && currentId.current === projectId) setError(e.message);
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [projectId]);
  async function save({ keep, dismiss } = {}) {
    if (
      !project ||
      project.id !== projectId ||
      currentId.current !== projectId ||
      !mounted.current
    )
      return;
    const isCurrent = () => mounted.current && currentId.current === projectId;
    setBusy(true);
    setSaved(false);
    try {
      const tags = [
        ...text
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(keep ? [keep] : []),
      ];
      await updateProjectMetadata(projectId, {
        category,
        tags,
        dismissedTags: [
          ...(project.dismissedTags || []),
          ...(dismiss ? [dismiss] : []),
        ],
        expectedVersion: project.metadataVersion,
      });
      await load(isCurrent);
      if (!isCurrent()) return;
      setError("");
      setSaved(true);
    } catch (e) {
      if (isCurrent()) setError(e.message);
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  return (
    <section className="card metadata-panel">
      <p className="eyebrow">CONTEXT & CONNECTIONS</p>
      <h2>Give this project a place.</h2>
      {error && <p role="alert">{error}</p>}
      {!project || project.id !== projectId ? (
        <p>Loading project tags…</p>
      ) : (
        <>
          <div className="metadata-form">
            <label>
              Personal or work
              <select
                className="input"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSaved(false);
                }}
              >
                <option value="unclassified">Unclassified</option>
                <option value="personal">Personal</option>
                <option value="work">Work</option>
              </select>
            </label>
            <label>
              Your project tags
              <input
                className="input"
                placeholder="e.g. puppet, automation, homelab"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => save()}
            >
              Save classification & tags
            </button>
          </div>
          {saved && (
            <p className="saved-text" role="status">
              Project context saved.
            </p>
          )}
          {project.suggestedTags.length > 0 && (
            <div className="suggested-topics">
              <h3>Suggested from the assessment</h3>
              <p>
                Topic suggestions help discovery. They do not confirm delivery,
                ownership or customer demand.
              </p>
              <div className="tag-list">
                {project.suggestedTags.map((tag) => (
                  <span className="suggested-tag" key={tag}>
                    <Link to={`/discover?q=${encodeURIComponent(tag)}`}>
                      {tag}
                    </Link>
                    <button
                      aria-label={`Keep suggested tag ${tag}`}
                      title="Keep as your tag"
                      disabled={busy}
                      onClick={() => save({ keep: tag })}
                    >
                      +
                    </button>
                    <button
                      aria-label={`Dismiss suggested tag ${tag}`}
                      title="Dismiss suggestion"
                      disabled={busy}
                      onClick={() => save({ dismiss: tag })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="related-preview">
            <div className="section-heading">
              <h3>Related projects</h3>
              <Link
                className="table-open"
                to={`/discover?q=${encodeURIComponent(project.allTags.join(" "))}`}
              >
                Explore connections ↗
              </Link>
            </div>
            {related.length ? (
              <div className="related-grid">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    to={`/project/${item.id}`}
                    className="related-tile"
                  >
                    <strong>{item.name} ↗</strong>
                    <span>{item.matchedTags.join(" · ")}</span>
                    <small>{item.category}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">
                Add a topic tag or wait for more assessments to find
                connections.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
