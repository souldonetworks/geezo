function aggregateOpportunities(records) {
  const byId = new Map();
  const conflicts = [];
  const bad = new Set();
  for (const item of records) {
    const prior = byId.get(item.id);
    if (
      prior &&
      (prior.amount !== item.amount ||
        prior.currency !== item.currency ||
        prior.metric !== item.metric)
    ) {
      bad.add(item.id);
      conflicts.push({
        id: item.id,
        message: "Conflicting amount, currency or metric",
      });
      continue;
    }
    byId.set(item.id, {
      ...item,
      projectIds: [
        ...new Set([...(prior?.projectIds || []), ...(item.projectIds || [])]),
      ],
    });
  }
  const opportunities = [...byId.values()];
  const totals = {};
  for (const item of opportunities) {
    if (bad.has(item.id)) continue;
    totals[item.currency] ??= {};
    totals[item.currency][item.metric] =
      (totals[item.currency][item.metric] || 0) + item.amount;
  }
  return { opportunities, totals, conflicts };
}
module.exports = { aggregateOpportunities };
