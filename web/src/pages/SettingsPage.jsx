import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../api";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);

  if (!settings)
    return (
      <div className="page-content">
        <p className="empty-state">Loading…</p>
      </div>
    );

  function updateTemplate(tool, value) {
    setSettings({
      ...settings,
      commandTemplates: { ...settings.commandTemplates, [tool]: value },
    });
  }

  async function handleSave() {
    let updated;
    try {
      updated = await saveSettings(settings);
    } catch (e) {
      setError(e.message);
      return;
    }
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
          <h3>portfolio settings</h3>
          {error && <p role="alert">{error}</p>}
          <label>
            Discovery roots (one absolute path per line)
            <textarea
              className="input"
              value={settings.portfolio.roots.join("\n")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  portfolio: {
                    ...settings.portfolio,
                    roots: e.target.value.split("\n").filter(Boolean),
                  },
                })
              }
            />
          </label>
          <label>
            Excluded folders (one absolute path per line)
            <textarea
              className="input"
              value={settings.portfolio.exclusions.join("\n")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  portfolio: {
                    ...settings.portfolio,
                    exclusions: e.target.value.split("\n").filter(Boolean),
                  },
                })
              }
            />
          </label>
          <label>
            Scan interval (milliseconds)
            <input
              className="input"
              type="number"
              min="1000"
              value={settings.portfolio.scanIntervalMs}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  portfolio: {
                    ...settings.portfolio,
                    scanIntervalMs: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <h3>analysis provider</h3>
          <p>
            Analysis sends selected project evidence to your configured CLI
            provider using its existing account. Discovery makes no AI calls.
          </p>
          <label>
            Adapter
            <select
              className="input"
              value={settings.analysis.adapter}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  analysis: {
                    ...settings.analysis,
                    adapter: e.target.value,
                    executable: e.target.value,
                  },
                })
              }
            >
              <option value="claude">claude</option>
              <option value="codex">ChatGPT (Codex)</option>
            </select>
          </label>
          <label>
            Executable
            <input
              className="input"
              value={settings.analysis.executable}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  analysis: {
                    ...settings.analysis,
                    executable: e.target.value,
                  },
                })
              }
            />
          </label>
          <h3>terminal launch defaults</h3>

          <div className="form-row">
            <label>cli tool</label>
            <select
              className="input"
              value={settings.cliTool}
              onChange={(e) =>
                setSettings({ ...settings, cliTool: e.target.value })
              }
            >
              <option value="claude">claude</option>
              <option value="codex">ChatGPT (Codex)</option>
              <option value="gemini">gemini</option>
            </select>
          </div>

          <div className="form-row">
            <label>terminal app</label>
            <select
              className="input"
              value={settings.terminalApp}
              onChange={(e) =>
                setSettings({ ...settings, terminalApp: e.target.value })
              }
            >
              <option value="Terminal">Terminal</option>
              <option value="iTerm">iTerm</option>
            </select>
          </div>

          {["claude", "codex", "gemini"].map((tool) => (
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

          <div className="inline-row" style={{ alignItems: "center" }}>
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
