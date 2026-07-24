const matter = require('gray-matter');

function parseState(markdown) {
  const { data, content } = matter(markdown);

  const sectionMatch = /## Current Position\n\n([\s\S]*?)(\n##|\n*$)/.exec(content);
  const sectionText = sectionMatch ? sectionMatch[1].trim() : '';

  const phaseMatch = /^Phase:\s*(.+)$/m.exec(sectionText);
  const statusMatch = /^Status:\s*(.+)$/m.exec(sectionText);

  return {
    milestone: data.milestone || null,
    status: data.status || null,
    progress: data.progress || null,
    stoppedAt: data.stopped_at || null,
    lastUpdated: data.last_updated || null,
    currentPhase: phaseMatch ? phaseMatch[1].trim() : null,
    currentStatus: statusMatch ? statusMatch[1].trim() : null,
  };
}

module.exports = { parseState };
