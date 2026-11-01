const fs = require("node:fs");
const path = require("node:path");
const registry = require("./registry");
const { briefSummary, getBriefRecord } = require("./briefStore");
const { getProjectStatus } = require("./discovery");
function getBriefings(jobs = []) {
  const latestJobs = new Map();
  for (const job of jobs) {
    const prior = latestJobs.get(job.projectId);
    if (!prior || String(job.createdAt) > String(prior.createdAt))
      latestJobs.set(job.projectId, job);
  }
  return registry.loadProjects().map((project) => {
    const brief = briefSummary(project.id);
    if (brief && project.brief?.evidenceId === brief.evidenceId)
      brief.freshness = project.brief.freshness;
    const record = getBriefRecord(project.id);
    const draft = record.revisions.find((r) => r.id === record.latestDraft);
    return {
      ...project,
      ...getProjectStatus(project),
      ...require("./projectMetadata").getProjectMetadata(project),
      brief,
      analysis: latestJobs.get(project.id) || null,
      hasPendingDraft: !!draft && draft.id !== record.acceptedRevision,
      draftRevisionId: draft?.id || null,
      draftSource: draft?.source || null,
      draftUpdatedAt: draft?.createdAt || null,
      importAvailable: fs.existsSync(
        path.join(project.path, ".planning", "research", "ASSESSMENT.md"),
      ),
    };
  });
}
module.exports = { getBriefings };
