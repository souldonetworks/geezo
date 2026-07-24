const { execSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function getTargets() {
  return [
    { platform: 'darwin-arm64', bunTarget: 'bun-darwin-arm64', outfile: 'geezo-darwin-arm64' },
    { platform: 'darwin-x64', bunTarget: 'bun-darwin-x64', outfile: 'geezo-darwin-x64' },
    { platform: 'linux-x64', bunTarget: 'bun-linux-x64', outfile: 'geezo-linux-x64' },
    { platform: 'linux-arm64', bunTarget: 'bun-linux-arm64', outfile: 'geezo-linux-arm64' },
    { platform: 'windows-x64', bunTarget: 'bun-windows-x64', outfile: 'geezo-windows-x64.exe' },
  ];
}

function checkBunAvailable() {
  try {
    execSync('command -v bun', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (require.main === module) {
  if (!checkBunAvailable()) {
    console.error('bun was not found on this machine. Install it with one of:');
    console.error('  curl -fsSL https://bun.sh/install | bash');
    console.error('  brew install bun');
    process.exit(1);
  }

  execSync('npm run build:web', { stdio: 'inherit' });
  execSync('node scripts/generate-assets-manifest.js', { stdio: 'inherit' });

  fs.mkdirSync('dist-bin', { recursive: true });

  const targets = getTargets();
  for (const target of targets) {
    try {
      execFileSync(
        'bun',
        [
          'build',
          '--compile',
          'server/cli.js',
          '--target=' + target.bunTarget,
          '--outfile',
          path.join('dist-bin', target.outfile),
        ],
        { stdio: 'inherit' }
      );
    } catch {
      console.error(`Build failed for target ${target.platform} — stopping (remaining targets not attempted).`);
      process.exit(1);
    }
  }

  console.log(
    `Built ${targets.length} binaries: ${targets.map((t) => path.join('dist-bin', t.outfile)).join(', ')}`
  );
}

module.exports = { getTargets, checkBunAvailable };
