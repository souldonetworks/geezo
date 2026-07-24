import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings)
    return (
      <div className="page-content">
        <p className="empty-state">Loading…</p>
      </div>
    );

  function updateTemplate(tool, value) {
    setSettings({ ...settings, commandTemplates: { ...settings.commandTemplates, [tool]: value } });
  }

  async function handleSave() {
    const updated = await saveSettings(settings);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <div className="page-header">
        <h1>settings</h1>
      </div>
      <div className="page-content">
        <div className="card">
          <h3>convert defaults</h3>

          <div className="form-row">
            <label>cli tool</label>
            <select
              className="input"
              value={settings.cliTool}
              onChange={(e) => setSettings({ ...settings, cliTool: e.target.value })}
            >
              <option value="claude">claude</option>
              <option value="codex">codex</option>
              <option value="gemini">gemini</option>
            </select>
          </div>

          <div className="form-row">
            <label>terminal app</label>
            <select
              className="input"
              value={settings.terminalApp}
              onChange={(e) => setSettings({ ...settings, terminalApp: e.target.value })}
            >
              <option value="Terminal">Terminal</option>
              <option value="iTerm">iTerm</option>
            </select>
          </div>

          {['claude', 'codex', 'gemini'].map((tool) => (
            <div className="form-row" key={tool}>
              <label>{tool} command template</label>
              <input
                className="input"
                type="text"
                value={settings.commandTemplates[tool]}
                onChange={(e) => updateTemplate(tool, e.target.value)}
              />
            </div>
          ))}

          <div className="inline-row" style={{ alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              save
            </button>
            {saved && <span className="saved-text">saved.</span>}
          </div>
        </div>
      </div>
    </>
  );
}
