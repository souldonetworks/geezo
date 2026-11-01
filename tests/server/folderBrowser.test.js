const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('folder browser lists only actual directories, returns absolute selection paths and does not register projects', () => {
  const {browseFolders} = require('../../server/lib/folderBrowser');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geezo-folders-'));
  try {
    fs.mkdirSync(path.join(dir,'Project A')); fs.writeFileSync(path.join(dir,'file'),'data'); fs.symlinkSync(dir,path.join(dir,'loop'));
    const result = browseFolders(dir);
    assert.equal(result.path, fs.realpathSync(dir));
    assert.deepEqual(result.directories.map(x=>x.name), ['Project A']);
    assert.equal(result.directories[0].path,path.join(fs.realpathSync(dir),'Project A'));
    assert.throws(()=>browseFolders('relative'),/absolute/);
    assert.throws(()=>browseFolders(path.join(dir,'file')),/directory/);
    assert.equal(fs.readdirSync(dir).length,3);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
