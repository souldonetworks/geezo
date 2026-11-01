const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('../../web/node_modules/react');
const renderer = require('../../web/node_modules/react-test-renderer');
const { MemoryRouter, Routes, Route } = require('../../web/node_modules/react-router-dom');
const esbuild = require('../../web/node_modules/esbuild');
const {act} = renderer;
async function load(relative, stub = false) {
 const file=path.resolve(__dirname,'../../web/src',relative);
 const code=(await esbuild.build({entryPoints:[file],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime','react-router-dom'],plugins:stub?[{name:'unrelated-panels',setup(b){b.onLoad({filter:/(GsdMigrationPanel|ExecutiveBriefPanel|AnalysisPanel|ProjectMetadataPanel)\.jsx$/},()=>({contents:'export default function Panel(){return null}',loader:'jsx'}));}}]:[]})).outputFiles[0].text;
 const compiled=new Module(file,module);compiled.filename=file;compiled.paths=Module._nodeModulePaths(path.dirname(file));compiled._compile(code,file);return compiled.exports.default;
}


const response=data=>({ok:true,status:200,json:async()=>data});
test('folder picker selection fills the path without registering until Add',async t=>{
 const Add=await load('components/AddProjectDialog.jsx');
 const original=global.fetch;let root;const writes=[];
 global.fetch=async(url,opts={})=>{
  if(opts.method==='POST'){writes.push(JSON.parse(opts.body));return response({});}
  return response({path:'/Code/Game',parent:'/Code',directories:[],truncated:false});
 };
 t.after(()=>{if(root)act(()=>root.unmount());global.fetch=original;});
 await act(async()=>{root=renderer.create(React.createElement(Add,{onAdded:()=>{}}));});
 const button=text=>root.root.findAllByType('button').find(b=>b.children.join('').includes(text));
 await act(async()=>button('Browse folders').props.onClick());
 await act(async()=>button('Use this folder').props.onClick());
 assert.equal(root.root.findByProps({'aria-label':'Project folder'}).props.value,'/Code/Game');assert.equal(writes.length,0);
 await act(async()=>button('add project').props.onClick());assert.deepEqual(writes,[{path:'/Code/Game'}]);
});
test('activity completion refetches detail roadmap, including same-count replacement',async t=>{
 const Detail=await load('pages/ProjectDetail.jsx',true);
 const originalFetch=global.fetch,originalSource=global.EventSource;let root;const sources=[];let reads=0;
 global.fetch=async url=>{
  if(url.endsWith('/roadmap')){reads++;return response({phases:[{number:'1',title:'Phase',status:'pending',goal:'Goal',plans:[],successCriteria:['A visible outcome']}]});}
  if(url==='/api/briefings')return response([{id:'a',name:'Alpha'}]);
  return response({status:'no-repo'});
 };
 global.EventSource=class{constructor(url){this.url=url;sources.push(this)}close(){this.closed=true}};
 t.after(()=>{if(root)act(()=>root.unmount());global.fetch=originalFetch;global.EventSource=originalSource;});
 await act(async()=>{root=renderer.create(React.createElement(MemoryRouter,{initialEntries:['/project/a'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Routes,null,React.createElement(Route,{path:'/project/:id',element:React.createElement(Detail)}))));});
 assert.equal(reads,1);
 const emit=async entries=>act(async()=>sources[0].onmessage({data:JSON.stringify(entries)}));
 const agent={agentType:'builder',startedAt:'2026-11-01T00:00:00Z',sessionId:'one',description:'Build',elapsedMs:100};
 await emit([agent]);assert.equal(reads,1);
 await emit([{...agent,sessionId:'two'}]);assert.equal(reads,2);
 await emit([]);assert.equal(reads,3);
 await emit([]);assert.equal(reads,3);
 const refresh=root.root.findAllByType('button').find(b=>b.children.join('').includes('Refresh project'));
 await act(async()=>refresh.props.onClick());assert.equal(reads,4);
 const phase=root.root.findByProps({className:'stat'});await act(async()=>phase.props.onClick());
 assert.match(JSON.stringify(root.toJSON()),/A visible outcome/);
});

test('git milestone displays the resolved commit SHA', async t => {
 const Panel=await load('components/GitMilestonePanel.jsx');let root;
 t.after(()=>{if(root)act(()=>root.unmount());});
 await act(async()=>{root=renderer.create(React.createElement(Panel,{git:{status:'ok',tag:'v1',date:'today',message:'Release',commitSha:'0123456789abcdef'}}));});
 assert.equal(root.root.findByType('code').children.join(''),'0123456789abcdef');
});
