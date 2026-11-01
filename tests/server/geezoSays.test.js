const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
function setup(){process.env.GSD_WEB_HOME_OVERRIDE=fs.mkdtempSync(path.join(os.tmpdir(),'geezo-says-'));return require('../../server/lib/registry').addProject(fs.mkdtempSync(path.join(os.tmpdir(),'truck-project-')));}
function report(id){return {summary:'Ten ideas before I retire.',gaps:['Demand unvalidated.'],recommendations:Array.from({length:10},(_,i)=>({kind:i<5?'truck':'moonshot',workingName:'Idea '+i,projectIds:[id],pitch:'A proposed way to help a specific audience finish a useful job.',audience:'Proposed buyer',problem:'Unvalidated problem',existingIngredients:'Existing project building blocks',missingWork:'Proposed connector experiment',revenueScenario:{customers:100,annualPrice:10000},millionDollarMath:'Hypothetical annual revenue: 100 customers × $10,000 = $1,000,000. No validated demand.',firstExperiment:'Show a prototype to one prospective user.',killCriterion:'Stop if the intended user cannot identify a useful result.',geezoSays:'I have pagers older than this business model.',hardestLeap:'Validate the new workflow and buyer.',evidence:[{projectId:id,field:'description',observation:'Source purpose; not validated demand.'}]}))};}
test('Geezo pitches enforce five truck ideas and five moonshots with real sources',()=>{
 const p=setup();const {validateGeezoReport}=require('../../server/lib/geezoSays');const snap={projects:[{id:p.id}]};
 const validated=validateGeezoReport(report(p.id),snap);assert.equal(validated.recommendations.length,10);assert.match(validated.recommendations[0].millionDollarMath,/\$1,000,000 annually/);
 for(const alter of [r=>r.recommendations.pop(),r=>r.recommendations[0].kind='moonshot',r=>r.recommendations[0].projectIds=['invented'],r=>r.recommendations[0].evidence[0].projectId='invented',r=>r.recommendations[1].workingName=r.recommendations[0].workingName,r=>r.recommendations[0].revenueScenario.annualPrice=9999]){const r=report(p.id);alter(r);assert.throws(()=>validateGeezoReport(r,snap));}
});
test('Geezo report storage is independent and failed refresh preserves the prior ten',async()=>{
 const p=setup();const {createGeezoSaysService}=require('../../server/lib/geezoSays');let fail=false;
 const service=createGeezoSaysService({runner:async()=>{if(fail)throw new Error('Unavailable');return {output:JSON.stringify(report(p.id)),diagnostics:''};}});
 service.startRun();await service.whenIdle();const first=service.getState();assert.equal(first.run.status,'completed');assert.equal(first.schedule.time,'23:00');assert.equal(first.currentReport.recommendations.length,10);
 assert.equal(require('../../server/lib/allIn').createAllInService().getState().currentReportId,null);
 fail=true;service.startRun();await service.whenIdle();assert.equal(service.getState().run.status,'failed');assert.equal(service.getState().currentReport.id,first.currentReport.id);
});

test('nightly settings are independently configurable and reject invalid schedules',()=>{
 setup();const {loadSettings,saveSettings}=require('../../server/lib/settings');
 assert.equal(loadSettings().geezoSays.time,'23:00');const before=loadSettings().allIn;
 assert.equal(saveSettings({geezoSays:{time:'22:30'}}).geezoSays.time,'22:30');
 assert.deepEqual(loadSettings().allIn,before);
 assert.throws(()=>saveSettings({geezoSays:{time:'25:00'}}));assert.throws(()=>saveSettings({geezoSays:{timeZone:'Mars/Base'}}));
});
