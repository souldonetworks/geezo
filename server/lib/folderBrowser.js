const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
function browseFolders(requested) {
  const preferred = path.join(os.homedir(), 'Code');
  const target = requested || (fs.existsSync(preferred) ? preferred : os.homedir());
  if (typeof target !== 'string' || !path.isAbsolute(target)) throw new Error('Choose an absolute folder path');
  const resolved = fs.realpathSync(target);
  if (!fs.statSync(resolved).isDirectory()) throw new Error('Choose a directory');
  const directories = fs.readdirSync(resolved, {withFileTypes:true}).filter(d=>d.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name));
  return {path:resolved,parent: path.dirname(resolved),truncated:directories.length>500,directories:directories.slice(0,500).map(d=>({name:d.name,path:path.join(resolved,d.name)}))};
}
module.exports = {browseFolders};
