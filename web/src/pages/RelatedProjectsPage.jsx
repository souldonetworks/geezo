import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listBriefings, searchRelatedProjects } from "../api";
export default function RelatedProjectsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const category = params.get("category") || "all";
  const [input, setInput] = useState(query);
  const [projects, setProjects] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    listBriefings()
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setInput(query);
    if (!query) {
      setResults([]);
      return;
    }
    let live = true;
    setLoading(true);
    searchRelatedProjects(query, category)
      .then((data) => live && setResults(data))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [query, category]);
  const counts = new Map();
  for (const project of projects.filter(
    (p) => category === "all" || p.category === category,
  ))
    for (const tag of project.allTags || [])
      counts.set(tag, (counts.get(tag) || 0) + 1);
  const popular = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 24);
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">START WITH WHAT EXISTS</p>
          <h1>
            Find the <em>connections.</em>
          </h1>
          <p className="page-description">
            Before starting something new, discover projects with related
            capabilities, technologies and ideas.
          </p>
        </div>
      </div>
      <div className="page-content">
        <form
          className="discovery-search card"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: input, category });
          }}
        >
          <label htmlFor="concept-query">
            What are you thinking of building?
          </label>
          <div className="toolbar">
            <div className="search-field">
              <input
                id="concept-query"
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Puppet remediation through MCP"
                maxLength={500}
              />
            </div>
            <select
              className="input"
              aria-label="Related project category"
              value={category}
              onChange={(e) =>
                setParams({ q: query, category: e.target.value })
              }
            >
              <option value="all">Personal & work</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="unclassified">Unclassified</option>
            </select>
            <button className="btn btn-primary" type="submit">
              Find related projects →
            </button>
          </div>
          <p className="muted">
            Results use shared tags and assessment text. A match is a reuse
            lead, not a guarantee of compatible capabilities.
          </p>
        </form>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <div className="topic-cloud">
          {popular.map(([tag, count]) => (
            <button
              className={`topic-tag ${query === tag ? "selected" : ""}`}
              key={tag}
              onClick={() => setParams({ q: tag, category })}
            >
              {tag}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">RELATED PROJECTS</p>
            <h2>
              {query
                ? `Connections for “${query}”`
                : "Follow a topic. Find a starting point."}
            </h2>
          </div>
          {query && (
            <span className="result-count">{results.length} matches</span>
          )}
        </div>
        {loading ? (
          <p className="empty-state">Finding related projects…</p>
        ) : results.length ? (
          <div className="related-results">
            {results.map((project) => (
              <article className="card related-result" key={project.id}>
                <div>
                  <span className="status-pill">{project.category}</span>
                  <Link className="project-link" to={`/project/${project.id}`}>
                    {project.name} ↗
                  </Link>
                  <p className="related-summary">{project.summary}</p>
                  <div className="tag-list">
                    {project.matchedTags.map((tag) => (
                      <span
                        className="topic-tag"
                        title={
                          project.tags.includes(tag)
                            ? "User tag"
                            : "Suggested from assessment"
                        }
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="match-reason">
                    {project.matchedTags.length
                      ? `Shared topics: ${project.matchedTags.join(", ")}`
                      : `Assessment terms: ${project.matchedTerms.join(", ")}`}
                  </p>
                </div>
                <Link
                  className="btn btn-secondary"
                  to={`/project/${project.id}`}
                >
                  Review project →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            {query
              ? "No matching projects yet. Try a broader topic or add tags to existing projects."
              : "Choose a topic above or describe a new idea. More connections appear as the assessment batch completes."}
          </p>
        )}
      </div>
    </>
  );
}
