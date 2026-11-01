const path = require("node:path");
const crypto = require("node:crypto");
const { gsdWebDir } = require("./paths");
const { readJson, writeJsonAtomic } = require("./atomicStore");
const { validateBrief } = require("./briefSchema");
function recordPath(projectId) {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) throw new Error("Invalid project ID");
  return path.join(gsdWebDir(), "briefs", `${projectId}.json`);
}
function getBriefRecord(projectId) {
  return readJson(recordPath(projectId), {
    schemaVersion: 1,
    acceptedRevision: null,
    latestHuman: null,
    latestDraft: null,
    revisions: [],
  });
}
function conflict() {
  throw Object.assign(new Error("The brief changed. Reload before saving."), {
    code: "REVISION_CONFLICT",
  });
}
function createRevision(
  projectId,
  {
    brief,
    source,
    parentRevision = null,
    expectedHead = parentRevision,
    evidenceId = null,
    evidence,
  },
) {
  if (!["human", "analysis"].includes(source))
    throw new Error("Invalid revision source");
  const record = getBriefRecord(projectId);
  const validated = validateBrief(brief, evidence);
  if (
    source === "human" &&
    expectedHead !==
      (record.latestHuman || record.acceptedRevision || record.latestDraft)
  )
    conflict();
  if (parentRevision && !record.revisions.some((r) => r.id === parentRevision))
    conflict();
  const revision = {
    schemaVersion: 1,
    promptVersion: "executive-review-v1",
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source,
    parentRevision,
    evidenceId,
    brief: validated,
  };
  record.revisions.push(revision);
  record[source === "human" ? "latestHuman" : "latestDraft"] = revision.id;
  writeJsonAtomic(recordPath(projectId), record);
  return revision;
}
function acceptRevision(projectId, { revisionId, expectedAcceptedRevision }) {
  const record = getBriefRecord(projectId);
  if (record.acceptedRevision !== expectedAcceptedRevision) conflict();
  if (!record.revisions.some((r) => r.id === revisionId))
    throw Object.assign(new Error("Revision not found"), { code: "NOT_FOUND" });
  record.acceptedRevision = revisionId;
  writeJsonAtomic(recordPath(projectId), record);
  return record;
}
function briefSummary(projectId) {
  const r = getBriefRecord(projectId);
  const revision = r.revisions.find(
    (v) => v.id === (r.acceptedRevision || r.latestHuman || r.latestDraft),
  );
  return revision
    ? {
        recommendation: revision.brief.recommendation.decision,
        acceptedRevision: r.acceptedRevision,
        latestDraft: r.latestDraft,
        evidenceId: revision.evidenceId,
        freshness: revision.evidenceId ? "unchecked" : "possibly-stale",
      }
    : null;
}
module.exports = {
  getBriefRecord,
  createRevision,
  acceptRevision,
  briefSummary,
};
