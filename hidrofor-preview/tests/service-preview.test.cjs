// Verificare statică preview Service + integrarea R20.
// Rulare: node --test hidrofor-preview/tests/service-preview.test.cjs
const {readFileSync, existsSync} = require('node:fs');
const {join} = require('node:path');
const {Script} = require('node:vm');
const {test} = require('node:test');
const assert = require('node:assert/strict');

const root = join(__dirname, '..');
const app = readFileSync(join(root, 'app.html'), 'utf8');
const wrapper = readFileSync(join(root, '../hidrofor-service-preview/index.html'), 'utf8');
const style = readFileSync(join(root, 'r18-schedules.css'), 'utf8');
const script = readFileSync(join(root, 'r18-schedules.js'), 'utf8');

test('Pagina separată încarcă aplicația de pe aceeași ramură', () => {
  assert.match(wrapper, /src="\.\.\/hidrofor-preview\/app\.html"/);
  assert.match(wrapper, /previewFrame\.src = '\.\.\/hidrofor-preview\/app\.html\?refresh='/);
  assert.match(wrapper, /data-page=\\"sistem\\"/);
  assert.match(wrapper, /data-service-section=\\"diagnostic\\"/);
  assert.doesNotMatch(wrapper, /ioannatanael\.github\.io\/hidrofor-preview/i);
});

test('S1–S6 sunt prezente și niciun ID unic Service nu este duplicat', () => {
  for (const id of [
    'serviceNodeDiagnostics','serviceJournalOverview','serviceSensorDetails',
    'serviceTestDetails','serviceUsageDetails','serviceCalibrationDetails',
    'serviceCalCapture','serviceTestStart','serviceTestStop'
  ]) {
    const found = [...app.matchAll(new RegExp('id="' + id + '"', 'g'))];
    assert.equal(found.length, 1, id);
  }
});

test('Modul demo rămâne explicit; nu sunt introduse rute hardware noi', () => {
  assert.match(app, /window\.HIDROFOR_PREVIEW_ONLY = true;/);
  assert.match(wrapper, /DEMO \/ WEB ONLY/);
  assert.match(app, /\/\/ V13-S6 BEGIN/);
  assert.match(app, /\/\/ V13-S5 BEGIN/);
});

test('V13-R20: fișiere locale reale și încărcare în pagina de lucru', () => {
  assert.ok(existsSync(join(root, 'r18-schedules.js')));
  assert.ok(existsSync(join(root, 'r18-schedules.css')));
  assert.match(app, /href="\.\/r18-schedules\.css\?v=2"/);
  assert.match(app, /src="\.\/r18-schedules\.js\?v=1"/);
  assert.match(script, /V13-R20/);
  assert.match(style, /V13-R20/);
  assert.match(style, /r12-refill-box/);
});

test('HTML scripturile inline și JavaScript-ul extern R20 se parsează', () => {
  const scripts = [...app.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc=/.test(match[0]));
  assert.ok(scripts.length >= 1);
  for (const [index, match] of scripts.entries()) new Script(match[1], {filename:'app-'+index});
  new Script(script, {filename:'r18-schedules.js'});
  for (const match of wrapper.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
    new Script(match[1], {filename:'service-preview-index.html'});
});
