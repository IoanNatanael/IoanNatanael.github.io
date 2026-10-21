// V13-S6: rulare locală cu node --test hidrofor-preview/tests/service-calibration.test.cjs
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const html = readFileSync(join(__dirname, '../app.html'), 'utf8');
const start = html.indexOf('// V13-S6 BEGIN');
const end = html.indexOf('// V13-S6 END', start);
assert.ok(start > -1 && end > start, 'V13-S6 trebuie să existe în app.html');
const block = html.slice(start, end);

function setup() {
  const ids = ['serviceCalibrationDetails','serviceCalNode','serviceCalMetric','serviceCalReference',
    'serviceCalCapture','serviceCalClear','serviceCalLiveStatus','serviceCalCaptured',
    'serviceCalTime','serviceCalDeviation','serviceCalCorrection','serviceCalResultStatus','serviceCalParamsContent'];
  const nodes = Object.fromEntries(ids.map(id => [id, {value:'',innerHTML:'',textContent:'',
    open:id === 'serviceCalibrationDetails', disabled:false, events:{},
    addEventListener(name,handler){this.events[name]=handler;}}]));
  nodes.serviceCalNode.value='central';
  nodes.serviceCalMetric.value='temp';
  const state = {page:'sistem',serviceSection:'diagnostic',connected:true,live:{
    dataOra:'21-10-2026 14:20:05',temperatura:'23.6 C',umiditate:'58.3 %',
    baterie:'12.52 V',baterieOk:true,batteryInaOk:true,
    sera1:{online:true,lastSeen:'21-10-2026 14:12:00',temp:'24.2 C',hum:'61 %',batt:'3.88 V'},
    sera2:{online:true,lastSeen:'OLD',temp:'20 C',hum:'65 %',batt:'3.70 V'}
  }};
  let fresh = true;
  const $ = id => nodes[id] || null;
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const context = vm.createContext({
    GREENHOUSES:[{id:'sera1'},{id:'sera2'}], uiState:state, i3Fresh:()=>fresh,
    normalize:value=>String(value??'').toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,''),
    greenhouseFreshness:(stamp,online)=>({
      stateClass:!online?'offline':stamp==='OLD'?'stale-late':!stamp?'stale-warn':'',
      hintText:'recent'
    }),
    $,setText:(id,value)=>{if($(id))$(id).textContent=String(value);},
    forceMock:()=>true,
    GREENHOUSE_EXPECTED_WAKE_MINUTES:8,
    GREENHOUSE_DELAY_WARN_MINUTES:16,
    GREENHOUSE_DELAY_LATE_MINUTES:32,
    escapeHtml:esc
  });
  vm.runInContext(block + '\nthis.s6 = {v13CalState,v13CalNumber,v13CalValue,v13CalReference,' +
    'v13CalAvailable,v13CalDifference,v13CalCapture,v13CalReset,v13CalBind,renderServiceCalibration};',context);
  return {s6:context.s6,state,nodes,setFresh(value){fresh=value;}};
}
test('Toate scripturile inline sunt JavaScript valid',()=>{
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length);
  scripts.forEach((script,index)=>new vm.Script(script[1],{filename:'app-inline-'+index}));
});
test('S6 nu conține rețea, persistare, timer sau POST hardware',()=>{
  assert.doesNotMatch(block, /\b(?:fetch|apiFetch|getJson|getText|setInterval|setTimeout|localStorage|sessionStorage|indexedDB|XMLHttpRequest)\s*[.(]/);
  assert.doesNotMatch(block, /i3Execute|i3Panic|\/porneste|\/opreste/);
});
test('Parsează zecimale, unitățile proprii; respinge unități greșite',()=>{
  const {s6}=setup();
  assert.equal(s6.v13CalNumber('12,4'),12.4);
  assert.equal(s6.v13CalValue('24.3 °C','temp'),24.3);
  assert.equal(s6.v13CalValue('62 %','hum'),62);
  assert.equal(s6.v13CalValue('12.52 V','batt'),12.52);
  assert.equal(s6.v13CalValue('24 V','temp'),null);
  assert.equal(s6.v13CalValue('ERR 12.5 V','batt'),null);
});
test('Nu admite referințe imposibile sau text injectat',()=>{
  const {s6}=setup();
  for(const value of ['', 'NaN','1e6','20<script>',{},null]){
    assert.equal(s6.v13CalReference(value,'temp'),null);
  }
  assert.equal(s6.v13CalReference('101','hum'),null);
  assert.equal(s6.v13CalReference('-60','temp'),null);
  assert.equal(s6.v13CalReference('20,25','temp'),20.25);
});
test('Date proaspete: captează, calculează abaterea semnată și nu modifică live',()=>{
  const {s6,state,nodes}=setup();
  const original=JSON.stringify(state.live);
  s6.v13CalBind();
  assert.equal(s6.v13CalCapture(),true);
  nodes.serviceCalReference.value='24';
  s6.renderServiceCalibration();
  assert.equal(nodes.serviceCalDeviation.textContent,'-0.40 °C');
  assert.equal(nodes.serviceCalCorrection.textContent,'+0.40 °C');
  assert.equal(s6.v13CalState.capture.moment,'21-10-2026 14:20:05');
  assert.equal(JSON.stringify(state.live),original);
});
test('Captura rămâne fixă dacă vine altă măsurătoare live',()=>{
  const {s6,state,nodes}=setup();
  s6.v13CalCapture();
  nodes.serviceCalReference.value='24';
  state.live.temperatura='38 C';
  s6.renderServiceCalibration();
  assert.equal(nodes.serviceCalCaptured.textContent,'23.6 C');
  assert.equal(nodes.serviceCalDeviation.textContent,'-0.40 °C');
});
test('Telemetria ESP32 expirată blochează capturile noi',()=>{
  const {s6,nodes,setFresh}=setup();
  s6.v13CalCapture();
  nodes.serviceCalReference.value='24';
  setFresh(false);
  s6.renderServiceCalibration();
  assert.equal(nodes.serviceCalCapture.disabled,true);
  assert.equal(s6.v13CalCapture(),false);
  assert.match(nodes.serviceCalResultStatus.textContent,/istorică/);
});
test('Sera întârziată ori offline este respinsă',()=>{
  const {s6,state,nodes}=setup();
  nodes.serviceCalNode.value='sera2';
  assert.equal(s6.v13CalCapture(),false);
  nodes.serviceCalNode.value='sera1';
  nodes.serviceCalMetric.value='hum';
  assert.equal(s6.v13CalCapture(),true);
  assert.equal(s6.v13CalState.capture.raw,'61 %');
  state.live.sera1.online=false;
  assert.equal(s6.v13CalCapture(),false);
});
test('Măsurarea INA219 necesită validarea senzorului',()=>{
  const {s6,state,nodes}=setup();
  nodes.serviceCalMetric.value='batt';
  state.live.batteryInaOk=false;
  assert.equal(s6.v13CalCapture(),false);
  state.live.batteryInaOk=true;
  state.live.baterieOk=false;
  assert.equal(s6.v13CalCapture(),false);
  state.live.baterieOk=true;
  assert.equal(s6.v13CalCapture(),true);
  assert.equal(s6.v13CalState.capture.raw,'12.52 V');
});
test('Selectările nevalide și panourile ascunse nu pot capta date',()=>{
  const {s6,state,nodes}=setup();
  nodes.serviceCalNode.value='__proto__';
  assert.equal(s6.v13CalCapture(),false);
  nodes.serviceCalNode.value='central';
  nodes.serviceCalMetric.value='constructor';
  assert.equal(s6.v13CalCapture(),false);
  nodes.serviceCalMetric.value='temp';
  state.page='home';
  assert.equal(s6.v13CalCapture(),false);
  state.page='sistem';
  nodes.serviceCalibrationDetails.open=false;
  assert.equal(s6.v13CalCapture(),false);
});
test('Schimbarea senzorului și închiderea panoului resetează capturile',()=>{
  const {s6,nodes}=setup();
  s6.v13CalBind();
  assert.equal(s6.v13CalCapture(),true);
  nodes.serviceCalReference.value='24';
  nodes.serviceCalNode.value='sera1';
  nodes.serviceCalNode.events.change();
  assert.equal(s6.v13CalState.capture,null);
  assert.equal(nodes.serviceCalReference.value,'');
  nodes.serviceCalNode.value='central';
  s6.v13CalCapture();
  nodes.serviceCalibrationDetails.open=false;
  nodes.serviceCalibrationDetails.events.toggle();
  assert.equal(s6.v13CalState.capture,null);
});
test('Parametrii diagnostici sunt afișați, nu editați',()=>{
  const {s6,nodes}=setup();
  s6.v13CalBind();
  assert.match(nodes.serviceCalParamsContent.innerHTML,/16 min/);
  assert.match(nodes.serviceCalParamsContent.innerHTML,/32 min/);
  assert.match(nodes.serviceCalParamsContent.innerHTML,/Nu sunt expuse/);
});
