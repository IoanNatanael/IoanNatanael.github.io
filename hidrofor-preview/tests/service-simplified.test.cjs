// Service simplificat: node --test hidrofor-preview/tests/service-simplified.test.cjs
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {test}=require('node:test');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../app.html'),'utf8');
const block=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>-1&&b>a,start);
  return html.slice(a,b);
};
const sv=block('const sv2Models =','const sv2ControlModels =');
const models=vm.runInNewContext(sv+'\nsv2Models');
const exportCode=block('const V13_EXPORT_DATASETS =','const loadPageData =');
const journalCode=block('const renderServiceJournalOverview =','const renderSystemEvents =');
const eventsCode=block('const renderSystemEvents =','const updateStorageSummary =');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
test('Navigație: fără Utilizare și Comparație',()=>{
  assert.deepEqual(Array.from(models.hidrofor.topics,t=>t[0]),['stare','activitate']);
  assert.deepEqual(Array.from(models.central.topics,t=>t[0]),['citiri','sistem','istoric']);
  for(const id of ['sera1','sera2'])assert.deepEqual(Array.from(models[id].topics,t=>t[0]),['citiri','semnal']);
});
test('Export: doar două selectoare; niciun interval sau filtru calendaristic',()=>{
  const panel=block('id="serviceExportDetails"','id="hydroHistoryDetails"');
  assert.equal([...panel.matchAll(/<select\b/g)].length,2);
  assert.match(panel,/id="serviceExportSource"/);
  assert.match(panel,/id="serviceExportFormat"/);
  assert.doesNotMatch(panel,/serviceExportWindow|serviceExportFrom|serviceExportTo|type="date"/);
  assert.match(exportCode,/const windowName='7d'/);
  assert.match(exportCode,/const from='', to=''/);
  assert.doesNotMatch(exportCode,/serviceExportWindow|serviceExportFrom|serviceExportTo/);
});
test('Export: formează 40 / 150 / 168 în mod compatibil cu API',()=>{
  const code=exportCode.split("const v13ExportStatus =")[0];
  const api=vm.runInNewContext(code+'\n({v13ExportPayload,V13_EXPORT_DATASETS})',{Date});
  for(const [kind,cap] of [['commands',40],['events',150],['central',168],['sera1',168],['sera2',168]]){
    assert.equal(api.V13_EXPORT_DATASETS[kind].cap ?? (api.V13_EXPORT_DATASETS[kind].node?168:null),cap);
  }
  const csv=api.v13ExportPayload({source:'commands',format:'csv',windowName:'7d',from:'',to:'',
    simulated:true,items:[{time:'22-10-2026 12:00:00',source:'WEB',title:'Start',result:'OK',resultKey:'ok'}]});
  assert.match(csv.bytes,/^﻿time_local,source,title,result,result_key/);
  assert.equal(csv.manifest.simulated,true);
  const json=api.v13ExportPayload({source:'commands',format:'json',windowName:'7d',from:'',to:'',
    simulated:false,items:[]});
  assert.equal(JSON.parse(json.bytes).simulated,false);
});
test('Export: verificare de siguranță păstrată pentru dispozitivul real',()=>{
  assert.match(exportCode,/await v13ExportSafeToRead\(\)/);
  assert.match(exportCode,/remote\.relay==='OPRIT'/);
  assert.match(exportCode,/state\?\.timedRun\?\.active===true/);
  assert.match(exportCode,/getJson\(url\)/);
  assert.match(exportCode,/anchor\.download='hidrofor_'\+\(demo\?'DEMO_':''\)/);
  assert.match(exportCode,/receivedTimeBasis: demo && config\.node/);
});
test('Jurnal: un sumar compact, fără listă duplicată de alerte',()=>{
  assert.doesNotMatch(journalCode,/serviceJournalRecent|service-journal-counter|service-journal-latest/);
  assert.match(journalCode,/const alerts = uiState\.events\.filter\(serviceJournalIsAlert\)/);
  const state={journalFetch:{events:'ok',commands:'ok'},events:[
    {severityKey:'warn'},{severityKey:'error'},{severityKey:'critical'},{severityKey:'info'}
  ]};
  let markup='';
  const render=vm.runInNewContext(journalCode+'\nrenderServiceJournalOverview',{
    uiState:state,$:()=>({set innerHTML(x){markup=x;}}),
    serviceJournalIsAlert:e=>['warn','error','critical'].includes(e.severityKey),
    serviceJournalSeverity:e=>e.severityKey,
    escapeHtml:x=>String(x)
  });
  render();
  assert.match(markup,/3 alerte/);assert.match(markup,/1 atenție/);
  assert.doesNotMatch(markup,/details|service-journal-recent/);
  state.journalFetch.events='error';render();
  assert.match(markup,/Nu putem confirma absența alertelor/);
});
test('Jurnal: lista conține numai evenimente și nu dublează comenzile',()=>{
  const state={events:[{time:'22-10-2026 12:00:00',source:'Sera 1',severityKey:'warn',title:'Baterie slabă'}],
    commands:[{time:'22-10-2026 12:00:00',source:'WEB',title:'START'}],
    journalFetch:{events:'ok'},logSource:'all',logSeverity:'all'};
  const display={systemEventsFeed:{innerHTML:''},logsMeta:{textContent:''}};
  vm.runInNewContext(eventsCode+'\nrenderSystemEvents()',{
    uiState:state,$:id=>display[id],normalize:x=>String(x).toLowerCase(),
    serviceJournalSeverity:e=>e.severityKey,serviceJournalIsAlert:e=>e.severityKey==='warn',
    serviceJournalMatchesSearch:()=>true,parseRoDateTime:()=>1,
    setText:(id,v)=>display[id].textContent=v,renderServiceJournalOverview:()=>{},
    updateSystemFilterSummary:()=>{},
    systemLogItemHtml:e=>e.kind+':'+e.item.title,
    feedEmpty:m=>m
  });
  assert.match(display.systemEventsFeed.innerHTML,/event:Baterie slabă/);
  assert.doesNotMatch(display.systemEventsFeed.innerHTML,/command|START/);
  assert.match(display.logsMeta.textContent,/1 afișate din 1/);
});
test('Scripturile inline sunt sintactic valide',()=>{
  for(const [index,m] of scripts.entries())if(!m[1].includes('src='))new vm.Script(m[2],{filename:'inline-'+index});
});
