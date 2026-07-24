const fs = require('node:fs');
const path = require('node:path');
const { statusDirFor, statusRootDir } = require('../server/lib/paths');

function handleTaskStart(input) {
  const cwd = input.cwd || process.cwd();
  const dir = statusDirFor(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${input.tool_use_id}.json`);
  const toolInput = input.tool_input || {};
  const payload = {
    agentType: toolInput.subagent_type || 'unknown',
    description: toolInput.description || '',
    startedAt: new Date().toISOString(),
    sessionId: input.session_id,
  };
  fs.writeFileSync(file, JSON.stringify(payload));
}

function handleTaskEnd(input) {
  const cwd = input.cwd || process.cwd();
  const file = path.join(statusDirFor(cwd), `${input.tool_use_id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function handleStop(input) {
  const root = statusRootDir();
  if (!fs.existsSync(root)) return;
  for (const projectHashDir of fs.readdirSync(root)) {
    const dirPath = path.join(root, projectHashDir);
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (data.sessionId === input.session_id) fs.unlinkSync(fullPath);
      } catch {
        continue;
      }
    }
  }
}

function handle(input) {
  try {
    if (!input || !input.hook_event_name) return;
    if (input.hook_event_name === 'PreToolUse' && input.tool_name === 'Task' && input.tool_use_id) {
      handleTaskStart(input);
    } else if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Task' && input.tool_use_id) {
      handleTaskEnd(input);
    } else if (input.hook_event_name === 'Stop') {
      handleStop(input);
    }
  } catch {
    // Hook failures must never surface to the user's Claude Code session.
  }
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    try {
      handle(JSON.parse(raw));
    } catch {
      // ignore malformed stdin
    }
    process.exit(0);
  });
}

module.exports = { handle };
