const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepareTestDrive}=require('../../scripts/try-geezo');
test('fresh test-drive profile starts empty with scheduled AI off and never overwrites tester settings',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'geezo-pilot-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.equal(prepareTestDrive(dir),dir);const file=path.join(dir,'settings.json');const initial=JSON.parse(fs.readFileSync(file));
 assert.deepEqual(initial.portfolio.roots,[]);assert.equal(initial.allIn.enabled,false);assert.equal(initial.geezoSays.enabled,false);assert.equal(initial.analysis.adapter,'codex');
 fs.writeFileSync(file,JSON.stringify({portfolio:{roots:['/my/projects']},allIn:{enabled:true}}));const before=fs.readFileSync(file);prepareTestDrive(dir);assert.deepEqual(fs.readFileSync(file),before);
});
