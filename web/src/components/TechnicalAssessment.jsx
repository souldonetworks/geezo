export default function TechnicalAssessment({ assessment }) {
  if (!assessment) return null;
  return (
    <section className="assessment-section">
      <p className="eyebrow">EXISTING CAPABILITY & REUSE</p>
      <h2>What the evidence supports.</h2>
      <p>{assessment.summary}</p>
      {assessment.capabilities.length > 0 && (
        <div className="table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Status</th>
                <th scope="col">Verification</th>
                <th scope="col">Gap & reuse approach</th>
              </tr>
            </thead>
            <tbody>
              {assessment.capabilities.map((row, index) => (
                <tr key={index}>
                  <td>
                    <strong>{row.capability}</strong>
                    <span className="project-meta">{row.component}</span>
                  </td>
                  <td>
                    <span className="status-pill">{row.status}</span>
                  </td>
                  <td>
                    {row.verification}
                    <span className="project-meta">
                      {row.verificationDetail}
                    </span>
                  </td>
                  <td>
                    {row.limitations}
                    <p className="project-meta">{row.reuseApproach}</p>
                    <small className="evidence-ref">
                      {row.evidenceRefs.join(", ")}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assessment.investmentTiers.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Investment tiers</h3>
          {assessment.investmentTiers.map((tier, index) => (
            <div className="source-provenance" key={index}>
              <strong>
                {tier.tier} · {tier.scope}
              </strong>
              <p>
                Effort: {tier.effort} · Confidence: {tier.confidence}
              </p>
              {tier.acceptance && <p>Proposed acceptance: {tier.acceptance}</p>}
            </div>
          ))}
        </>
      )}
      <div className="source-provenance">
        <strong>Verification boundary</strong>
        <ul>
          {assessment.limitations.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
