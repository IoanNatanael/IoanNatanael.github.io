// Service Console V1: tests de structură și navigare fără browser / dependențe.
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {test}=require('node:test');
const {Script,runInNewContext}=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../app.html'),'utf8');
const css=html.slice(html.indexOf('/* Service Console V1'),html.indexOf('/* V13-S2: doua subpagini',html.indexOf('/* Service Console V1')));
const js=html.slice(html.indexOf('// Service Console V1: UI-only'),html.indexOf('// End Service Console V1.'));
assert.ok(css.length>2000 && js.length>4000);
function setup(){
  const nodes={};
  function element(id,className='',parent=null){
    const self={id,className,parent,children:[],tagName:'DIV',hidden:false,open:false,
      innerHTML:'',textContent:'',value:'',dataset:{},listeners:{},
      classList:{contains(name){return self.className.split(/\s+/).includes(name)},
        add(name){if(!self.classList.contains(name))self.className+=' '+name}},
      appendChild(child){if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);
        child.parent=self;self.children.push(child);return child},
      prepend(child){if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);
        child.parent=self;self.children.unshift(child);return child},
      closest(selector){const id=selector.slice(1);let cursor=self;
        while(cursor){if(cursor.id===id)return cursor;cursor=cursor.parent;}return null},
      querySelector(selector){return find(self,selector)},
      addEventListener(name,cb){self.listeners[name]=cb}};
    nodes[id]=self;if(parent)parent.appendChild(self);return self;
  }
  function find(root,selector){
    if(!root)return null;const all=[];const walk=n=>n.children.forEach(child=>{all.push(child);walk(child)});walk(root);
    if(selector.startsWith('#'))return all.find(e=>e.id===selector.slice(1))||null;
    if(selector.startsWith('.'))return all.find(e=>e.classList.contains(selector.slice(1)))||null;
    return null;
  }
  const body=element('body'),page=element('page-sistem','page',body);
  const ctl=element('service-control','service-section-panel',page);
  const diag=element('service-diagnostic','service-section-panel',page);
  const ctlStage=element('sv2ControlStage','',ctl),diagStage=element('sv2DiagnosticStage','',diag);
  ['sv2Source','sv2Topics','sv2Breadcrumb','sv2DisplayTitle','sv2DisplayDescription','sv2LiveTag'].forEach(id=>element(id,'',diag));
  element('sv2Readout','',diagStage);
  ['sv2ControlChoices','sv2ControlTitle','sv2ControlDescription'].forEach(id=>element(id,'',ctl));
  const entries=[
    ['serviceTestDetails','service-test-panel',ctl],['rtc','r13-rtc-maintenance',ctl],
    ['ota','system-ota',ctl],['adminLogs','service-log-maintenance',ctl],['mockTools','mock-tools',ctl],
    ['link','service-links',diag],['serviceSensorDetails','service-sensors',diag],
    ['serviceCalibrationDetails','service-calibration',diag],['serviceUsageDetails','service-usage',diag],
    ['serviceExportDetails','service-export',diag],['hydroHistoryDetails','accordion',diag],
    ['greenhouseDiagnostics','diagnostics-sere',diag],['centralTechServiceDetails','central-tech-panel',diag],
    ['centralHourlyServiceDetails','central-history',diag],['systemJournal','system-logs',diag],
    ['systemMetrics','system-metrics',diag],['systemEeprom','system-eeprom',diag]
  ];
  for(const [id,cls,parent] of entries)element(id,cls,parent).tagName='DETAILS';
  element('historyActions','history-actions',nodes.hydroHistoryDetails);
  element('hydroHistorySort','history-sort',nodes.hydroHistoryDetails);
  const document={body:{classList:{add(name){body.classList.add(name)}}},
    querySelector(selector){const match=selector.match(/^#([\w-]+)\s+(.+)$/);return match?find(nodes[match[1]],match[2]):null}};
  const state={page:'sistem',serviceSection:'diagnostic',connected:true,
    greenhouseMobile:'sera2',live:{
      temperatura:'21 C',umiditate:'52 %',baterie:'12.5 V',baterieOk:true,
      solarInaOk:true,batteryInaOk:true,
      hidroforNode:{online:true,configured:true,relay:'OPRIT',mode:'MANUAL',ack:'OK',water:{fresh:true,state:'WET_READY'}},
      sera1:{online:true,lastSeen:'recent',temp:'23 C',hum:'51 %',batt:'3.70 V',signal:{rxCount:10}},
      sera2:{online:true,lastSeen:'recent',temp:'26 C',hum:'55 %',batt:'3.80 V',signal:{rxCount:18}}
    }};
  let loadedHourly=0;
  const context={uiState:state,document,$:id=>nodes[id]||null,
    escapeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
    setText:(id,value)=>{if(nodes[id])nodes[id].textContent=String(value)},
    forceMock:()=>true,i3Fresh:()=>true,
    greenhouseFreshness:()=>({stateClass:''}),normalize:v=>String(v??'').toLowerCase(),
    renderServiceTestPanel:()=>{},v13CalReset:()=>{},renderServiceCalibration:()=>{},
    loadCentralServiceHourly:()=>{loadedHourly++},GREENHOUSES:[{id:'sera1'},{id:'sera2'}]};
  const api=runInNewContext(js+'\n({sv2Init,sv2Select,sv2SetSource,sv2RenderControl,sv2State,sv2Models,sv2LiveDisplay})',context);
  api.sv2Init();
  return {api,nodes,state,ctlStage,diagStage,hourly:()=>loadedHourly};
}
test('JavaScript integral este sintactic valid',()=>{
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
    if(!match[1].includes('src='))new Script(match[2]);
});
test('Consola are doi selectori și un singur spațiu de lucru pe secțiune',()=>{
  for(const id of ['sv2ControlStage','sv2DiagnosticStage','sv2Source','sv2Topics'])assert.equal(
    [...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id);
  assert.match(css,/sv2-module\[hidden\]/);
  assert.match(css,/service-intro/);
});
test('Modulele existente sunt mutate o singură dată, cu sortarea accesibilă',()=>{
  const {api,nodes,ctlStage,diagStage}=setup();
  assert.equal(ctlStage.children.length,5);
  assert.equal(diagStage.children.length,13); // 12 module + readout
  assert.equal(nodes.hydroHistorySort.parent.id,'historyActions');
  api.sv2Init();
  assert.equal(ctlStage.children.length,5);
  assert.equal(diagStage.children.length,13);
});
test('În EEPROM, fiecare categorie arată doar panoul aferent',()=>{
  const {api,nodes}=setup();
  api.sv2Select('eeprom','stare');
  assert.equal(nodes.systemMetrics.hidden,false);
  assert.equal(nodes.systemEeprom.hidden,true);
  assert.equal(nodes.serviceExportDetails.hidden,true);
  api.sv2Select('eeprom','detalii');
  assert.equal(nodes.systemMetrics.hidden,true);
  assert.equal(nodes.systemEeprom.hidden,false);
  assert.equal(nodes.serviceExportDetails.hidden,true);
  api.sv2Select('eeprom','export');
  assert.equal(nodes.serviceExportDetails.hidden,false);
  assert.equal(nodes.systemEeprom.hidden,true);
});
test('Citirile se filtrează pe sera selectată, nu amestecă datele',()=>{
  const {api,nodes}=setup();
  api.sv2Select('sera1','citiri');
  assert.match(nodes.sv2Readout.innerHTML,/23 C/);
  assert.doesNotMatch(nodes.sv2Readout.innerHTML,/26 C/);
  api.sv2Select('sera2','citiri');
  assert.match(nodes.sv2Readout.innerHTML,/26 C/);
  assert.doesNotMatch(nodes.sv2Readout.innerHTML,/23 C/);
});
test('Hidroforul și jurnalul sunt panouri separate',()=>{
  const {api,nodes}=setup();
  api.sv2Select('hidrofor','activitate');
  assert.equal(nodes.hydroHistoryDetails.hidden,false);
  assert.equal(nodes.systemJournal.hidden,true);
  api.sv2Select('jurnal','evenimente');
  assert.equal(nodes.hydroHistoryDetails.hidden,true);
  assert.equal(nodes.systemJournal.hidden,false);
});
test('Citirile live expirate nu sunt prezentate drept curente',()=>{
  const {api,nodes,state}=setup();
  state.connected=false;
  api.sv2Select('central','citiri');
  assert.match(nodes.sv2Readout.innerHTML,/indisponibile|expirate/i);
});
test('Istoricul central își păstrează încărcarea la cerere',()=>{
  const {api,nodes,hourly}=setup();
  api.sv2Select('central','istoric');
  assert.equal(nodes.centralHourlyServiceDetails.open,true);
  assert.equal(hourly(),1);
});
test('Nu sunt rute POST / cronometre noi în modul de navigare',()=>{
  assert.doesNotMatch(js,/\b(?:fetch|apiFetch|setInterval|localStorage|sessionStorage)\s*\(/);
  assert.doesNotMatch(js,/\b(?:i3Execute|i3Panic|clearData)\s*\(/);
});
