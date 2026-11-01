import { useState } from "react";
import { addProject } from "../api";
export default function AddProjectDialog({ onAdded }) {
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
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
        <button className="btn btn-primary" onClick={add}>
          add project
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
