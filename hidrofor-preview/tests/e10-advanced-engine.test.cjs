'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../e10-advanced-engine.js');
const now=1000000,maxAgeMs=60000;
const plan={version:1,name:'Test',start:'07:00',steps:[{type:'ON',minutes:10}]};
const sample=(source,temperatureC=30,humidityPercent=45)=>({present:true,online:true,source,acceptedProvenance:true,climateReceivedMs:now-1000,temperatureC,humidityPercent});
const climate=()=>({sera1:sample(1,25,40),sera2:sample(2,30,60)});
const smart=(changes={})=>({mode:'SMART',plan,nowMs:now,maxAgeMs,climate:climate(),smart:{metric:'temperature',rule:'between',scope:'both',low:25,high:31,...changes}});
const adaptive=(changes={})=>({mode:'ADAPTIVE',plan,nowMs:now,maxAgeMs,climate:climate(),adaptive:{source:'s1',low:20,high:30,durations:[5,8,10],...changes}});

test('configuration validation is independent of sensor availability',()=>{
  assert.deepEqual(api.validateConfig({mode:'SMART',plan,smart:smart().smart}),{ok:true,reason:''});
  assert.equal(api.simulate({mode:'SMART',plan,smart:smart().smart}).eligible,false);
  assert.equal(api.validateConfig({mode:'ADAPTIVE',plan,adaptive:adaptive({low:30,high:20}).adaptive}).ok,false);
  assert.equal(api.validateConfig({mode:'ADAPTIVE',plan,adaptive:adaptive({durations:[5,8,0]}).adaptive}).ok,false);
  assert.equal(api.validateConfig({mode:'SMART',plan,smart:smart({rule:'bad'}).smart}).ok,false);
});
test('SMART boundary rules preserve the existing E10 conventions',()=>{
  const v=smart({scope:'s1',low:25,high:30});
  assert.equal(api.simulate(v).eligible,true,'between includes its lower bound');
  v.climate.sera1.temperatureC=30;assert.equal(api.simulate(v).eligible,false,'between excludes its upper bound');
  v.smart.rule='under';v.climate.sera1.temperatureC=25;assert.equal(api.simulate(v).eligible,false);
  v.climate.sera1.temperatureC=24.9;assert.equal(api.simulate(v).eligible,true);
  v.smart.rule='above';v.climate.sera1.temperatureC=25;assert.equal(api.simulate(v).eligible,true);
});
test('SMART requires trusted and fresh data for both sources in BOTH or ONE',()=>{
  const v=smart({scope:'one',rule:'above',low:29});assert.equal(api.simulate(v).eligible,true);
  for(const mutation of [s=>s.present=false,s=>s.online=false,s=>s.acceptedProvenance=false,s=>s.source=1,s=>s.climateReceivedMs=now-maxAgeMs,s=>s.climateReceivedMs=now+1,s=>s.temperatureC=NaN]){
    const x=smart({scope:'one',rule:'above',low:29});mutation(x.climate.sera2);
    assert.equal(api.simulate(x).eligible,false);
  }
  v.climate.sera2.climateReceivedMs=now-maxAgeMs+1;assert.equal(api.simulate(v).eligible,true);
});
test('single-source decisions ignore unrelated unavailable greenhouse unless stricter policy is requested',()=>{
  const v=smart({scope:'s1'});v.climate.sera2=null;assert.equal(api.simulate(v).eligible,true);
  v.requireBoth=true;assert.equal(api.simulate(v).eligible,false);
  const a=adaptive({source:'s2'});a.climate.sera1=null;assert.equal(api.simulate(a).eligible,true);
  a.adaptive.source='average';assert.equal(api.simulate(a).eligible,false);
});
test('humidity uses air readings, range boundaries and relevant data',()=>{
  const v=smart({metric:'humidity',rule:'under',scope:'s1',low:45});
  v.climate.sera1.temperatureC=null;assert.equal(api.simulate(v).eligible,true);
  v.requireFullClimate=true;assert.equal(api.simulate(v).eligible,false);
  v.requireFullClimate=false;v.climate.sera1.humidityPercent=101;assert.equal(api.simulate(v).eligible,false);
});
test('ADAPTIV uses configured exact durations and freezes the evaluated plan',()=>{
  const v=adaptive({source:'s1'});
  for(const [temperatureC,minutes,band] of [[19.9,5,0],[20,8,1],[29.9,8,1],[30,10,2]]){
    v.climate.sera1.temperatureC=temperatureC;const chosen=api.simulate(v);
    assert.equal(chosen.eligible,true);assert.equal(chosen.decision.band,band);assert.equal(chosen.result.pumpSeconds,minutes*60);
  }
  v.climate.sera1.temperatureC=25;const snapshot=api.simulate(v);v.climate.sera1.temperatureC=35;v.adaptive.durations[1]=99;
  assert.equal(snapshot.decision.minutes,8);assert.equal(snapshot.plan.steps[0].minutes,8);
  assert.match(snapshot.decision.evaluation,/fixată/);
  const average=adaptive({source:'average'});assert.equal(api.simulate(average).decision.temperatureC,27.5);
});
test('sequence timeline models explicit protection rests, fault and total limit',()=>{
  const p={...plan,steps:[{type:'ON',minutes:10},{type:'OFF',minutes:20},{type:'ON',minutes:30}]};
  const out=api.simulate({mode:'SEQUENCE',plan:p});assert.equal(out.eligible,true);
  assert.equal(out.result.pumpSeconds,40*60);assert.equal(out.result.offSeconds,20*60);
  assert.equal(out.result.restSeconds,9*30);assert.equal(out.result.totalSeconds,64*60+30);
  const fault=api.sequence.build(p,{faultType:'LINK',faultAtSeconds:360});assert.equal(fault.fault,true);assert.equal(api.sequence.stateAt(fault,360).state,'FAULT');
  const tooLong={...plan,steps:[{type:'ON',minutes:120},{type:'OFF',minutes:120}]};assert.equal(api.simulate({mode:'SEQUENCE',plan:tooLong}).eligible,false);
  assert.equal(api.validateConfig({mode:'SEQUENCE',plan:tooLong}).ok,false,'invalid total duration cannot be saved');
  assert.equal(api.simulate({mode:'SEQUENCE',plan:{...plan,steps:[{type:'ON',minutes:1},{type:'ON',minutes:1}]}}).eligible,false);
});
test('engine cannot send hardware commands or network writes',()=>{
  const source=fs.readFileSync(require.resolve('../e10-advanced-engine.js'),'utf8');
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
});
