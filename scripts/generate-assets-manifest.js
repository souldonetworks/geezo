const fs = require('node:fs');
const path = require('node:path');

function walk(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function toIdentifier(urlPath) {
  const sanitized = urlPath.replace(/[^a-zA-Z0-9]/g, '_');
  return `asset_${sanitized}`;
}

function toUrlPath(distDir, filePath) {
  const relative = path.relative(distDir, filePath).split(path.sep).join('/');
  return `/${relative}`;
}

function generateManifestSource(distDir) {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Cannot generate asset manifest: directory does not exist: ${distDir}`);
  }

  const serverDir = path.resolve(distDir, '..', '..', 'server');
  const files = walk(distDir).sort();

  const importLines = [];
  const manifestEntries = [];

  for (const filePath of files) {
    const urlPath = toUrlPath(distDir, filePath);
    const identifier = toIdentifier(urlPath);
    const relativeImportPath = path.relative(serverDir, filePath).split(path.sep).join('/');
    const importSpecifier = relativeImportPath.startsWith('.') ? relativeImportPath : `./${relativeImportPath}`;

    importLines.push(`import ${identifier} from "${importSpecifier}" with { type: "file" };`);
    manifestEntries.push(`  "${urlPath}": ${identifier},`);
  }

  const importBlock = importLines.join('\n');
  const manifestBlock = manifestEntries.join('\n');

  return `${importBlock}\n\nexport const manifest = {\n${manifestBlock}\n};\n`;
}

if (require.main === module) {
  const distDir = path.join(__dirname, '..', 'web', 'dist');
  const outFile = path.join(__dirname, '..', 'server', 'generatedAssets.mjs');

  const source = generateManifestSource(distDir);
  fs.writeFileSync(outFile, source);
  console.log(`Wrote asset manifest to ${outFile}`);
}

module.exports = { generateManifestSource };
