import { useState, useRef } from "react";
import { addProject, browseFolders } from "../api";
export default function AddProjectDialog({ onAdded }) {
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [browser, setBrowser] = useState(null);
  const [busy, setBusy] = useState(false);
  const browserRequest = useRef(0);
  async function browse(target = "") {
    const requestId = ++browserRequest.current;
    setBusy(true); setError("");
    try { const result = await browseFolders(target); if (requestId === browserRequest.current) setBrowser(result); }
    catch (e) { if (requestId === browserRequest.current) setError(e.message); }
    finally { if (requestId === browserRequest.current) setBusy(false); }
  }
  async function add() {
    try {
      await addProject(path);
      setPath("");
      setError("");
      onAdded();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="card">
      <div className="inline-row">
        <input
          className="input"
          aria-label="Project folder"
          placeholder="/absolute/path/to/project"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <button className="btn btn-secondary" disabled={busy} onClick={() => browse(path)}>Browse folders</button>
        <button className="btn btn-primary" onClick={add}>
          add project
        </button>
      </div>
      {browser && <section aria-label="Folder browser" className="folder-browser">
        <h3>Choose a project folder</h3><p><code>{browser.path}</code></p>
        <div className="inline-row">
          <button className="btn btn-secondary" disabled={busy || browser.path === browser.parent} onClick={() => browse(browser.parent)}>Up one folder</button>
          <button className="btn btn-primary" onClick={() => {setPath(browser.path); setBrowser(null);}}>Use this folder</button>
          <button className="btn btn-secondary" onClick={() => {browserRequest.current++;setBrowser(null);setBusy(false);}}>Cancel</button>
        </div>
        <ul>{browser.directories.map(d => <li key={d.path}><button className="btn btn-secondary" disabled={busy} onClick={() => browse(d.path)}>{d.name} →</button></li>)}</ul>
        {browser.directories.length === 0 && <p>No subfolders. You can use this folder.</p>}
        {browser.truncated && <p>Showing the first 500 folders. Enter a path above to open another folder.</p>}
      </section>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
