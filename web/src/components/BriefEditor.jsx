import { useState } from "react";
const labels = {
  recommendation: "Recommendation rationale",
  customerPromise: "Customer promise",
  whyNow: "Why now / why PuppetWorks",
  valueModel: "Value model",
  delivery: "Delivery and ownership",
  executiveAsk: "Executive ask",
  unansweredQuestions: "Unanswered questions",
};
export default function BriefEditor({ initial, onSave, onCancel, saving }) {
  const [brief, setBrief] = useState(() => structuredClone(initial));
  const [opportunities, setOpportunities] = useState(
    JSON.stringify(initial.opportunities, null, 2),
  );
  const [error, setError] = useState("");
  function update(key, index, patch) {
    const claims =
      key === "recommendation" ? brief.recommendation.claims : brief[key];
    const next = claims.map((c, i) => (i === index ? { ...c, ...patch } : c));
    setBrief({
      ...brief,
      [key]:
        key === "recommendation"
          ? { ...brief.recommendation, claims: next }
          : next,
    });
  }
  function add(key) {
    const claims =
      key === "recommendation" ? brief.recommendation.claims : brief[key];
    const next = [...claims, { text: "", status: "unknown", evidenceRefs: [] }];
    setBrief({
      ...brief,
      [key]:
        key === "recommendation"
          ? { ...brief.recommendation, claims: next }
          : next,
    });
  }
  function remove(key, index) {
    const claims =
      key === "recommendation" ? brief.recommendation.claims : brief[key];
    const next = claims.filter((_, i) => i !== index);
    setBrief({
      ...brief,
      [key]:
        key === "recommendation"
          ? { ...brief.recommendation, claims: next }
          : next,
    });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave({ ...brief, opportunities: JSON.parse(opportunities) });
        } catch (err) {
          setError(err.message);
        }
      }}
    >
      <label>
        Project purpose
        <select
          className="input"
          value={brief.purpose}
          onChange={(e) => setBrief({ ...brief, purpose: e.target.value })}
        >
          {[
            "unknown",
            "experiment",
            "customer-release",
            "community",
            "personal",
            "demonstration",
          ].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label>
        Recommendation
        <select
          className="input"
          value={brief.recommendation.decision}
          onChange={(e) =>
            setBrief({
              ...brief,
              recommendation: {
                ...brief.recommendation,
                decision: e.target.value,
              },
            })
          }
        >
          {["Explore", "Pilot", "Scale/Transition", "Rework", "Stop"].map(
            (p) => (
              <option key={p}>{p}</option>
            ),
          )}
        </select>
      </label>
      {Object.entries(labels).map(([key, label]) => (
        <fieldset key={key}>
          <legend>{label}</legend>
          {(key === "recommendation"
            ? brief.recommendation.claims
            : brief[key]
          ).map((claim, index) => (
            <div key={index} className="claim-editor">
              <label>
                Statement
                <textarea
                  required
                  className="input"
                  value={claim.text}
                  onChange={(e) => update(key, index, { text: e.target.value })}
                />
              </label>
              <label>
                Evidence status
                <select
                  className="input"
                  value={claim.status}
                  onChange={(e) =>
                    update(key, index, { status: e.target.value })
                  }
                >
                  {["confirmed", "hypothesis", "proposed", "unknown"].map(
                    (status) => (
                      <option key={status}>{status}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Evidence references (one per line)
                <textarea
                  className="input"
                  placeholder="README.md:12"
                  value={claim.evidenceRefs.join("\n")}
                  onChange={(e) =>
                    update(key, index, {
                      evidenceRefs: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={
                  (key === "recommendation"
                    ? brief.recommendation.claims
                    : brief[key]
                  ).length < 2
                }
                onClick={() => remove(key, index)}
              >
                remove statement
              </button>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => add(key)}
          >
            add statement
          </button>
        </fieldset>
      ))}
      <details>
        <summary>Commercial opportunity records</summary>
        <p>
          Amounts require attribution evidence. Leave this empty when commercial
          evidence is unavailable.
        </p>
        <textarea
          className="input brief-editor"
          aria-label="Commercial opportunities JSON"
          value={opportunities}
          onChange={(e) => setOpportunities(e.target.value)}
        />
      </details>
      {error && <p role="alert">{error}</p>}
      <div className="inline-row">
        <button disabled={saving} className="btn btn-primary" type="submit">
          save new revision
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          cancel
        </button>
      </div>
    </form>
  );
}
