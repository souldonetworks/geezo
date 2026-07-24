import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <p>Loading…</p>;

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
    <div style={{ padding: '1rem' }}>
      <h1>Settings</h1>
      <label>
        CLI tool:
        <select value={settings.cliTool} onChange={(e) => setSettings({ ...settings, cliTool: e.target.value })}>
          <option value="claude">claude</option>
          <option value="codex">codex</option>
          <option value="gemini">gemini</option>
        </select>
      </label>
      <br />
      <label>
        Terminal app:
        <select
          value={settings.terminalApp}
          onChange={(e) => setSettings({ ...settings, terminalApp: e.target.value })}
        >
          <option value="Terminal">Terminal</option>
          <option value="iTerm">iTerm</option>
        </select>
      </label>
      <h2>Convert command templates</h2>
      {['claude', 'codex', 'gemini'].map((tool) => (
        <div key={tool}>
          <label>
            {tool}:
            <input
              type="text"
              value={settings.commandTemplates[tool]}
              onChange={(e) => updateTemplate(tool, e.target.value)}
              style={{ width: '20rem' }}
            />
          </label>
        </div>
      ))}
      <button onClick={handleSave}>Save</button>
      {saved && <span> Saved.</span>}
    </div>
  );
}
