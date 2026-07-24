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
    <div style={{ marginBottom: '1rem' }}>
      <input
        type="text"
        placeholder="/absolute/path/to/project"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />
      <button onClick={handleAdd}>Add Project</button>
      {notGsd && (
        <div>
          <p>That folder isn't a GSD project yet.</p>
          <button onClick={handleConvert}>Convert to GSD project</button>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
