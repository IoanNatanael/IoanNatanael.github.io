/* E10-P1: pure, deterministic OFFLINE sequence dry-run. No hardware, web or storage calls.
 * A visualization/test model of the existing 4-minute safe-segment policy, NOT
 * a replacement for HydroforAutomationEngine or a real ESP-NOW confirmation.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HidroforSequenceDryRun = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_STEPS = 16;
  const MAX_TOTAL_SECONDS = 4 * 60 * 60;
  const SEGMENT_SECONDS = 4 * 60;
  const REST_SECONDS = 30;
  const DEFAULT_PLAN = Object.freeze({
    version:1, name:'Udare dimineața', start:'07:00', steps:[
      {type:'ON',minutes:10},{type:'OFF',minutes:20},{type:'ON',minutes:30}
    ]
  });
  function isObject(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function normalized(input) {
    if (!isObject(input)) throw new Error('Program invalid.');
    if (input.version !== 1) throw new Error('Versiune de program necunoscută.');
    const name = typeof input.name==='string' ? input.name.trim() : '';
    if (!name || name.length > 60 || /[\x00-\x1f]/.test(name)) throw new Error('Numele trebuie să aibă 1–60 de caractere.');
    if (typeof input.start !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start)) throw new Error('Ora trebuie să fie HH:MM.');
    if (!Array.isArray(input.steps) || input.steps.length<1 || input.steps.length>MAX_STEPS) throw new Error('Sunt permise 1–16 pași.');
    let hasOn = false;
    const steps = input.steps.map((x,i)=>{
      if (!isObject(x) || (x.type!=='ON' && x.type!=='OFF') || !Number.isInteger(x.minutes) || x.minutes<1 || x.minutes>120) {
        throw new Error('Pasul '+(i+1)+' trebuie să fie ON/OFF și 1–120 minute.');
      }
      if (x.type==='ON') hasOn=true;
      if (i && x.type===input.steps[i-1].type) throw new Error('Alternați ON și OFF (pașii '+i+' și '+(i+1)+').');
      return {type:x.type,minutes:x.minutes};
    });
    if (!hasOn) throw new Error('Programul trebuie să conțină cel puțin un pas ON.');
    return {version:1,name,start:input.start,steps};
  }
  function build(input, options) {
    const plan=normalized(input);
    const segments=[];
    let sec=0, pumpSec=0, userOffSec=0, pauseSec=0;
    const append=(state,duration,step,detail)=>{
      if (duration<=0) return;
      segments.push({from:sec,to:sec+duration,state,step,detail}); sec+=duration;
      if (state==='ON') pumpSec+=duration;
      else if (state==='OFF') userOffSec+=duration;
      else if (state==='REST') pauseSec+=duration;
    };
    plan.steps.forEach((step,i)=>{
      if (step.type==='OFF') {append('OFF',step.minutes*60,i+1,'Pauză programată');return;}
      let remaining=step.minutes*60;
      while (remaining>0) {
        const segment=Math.min(remaining,SEGMENT_SECONDS);
        append('ON',segment,i+1,'Segment solicitat · maxim 4 min');
        remaining-=segment;
        if (remaining>0) append('REST',REST_SECONDS,i+1,'Pauză de protecție · 30 s');
      }
    });
    if (sec>MAX_TOTAL_SECONDS) throw new Error('Execuția simulată depășește limita conservatoare de 4 ore. Reduceți duratele.');
    // Fault injection is a VISUAL model: hardware STOP is NOT issued here.
    const faultSec=options && options.faultAtSeconds != null ? options.faultAtSeconds : null;
    if (faultSec !== null) {
      if (!Number.isInteger(faultSec) || faultSec<0 || faultSec>sec) throw new Error('Momentul defectului este invalid.');
      const labels={LINK:'Pierderea ESP-NOW',DRY:'Fără apă',BATTERY:'Baterie critică',RTC:'Ceas invalid'};
      const faultName=options.faultType && labels[options.faultType] ? labels[options.faultType] : 'Defect';
      const interrupted=[];
      for (const segment of segments) {
        if (segment.from>=faultSec) break;
        interrupted.push(segment.to>faultSec ? {...segment,to:faultSec} : segment);
      }
      const finalPump=interrupted.filter(s=>s.state==='ON').reduce((a,s)=>a+s.to-s.from,0);
      const finalOff=interrupted.filter(s=>s.state==='OFF').reduce((a,s)=>a+s.to-s.from,0);
      const finalRest=interrupted.filter(s=>s.state==='REST').reduce((a,s)=>a+s.to-s.from,0);
      return {plan,segments:interrupted,totalSeconds:faultSec,pumpSeconds:finalPump,
        offSeconds:finalOff,restSeconds:finalRest,finished:false,fault:true,
        event:{at:faultSec,message:'DEFECT SIMULAT ('+faultName+') — program întrerupt, pompă OFF (model)'}};
    }
    return {plan,segments,totalSeconds:sec,pumpSeconds:pumpSec,offSeconds:userOffSec,
      restSeconds:pauseSec,finished:true,fault:false,event:null};
  }
  function stateAt(result, seconds) {
    if (!result || !Number.isFinite(seconds)) throw new Error('Simulare invalidă.');
    const t=Math.max(0,Math.min(result.totalSeconds,seconds));
    if (result.fault && t===result.totalSeconds) return {state:'FAULT',step:null,detail:result.event.message};
    if (t>=result.totalSeconds) return {state:'DONE',step:null,detail:'Program terminat · pompă OFF'};
    const s=result.segments.find(s=>t>=s.from && t<s.to);
    return s?{state:s.state,step:s.step,detail:s.detail}: {state:'DONE',step:null,detail:'Pompă OFF'};
  }
  function wallClock(start,seconds) {
    const h=Number(start.slice(0,2)),m=Number(start.slice(3));
    const mins=(h*60+m+Math.floor(seconds/60))%(24*60);
    return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  }
  return Object.freeze({DEFAULT_PLAN,MAX_STEPS,SEGMENT_SECONDS,REST_SECONDS,
    normalized,build,stateAt,wallClock});
});

/* Shared, deterministic, read-only decision model. No device or network access. */
(function(root,factory){
  'use strict';
  const sequence=typeof module!=='undefined'&&module.exports?module.exports:root.HidroforSequenceDryRun;
  const api=factory(sequence);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.HidroforAdvancedPrograms=api;
})(typeof globalThis==='object'?globalThis:this,function(sequence){
  'use strict';
  if(!sequence)throw new Error('Motorul de secvențe nu este disponibil.');
  const knownScopes=['s1','s2','both','one'];
  const finiteWithin=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
  function checkedConfig(input){
    if(!input||typeof input!=='object')throw new Error('Configurație invalidă.');
    const {mode}=input,plan=sequence.normalized(input.plan);
    sequence.build(plan); // Includes the existing conservative four-hour limit.
    if(mode==='FIX'||mode==='SEQUENCE')return plan;
    if(mode==='SMART'){
      const cfg=input.smart||{},metric=cfg.metric,rule=cfg.rule;
      if(!['temperature','humidity'].includes(metric)||!['under','between','above'].includes(rule)||!knownScopes.includes(cfg.scope))
        throw new Error('Alege senzorul, condiția și sera pentru SMART.');
      const min=metric==='temperature'?-40:0,max=metric==='temperature'?85:100;
      if(!finiteWithin(cfg.low,min,max)||(rule==='between'&&(!finiteWithin(cfg.high,min,max)||cfg.low>=cfg.high)))
        throw new Error('Pragurile SMART sunt invalide.');
      return plan;
    }
    if(mode==='ADAPTIVE'){
      const cfg=input.adaptive||{};
      if(!['s1','s2','average'].includes(cfg.source))throw new Error('Alege sursa temperaturii pentru ADAPTIV.');
      if(!finiteWithin(cfg.low,-40,85)||!finiteWithin(cfg.high,-40,85)||cfg.low>=cfg.high)
        throw new Error('Intervalele ADAPTIV trebuie să aibă două praguri crescătoare între -40 și 85°C.');
      if(!Array.isArray(cfg.durations)||cfg.durations.length!==3||!cfg.durations.every(v=>Number.isInteger(v)&&v>=1&&v<=120))
        throw new Error('Fiecare interval ADAPTIV trebuie să aibă între 1 și 120 minute.');
      return plan;
    }
    throw new Error('Mod de simulare necunoscut.');
  }
  function validateConfig(input){
    try{checkedConfig(input);return {ok:true,reason:''};}
    catch(error){return {ok:false,reason:error instanceof Error?error.message:'Configurație invalidă.'};}
  }
  function readings(input,scope,metric,requireBoth,requireFullClimate){
    const now=input.nowMs,maxAge=input.maxAgeMs,pair=input.climate;
    if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(maxAge)||maxAge<1||maxAge>5400000)
      throw new Error('Momentul sau limita de prospețime este invalidă.');
    const requested=scope==='s1'?[1]:scope==='s2'?[2]:[1,2];
    const toCheck=requireBoth?[1,2]:requested;
    const values=toCheck.map(n=>{
      const item=pair?.['sera'+n],name='Sera '+n;
      if(!item||item.present!==true||item.online!==true||item.source!==n||item.acceptedProvenance!==true)
        throw new Error(name+': date indisponibile sau sursă nevalidată.');
      if(!Number.isSafeInteger(item.climateReceivedMs)||item.climateReceivedMs<0||item.climateReceivedMs>now||now-item.climateReceivedMs>=maxAge)
        throw new Error(name+': date expirate sau moment invalid.');
      const t=item.temperatureC,h=item.humidityPercent;
      if((requireFullClimate||metric==='temperature')&&!finiteWithin(t,-40,85))throw new Error(name+': temperatură invalidă.');
      if((requireFullClimate||metric==='humidity')&&!finiteWithin(h,0,100))throw new Error(name+': umiditate invalidă.');
      return {greenhouse:n,temperatureC:t,humidityPercent:h,receivedAtMs:item.climateReceivedMs};
    });
    return values.filter(item=>requested.includes(item.greenhouse));
  }
  function simulate(input){
    try{
      const plan=checkedConfig(input),{mode}=input;
      if(mode==='FIX'||mode==='SEQUENCE')return {eligible:true,reason:'Program pregătit pentru simulare.',plan,result:sequence.build(plan),decision:{mode}};
      if(mode==='SMART'){
        const cfg=input.smart||{},metric=cfg.metric,rule=cfg.rule,scope=cfg.scope;
        const samples=readings(input,scope,metric,input.requireBoth===true,input.requireFullClimate===true);
        const checks=samples.map(item=>{
          const value=metric==='temperature'?item.temperatureC:item.humidityPercent;
          const matches=rule==='under'?value<cfg.low:rule==='between'?value>=cfg.low&&value<cfg.high:value>=cfg.low;
          return {greenhouse:item.greenhouse,value,matches,receivedAtMs:item.receivedAtMs};
        });
        const eligible=scope==='one'?checks.some(x=>x.matches):checks.every(x=>x.matches);
        const decision={mode,metric,rule,scope,low:cfg.low,high:rule==='between'?cfg.high:null,checks};
        if(!eligible)return {eligible:false,reason:'Condiția SMART nu este îndeplinită.',plan:null,result:null,decision};
        return {eligible:true,reason:'Condiția SMART este îndeplinită în simulare.',plan,result:sequence.build(plan),decision};
      }
      if(mode==='ADAPTIVE'){
        const cfg=input.adaptive||{};
        const samples=readings(input,cfg.source==='average'?'both':cfg.source,'temperature',input.requireBoth===true,input.requireFullClimate===true);
        const temperatureC=cfg.source==='average'?(samples[0].temperatureC+samples[1].temperatureC)/2:samples[0].temperatureC;
        const band=temperatureC<cfg.low?0:temperatureC<cfg.high?1:2;
        const minutes=cfg.durations[band];
        const adjusted=sequence.normalized({version:1,name:plan.name,start:plan.start,steps:[{type:'ON',minutes}]});
        return {eligible:true,reason:'Durata ADAPTIV a fost aleasă pentru simulare.',plan:adjusted,result:sequence.build(adjusted),
          decision:{mode,source:cfg.source,temperatureC,band,minutes,evaluation:'la pornirea simulării; durata rămâne fixată',samples}};
      }
      throw new Error('Mod de simulare necunoscut.');
    }catch(error){return {eligible:false,reason:error instanceof Error?error.message:'Configurație invalidă.',plan:null,result:null,decision:null};}
  }
  return Object.freeze({validateConfig,simulate,sequence});
});
