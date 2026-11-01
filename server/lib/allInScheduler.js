const { loadSettings } = require("./settings");
function parts(config, date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}
function localDay(config, date) {
  const p = parts(config, date);
  return `${p.year}-${p.month}-${p.day}`;
}
function dueDailyKey(config, date) {
  const p = parts(config, date);
  const day = `${p.year}-${p.month}-${p.day}`;
  if (`${p.hour}:${p.minute}` >= config.time) return day;
  const previous = new Date(`${day}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}
function shouldRunDaily(config, state, date) {
  if (!config.enabled || ["queued", "running"].includes(state.run?.status))
    return false;
  return (
    !state.lastAttemptDay || state.lastAttemptDay < dueDailyKey(config, date)
  );
}
function startAllInScheduler(service) {
  let stopped = false;
  let timer;
  function tick() {
    if (stopped) return;
    try {
      const config = loadSettings().allIn;
      const state = service.getState();
      const now = new Date();
      if (shouldRunDaily(config, state, now))
        service.startRun({ reason: "daily", dayKey: dueDailyKey(config, now) });
    } catch (error) {
      console.error("All In scheduler:", error.message);
    }
    timer = setTimeout(tick, 60000);
    timer.unref();
  }
  setImmediate(tick);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
module.exports = { localDay, dueDailyKey, shouldRunDaily, startAllInScheduler };
