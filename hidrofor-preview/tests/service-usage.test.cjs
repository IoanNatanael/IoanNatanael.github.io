// Run with: node --test hidrofor-preview/tests/service-usage.test.cjs
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const html = readFileSync(join(__dirname, '../app.html'), 'utf8');
const block = html.slice(html.indexOf('// V13-S5 BEGIN'), html.indexOf('// V13-S5 END'));
const ok = {commands:'ok', events:'ok'};
const event = (state, time, extra={}) => ({source:'Hidrofor', severityKey:'info',
  title:'Hidrofor ' + (state === 'on' ? 'pornit' : 'oprit'),
  hidroforKey:state, hidrofor:state === 'on' ? 'Pornit' : 'Oprit', time, ...extra});
const command = (resultKey, title='Pornire hidrofor') => ({title, resultKey, time:'21-10-2026 12:00:00'});
function setup() {
  const nodes = {serviceUsageContent:{innerHTML:''}, serviceUsageDetails:{open:true}};
  const state = {commands:[], events:[], journalFetch:ok, connected:false, live:null};
  const context = vm.createContext({Date, console, uiState:state,
    $:id => nodes[id], forceMock:() => true,
    i3Fresh:() => state.connected && state.fresh !== false,
    escapeHtml:value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')});
  vm.runInContext(block + '\nthis.api = {v13WearTime, v13WearStats, v13WearConfirmation, v13WearDuration, v13WearReportedDuration, renderServiceUsage};', context);
  return {...context.api, state, nodes};
}
const api = setup();
test('all inline scripts parse as JavaScript', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length);
  scripts.forEach((match, index) => new vm.Script(match[1], {filename:'app-inline-' + index}));
});
test('S5 has no network calls, timers, persistence or hardware mutations', () => {
  assert.doesNotMatch(block, /\b(?:fetch|apiFetch|getJson|getText|setInterval|setTimeout|localStorage|sessionStorage|indexedDB|XMLHttpRequest)\s*[.(]/);
  assert.doesNotMatch(html.match(/<details[^>]*id="serviceUsageDetails"[\s\S]*?<\/details>/)[0], /<button|<input|<select/);
});
test('requests remain independent of confirmations and unknown is not success', () => {
  const commands = ['ok','blocked','error',undefined,'n/a'].map(key => command(key));
  commands.push(command('ok','STOP FORȚAT hidrofor'), command('ok','Mod automat hidrofor'), command('ok','__proto__'));
  const result = api.v13WearStats(commands, [], ok);
  assert.deepEqual(JSON.parse(JSON.stringify(result.requests.on)), {total:5,ok:1,blocked:1,error:1,unknown:2});
  assert.equal(result.requests.off.total, 1);
  assert.equal(result.requests.auto.total, 1);
  assert.equal(result.requests.other.total, 1);
  assert.equal(result.reports.on, 0);
  assert.equal(result.durationMs, null);
});
test('strict timestamps, leap dates, seconds and missing seconds', () => {
  for (const time of [null, false, {}, '', '31-02-2026 10:00:00', '21-10-2026 24:00:00',
    '21-10-2026 12:00:60', '21-10-2026 12:60:00', '21-10-2026 12:00', '29-02-2025 12:00:00']) {
    assert.equal(api.v13WearTime(time), null, String(time));
  }
  assert.equal(api.v13WearTime('29-02-2024 00:00:00'), Date.UTC(2024,1,29));
  assert.equal(api.v13WearTime('21.10.2026 12:00:00'), Date.UTC(2026,9,21,12));
});
test('newest-first explicit pairs sum precisely across midnight without mutating inputs', () => {
  const events = [event('off','22-10-2026 01:02:03'),event('on','21-10-2026 23:58:00'),
    event('off','21-10-2026 12:10:00'),event('on','21-10-2026 12:00:00')];
  const original = JSON.stringify(events);
  const result = api.v13WearStats([], events, ok);
  assert.equal(result.pairs, 2);
  assert.equal(result.durationMs, (64*60 + 3 + 10*60)*1000);
  assert.equal(api.v13WearDuration(result.durationMs), '1 h 14 min 3 s');
  assert.equal(JSON.stringify(events), original);
  // Repeated polls replace the batch, never add to an accumulated counter.
  assert.equal(api.v13WearStats([], events, ok).durationMs, result.durationMs);
  assert.equal(api.v13WearStats([], events.slice(0,1), ok).durationMs, null);
});
test('commands alone, open runs and orphan stops do not produce elapsed time', () => {
  const commands = [command('ok','Oprire hidrofor'),command('ok')];
  for (const events of [[],[event('on','21-10-2026 12:00:00')],[event('off','21-10-2026 12:10:00')]]) {
    assert.equal(api.v13WearStats(commands, events, ok).durationMs, null);
  }
});
test('generic snapshots, failures, wrong sources and conflicting state are not confirmations', () => {
  const start = event('on','21-10-2026 12:00:00');
  for (const extra of [{title:'Pornire blocata: hidrofor'}, {title:'Pornire esuata'}, {severityKey:'error'},
    {source:'Sera 1'}, {source:'Central'}, {hidroforKey:undefined},
    {hidrofor:undefined}, {hidrofor:''}, {hidrofor:'Oprit'}, {title:'Control automat activat'}]) {
    assert.equal(api.v13WearConfirmation({...start, ...extra}), '');
    assert.equal(api.v13WearStats([], [event('off','21-10-2026 12:10:00'),{...start,...extra}], ok).durationMs, null);
  }
});
test('any intermediate event, reboot or uncertainty breaks an interval', () => {
  for (const middle of [event('on','21-10-2026 12:05:00',{title:'Comunicatie pierduta'}),
    {source:'Central',title:'Boot sistem',time:'21-10-2026 12:05:00'},
    {source:'Sera 1',title:'Citire',time:'21-10-2026 12:05:00'}]) {
    const result = api.v13WearStats([], [event('off','21-10-2026 12:10:00'), middle, event('on','21-10-2026 12:00:00')], ok);
    assert.equal(result.durationMs, null);
  }
});
test('bad dates, malformed records and inverted clock order disable duration', () => {
  for (const events of [[event('on','21-10-2026 12:00:00'),event('off','21-10-2026 12:10:00')],
    [event('off','21-10-2026 12:10:00'),null,event('on','21-10-2026 12:00:00')],
    [event('off','21-10-2026 12:10:00'),event('on','invalid')]]) {
    const result = api.v13WearStats([], events, ok);
    assert.equal(result.ordered, false);
    assert.equal(result.durationMs, null);
  }
});
test('duplicate timestamps and identical duplicates never create/double runtime', () => {
  const on = event('on','21-10-2026 12:00:00'), off = event('off','21-10-2026 12:10:00');
  for (const events of [[off,off,on], [off,on,on], [event('off',on.time),on]]) {
    const result = api.v13WearStats([], events, ok);
    assert.equal(result.durationMs, null);
    assert.equal(result.excludedPairs, 1);
  }
  assert.equal(api.v13WearStats([], [on,event('off',on.time)], ok).durationMs, null);
});
test('both Bucharest clock-change days are excluded; ordinary overnight is allowed', () => {
  for (const [start,end] of [['29-03-2026 02:00:00','29-03-2026 05:00:00'],
    ['25-10-2026 02:00:00','25-10-2026 05:00:00'], ['24-10-2026 23:00:00','26-10-2026 00:00:00']]) {
    const result = api.v13WearStats([], [event('off',end),event('on',start)], ok);
    assert.equal(result.durationMs, null);
    assert.equal(result.excludedPairs, 1);
  }
});
test('feeds are independent, capped and unavailable differs from an empty valid batch', () => {
  const commands = Array(50).fill(command('ok'));
  const events = Array(160).fill(event('on','21-10-2026 12:00:00'));
  const result = api.v13WearStats(commands, events, ok);
  assert.equal(result.requests.on.total,40);
  assert.equal(result.reports.on,150);
  assert.equal(api.v13WearStats(commands, events, {commands:'error',events:'ok'}).commandFeed.rows.length,0);
  assert.equal(api.v13WearStats(commands, events, {commands:'ok',events:'error'}).requests.on.total,40);
  assert.equal(api.v13WearStats(null, null, ok).durationMs,null);
});
test('renderer distinguishes loading/error/empty, escapes live text and has no stale duration', () => {
  const {state,nodes,renderServiceUsage} = setup();
  state.journalFetch = {commands:'loading',events:'error'};
  renderServiceUsage();
  assert.match(nodes.serviceUsageContent.innerHTML,/Se încarcă/);
  assert.match(nodes.serviceUsageContent.innerHTML,/Sursă indisponibilă/);
  assert.doesNotMatch(nodes.serviceUsageContent.innerHTML,/<table>/);
  state.journalFetch = ok;
  state.connected = true;
  state.live = {stareHidrofor:'PORNIT',timpHidrofor:'00:02:03',hidroforNode:{
    online:true,configured:true,ack:'OK',pending:false,stopIntent:false,relay:'PORNIT',commandCounter:0}};
  renderServiceUsage();
  assert.match(nodes.serviceUsageContent.innerHTML,/00:02:03/);
  assert.match(nodes.serviceUsageContent.innerHTML,/nu zero/);
  state.fresh = false;
  renderServiceUsage();
  assert.doesNotMatch(nodes.serviceUsageContent.innerHTML,/00:02:03/);
  assert.match(nodes.serviceUsageContent.innerHTML,/Indisponibil/);
  state.fresh = true;
  state.live.hidroforNode.ack = '<img src=x onerror=alert(1)>';
  renderServiceUsage();
  assert.doesNotMatch(nodes.serviceUsageContent.innerHTML,/<img|00:02:03/);
  assert.match(nodes.serviceUsageContent.innerHTML,/&lt;img/);
  state.connected = false;
  renderServiceUsage();
  assert.doesNotMatch(nodes.serviceUsageContent.innerHTML,/&lt;img|00:02:03/);
});
test('duration input is strict and missing live fields stay unavailable', () => {
  assert.equal(api.v13WearReportedDuration('00:00:00'),'00:00:00');
  for (const value of [null,0,NaN,{},'0:00','00:60:00','-01:00:00','12 h','00:00:00<script>']) {
    assert.equal(api.v13WearReportedDuration(value),'Indisponibil');
  }
});
