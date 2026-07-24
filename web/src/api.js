async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Request to ${path} failed with ${res.status}`);
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listProjects() {
  return request('/projects');
}

export function addProject(path) {
  return request('/projects', { method: 'POST', body: JSON.stringify({ path }) });
}

export function scanDirectory(path) {
  return request(`/projects/scan?path=${encodeURIComponent(path)}`);
}

export function removeProject(id) {
  return request(`/projects/${id}`, { method: 'DELETE' });
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
  return request('/settings');
}

export function saveSettings(partial) {
  return request('/settings', { method: 'PUT', body: JSON.stringify(partial) });
}

export function convertProject(path) {
  return request('/convert', { method: 'POST', body: JSON.stringify({ path }) });
}
