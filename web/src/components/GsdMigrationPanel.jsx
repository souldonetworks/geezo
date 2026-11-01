import { useEffect, useState } from "react";
import {
  prepareMigration,
  listMigrations,
  applyMigration,
  rollbackMigration,
} from "../api";
export default function GsdMigrationPanel({ projectId, onChanged }) {
  const [proposals, setProposals] = useState([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const migration = proposals.find((p) => p.id === selected);
  function load(preferred) {
    return listMigrations(projectId).then((list) => {
      setProposals(list);
      setSelected(preferred || list[0]?.id || "");
    });
  }
  useEffect(() => {
    setProposals([]);
    setError("");
    load().catch((e) => setError(e.message));
  }, [projectId]);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      await load(result.id);
      onChanged?.();
    } catch (e) {
      setError(e.message);
      await load(selected);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>GSD adoption</h2>
      <p>
        Prepare a proposal from existing project context. Applying adds missing
        planning files and preserves existing work. GSD CLI installation and
        implementation are separate steps.
      </p>
      <button
        disabled={busy}
        className="btn btn-secondary"
        onClick={() => action(() => prepareMigration(projectId))}
      >
        prepare migration
      </button>
      {error && <p role="alert">{error}</p>}
      {proposals.length > 0 && (
        <label>
          Migration history
          <select
            className="input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {proposals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.createdAt} · {p.status}
              </option>
            ))}
          </select>
        </label>
      )}
      {migration && (
        <>
          <p aria-live="polite">
            <strong>{migration.status}</strong> · {migration.format}
          </p>
          {migration.error && <p role="alert">{migration.error}</p>}
          <h3>decisions and prerequisites</h3>
          <ul>
            {migration.unresolved.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
          {migration.evidenceComplete === false && (
            <p>
              Some evidence exceeded inspection limits. Review existing plans
              before applying.
            </p>
          )}
          {migration.operations.map((op) => (
            <details key={op.relativePath}>
              <summary>Add {op.relativePath}</summary>
              <pre>{op.afterContent}</pre>
            </details>
          ))}
          {migration.sourceMap?.length > 0 && (
            <details>
              <summary>
                Preserved source context ({migration.sourceMap.length} files)
              </summary>
              <ul>
                {migration.sourceMap.map((s) => (
                  <li key={s.path}>
                    {s.path} — {s.action}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {migration.backupLocation && (
            <p>Recovery record: {migration.backupLocation}</p>
          )}
          {migration.validation.length > 0 && (
            <ul>
              {migration.validation.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          )}
          <div className="inline-row">
            {migration.status === "prepared" && (
              <button
                disabled={busy}
                className="btn btn-primary"
                onClick={() =>
                  action(() => applyMigration(projectId, migration))
                }
              >
                apply reviewed migration
              </button>
            )}
            {["completed", "failed", "interrupted"].includes(
              migration.status,
            ) && (
              <button
                disabled={busy}
                className="btn btn-secondary"
                onClick={() =>
                  action(() => rollbackMigration(projectId, migration))
                }
              >
                roll back migration files
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
