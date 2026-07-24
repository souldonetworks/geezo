import { useState } from 'react';
import { addProject, convertProject } from '../api';

export default function AddProjectDialog({ onAdded }) {
  const [path, setPath] = useState('');
  const [notGsd, setNotGsd] = useState(false);
  const [error, setError] = useState(null);

  async function handleAdd() {
    setError(null);
    setNotGsd(false);
    try {
      await addProject(path);
      setPath('');
      onAdded();
    } catch (err) {
      if (err.code === 'NOT_GSD_PROJECT') {
        setNotGsd(true);
      } else {
        setError(err.message);
      }
    }
  }

  async function handleConvert() {
    await convertProject(path);
    setNotGsd(false);
  }

  return (
    <div className="card">
      <div className="inline-row">
        <input
          className="input"
          type="text"
          placeholder="/absolute/path/to/project"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          add project
        </button>
      </div>
      {notGsd && (
        <div style={{ marginTop: 'var(--gap-md)' }}>
          <p className="empty-state">That folder isn't a GSD project yet.</p>
          <button className="btn btn-secondary" onClick={handleConvert}>
            convert to gsd project
          </button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
