async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(
      body.message || `Request to ${path} failed with ${res.status}`,
    );
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listProjects() {
  return request("/projects");
}

export function addProject(path) {
  return request("/projects", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export function scanDirectory(path) {
  return request(`/projects/scan?path=${encodeURIComponent(path)}`);
}

export function removeProject(id) {
  return request(`/projects/${id}`, { method: "DELETE" });
}

export function getRoadmap(id) {
  return request(`/projects/${id}/roadmap`);
}

export function getGit(id) {
  return request(`/projects/${id}/git`);
}

export function subscribeActivity(id, onUpdate) {
  const source = new EventSource(`/api/projects/${id}/activity/stream`);
  source.onmessage = (event) => onUpdate(JSON.parse(event.data));
  return () => source.close();
}

export function getSettings() {
  return request("/settings");
}

export function saveSettings(partial) {
  return request("/settings", { method: "PUT", body: JSON.stringify(partial) });
}

export function convertProject(path) {
  return request("/convert", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export function discoverProjects() {
  return request("/projects/discover", { method: "POST" });
}
export const getBrief = (id) => request(`/projects/${id}/brief`);
export const saveBrief = (id, body) =>
  request(`/projects/${id}/brief`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const acceptBrief = (id, body) =>
  request(`/projects/${id}/brief/accept`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const getAnalysisConfiguration = () =>
  request("/analysis/configuration");
export const startAnalysis = (id) =>
  request(`/projects/${id}/analysis`, { method: "POST" });
export const startPortfolioAnalysis = (projectIds) =>
  request("/analysis", {
    method: "POST",
    body: JSON.stringify({ projectIds }),
  });
export const getAnalysisJob = (id) => request(`/analysis/${id}`);
export const prepareMigration = (id) =>
  request(`/projects/${id}/migrations`, { method: "POST" });
export const listMigrations = (id) => request(`/projects/${id}/migrations`);
export const applyMigration = (id, migration) =>
  request(`/projects/${id}/migrations/${migration.id}/apply`, {
    method: "POST",
    body: JSON.stringify({ expectedFingerprint: migration.sourceFingerprint }),
  });
export const rollbackMigration = (id, migration) =>
  request(`/projects/${id}/migrations/${migration.id}/rollback`, {
    method: "POST",
  });
export const getBriefEvidence = (id, evidenceId) =>
  request(`/projects/${id}/brief/evidence/${evidenceId}`);
export const listBriefings = () => request("/briefings");
export const importAssessment = (id) =>
  request(`/projects/${id}/brief/import`, { method: "POST" });

export const resumeAnalysis = () =>
  request("/analysis/resume", { method: "POST" });
export const updateProjectMetadata = (id, metadata) =>
  request(`/projects/${id}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(metadata),
  });
export const searchRelatedProjects = (query, category = "all") =>
  request(
    `/related?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`,
  );
export const getRelatedProjects = (id) => request(`/projects/${id}/related`);
export const listAssessmentLenses = () => request("/lenses");
export const createAssessmentLens = (body) =>
  request("/lenses", { method: "POST", body: JSON.stringify(body) });
export const updateAssessmentLens = (id, body) =>
  request(`/lenses/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteAssessmentLens = (id, expectedVersion) =>
  request(`/lenses/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion }),
  });
export const getAllIn = () => request("/all-in");
export const runAllIn = () => request("/all-in/run", { method: "POST" });
export const getAllInReport = (id) => request(`/all-in/reports/${id}`);
export const listWorkspaces = () => request("/workspaces");
export const previewWorkspace = (body) =>
  request("/workspaces/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const createLinkedWorkspace = (plan) =>
  request(`/workspaces/${plan.id}/create`, {
    method: "POST",
    body: JSON.stringify({ expectedFingerprint: plan.sourceFingerprint }),
  });
export const archiveLinkedWorkspace = (id) =>
  request(`/workspaces/${id}/archive`, { method: "POST" });
export const restoreLinkedWorkspace = (id) =>
  request(`/workspaces/${id}/restore`, { method: "POST" });
