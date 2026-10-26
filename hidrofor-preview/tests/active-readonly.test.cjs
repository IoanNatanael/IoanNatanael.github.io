// ACTIVE I1: node --test hidrofor-preview/tests/active-readonly.test.cjs
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Script } = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const candidate = readFileSync(join(__dirname,'../app-active-readonly.html'),'utf8');
const demo = readFileSync(join(__dirname,'../app.html'),'utf8');
const scripts = [...candidate.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=> !/\bsrc=/.test(m[1]));
const core = scripts.map(x=>x[2]).join('\n');
const extractedSet = core.match(/const ACTIVE_SUPPORTED_GET = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(extractedSet,'ACTIVE_SUPPORTED_GET absent');
const paths=Array.from(extractedSet[1].matchAll(/'([^']+)'/g),m=>m[1]);
const block=core.match(/if \(window\.HIDROFOR_READ_ONLY && \(method !== 'GET' \|\|[\s\S]*?throw new Error\('ACTIVE_READ_ONLY_ROUTE_BLOCKED'\);\s*\}/);
assert.ok(block,'Guard absent');
const guards=new Function('method','requestedPath','window','ACTIVE_SUPPORTED_GET',
  block[0]+'\nreturn "allowed";');
const validate=(method,path,readOnly=true)=>{
  try {return guards(method,path,{HIDROFOR_READ_ONLY:readOnly},new Set(paths));}
  catch(e){return e.message;}
};
test('candidatul folosește sursa de UI integrală și păstrează fișierele R20',()=>{
  assert.match(candidate,/id="sv2Source"/);
  assert.match(candidate,/href="\.\/r18-schedules\.css/);
  assert.match(candidate,/src="\.\/r18-schedules\.js/);
  assert.match(demo,/window\.HIDROFOR_PREVIEW_ONLY = true;/);
  assert.match(candidate,/window\.HIDROFOR_PREVIEW_ONLY = false;/);
  assert.match(candidate,/window\.HIDROFOR_READ_ONLY = true;/);
  assert.match(candidate,/CANDIDAT ACTIVE · NUMAI CITIRE/);
  assert.match(candidate,/const forceMock = \(\) => false;/);
});
test('permite numai citirile reale acceptate de firmwareul ACTIVE',()=>{
  assert.deepEqual(paths,[
    '/api/live','/api/commands-feed','/api/events-feed','/api/hourly-chart','/api/storage'
  ]);
  for(const p of paths) assert.equal(validate('GET',p),'allowed');
});
test('blochează START, STOP, AUTO, PANIC și rutele de administrare',()=>{
  for(const route of ['/porneste','/opreste','/auto','/api/panic-stop',
    '/api/clear-events','/api/clear-commands','/api/set-time','/sterge-jurnale']) {
    assert.equal(validate('POST',route),'ACTIVE_READ_ONLY_ROUTE_BLOCKED',route);
    assert.equal(validate('GET',route),'ACTIVE_READ_ONLY_ROUTE_BLOCKED',route);
  }
});
test('blochează API-uri noi încă inexistente în ACTIVE',()=>{
  for(const route of ['/api/schedules','/api/timed','/api/timed/start','/api/schedules/save']) {
    assert.equal(validate('GET',route),'ACTIVE_READ_ONLY_ROUTE_BLOCKED',route);
    assert.equal(validate('POST',route),'ACTIVE_READ_ONLY_ROUTE_BLOCKED',route);
  }
});
test('orice POST către o rută altfel permisă rămâne blocat',()=>{
  for(const route of paths)assert.equal(validate('POST',route),'ACTIVE_READ_ONLY_ROUTE_BLOCKED');
});
test('guardul e plasat înaintea transportului HTTP și a obținerii tokenului',()=>{
  const start=core.indexOf('const apiFetch = async (url, options = {}) => {');
  const end=core.indexOf('const getJson = async',start);
  assert.ok(start>=0&&end>start);
  const part=core.slice(start,end);
  assert.ok(part.indexOf("throw new Error('ACTIVE_READ_ONLY_ROUTE_BLOCKED')")<
    part.indexOf('i10FetchAdminToken()'));
  assert.ok(part.indexOf("throw new Error('ACTIVE_READ_ONLY_ROUTE_BLOCKED')")<
    part.indexOf('window.fetch(requested, prepared)'));
  assert.equal([...core.matchAll(/window\.fetch\(/g)].length,2);
});
test('toate scripturile inline din candidat se parsează',()=>{
  assert.ok(scripts.length>0);
  for(const [i,chunk] of scripts.entries())new Script(chunk[2],{filename:'candidate-'+i});
});
