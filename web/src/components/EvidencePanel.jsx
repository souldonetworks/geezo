import { useEffect, useState } from "react";
import { getBriefEvidence } from "../api";
export default function EvidencePanel({ projectId, evidenceId }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setSnapshot(null);
    setError("");
    if (evidenceId)
      getBriefEvidence(projectId, evidenceId)
        .then((data) => live && setSnapshot(data))
        .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [projectId, evidenceId]);
  if (!evidenceId) return null;
  return (
    <details>
      <summary>Source evidence</summary>
      {error && <p role="alert">{error}</p>}
      {snapshot ? (
        <>
          <p>
            Observed {snapshot.observedAt} ·{" "}
            {snapshot.complete
              ? "complete within configured limits"
              : "incomplete snapshot"}
          </p>
          {snapshot.omissions.length > 0 && (
            <p>
              {snapshot.omissions.length} omissions or inspection limits were
              recorded.
            </p>
          )}
          {snapshot.files.map((file) => (
            <details key={file.path}>
              <summary>
                {file.path} ({file.lines} lines)
              </summary>
              <pre>
                {file.text
                  .split("\n")
                  .map((line, index) => `${index + 1}: ${line}`)
                  .join("\n")}
              </pre>
            </details>
          ))}
        </>
      ) : (
        <p>Loading evidence…</p>
      )}
    </details>
  );
}
