import { useState } from "react";
import { scanDirectory, addProject, convertProject } from "../api";

export default function ScanFolderPanel({ onAdded }) {
  const [parentPath, setParentPath] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  async function handleScan() {
    setError(null);
    try {
      const found = await scanDirectory(parentPath);
      setResults(found);
    } catch (err) {
      setResults(null);
      setError(err.message);
    }
  }

  async function handleAdd(entryPath) {
    await addProject(entryPath);
    onAdded();
    handleScan();
  }

  async function handleConvert(entryPath) {
    await convertProject(entryPath);
  }

  return (
    <div className="card">
      <h3>scan folder</h3>
      <div className="inline-row">
        <input
          className="input"
          type="text"
          placeholder="/absolute/path/to/parent/folder"
          value={parentPath}
          onChange={(e) => setParentPath(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary" onClick={handleScan}>
          scan
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {results && (
        <div style={{ marginTop: "var(--gap-md)" }}>
          {results.length === 0 ? (
            <p className="empty-state">No subfolders found.</p>
          ) : (
            results.map((entry) => (
              <div className="stat" key={entry.path}>
                <span>{entry.name}</span>
                <span className="inline-row" style={{ alignItems: "center" }}>
                  {entry.alreadyRegistered ? (
                    <span className="badge muted">already added</span>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleAdd(entry.path)}
                    >
                      add {entry.isGsdProject ? "GSD project" : "project"}
                    </button>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
