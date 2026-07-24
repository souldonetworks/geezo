function inferCurrentPhase(roadmap) {
  if (!roadmap.phases.length) return null;
  const firstIncomplete = roadmap.phases.find((p) => p.status !== 'done');
  return firstIncomplete ? `Phase ${firstIncomplete.number}: ${firstIncomplete.title}` : 'All phases complete';
}

function computeProgress(roadmap, state) {
  if (state && state.progress && typeof state.progress.percent === 'number') {
    return {
      percent: state.progress.percent,
      currentPhase: state.currentPhase || inferCurrentPhase(roadmap),
      status: state.status || 'unknown',
      source: 'state',
    };
  }

  const allPlans = roadmap.phases.flatMap((p) => p.plans);
  const donePlans = allPlans.filter((p) => p.done).length;
  const percent = allPlans.length === 0 ? 0 : Math.round((donePlans / allPlans.length) * 100);

  return {
    percent,
    currentPhase: inferCurrentPhase(roadmap),
    status: 'unknown',
    source: 'roadmap-fallback',
  };
}

module.exports = { computeProgress };
