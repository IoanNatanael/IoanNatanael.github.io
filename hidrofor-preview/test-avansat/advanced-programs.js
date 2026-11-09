/* Program editor and dry-run preview only. No transport, scheduler or relay calls. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const engine=window.HidroforAdvancedPrograms;
  const seq=window.HidroforSequenceDryRun;
  if(!engine||!seq)return;
  const key='hidrofor-advanced-programs-v1';
  const modes=['SMART','SEQUENCE','ADAPTIVE'];
  const seedSteps=[{type:'ON',minutes:'10'},{type:'OFF',minutes:'20'},{type:'ON',minutes:'30'}];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const initial=()=>({selected:'',name:'Program nou',time:'07:00',steps:copy(seedSteps),
    smart:{scope:'s1',metric:'temperature',rule:'above',low:'28',high:'32',duration:'10'},
    adaptive:{source:'s1',low:'20',high:'30',durations:['5','8','10']},baseline:null});
  const models=Object.fromEntries(modes.map(mode=>[mode,initial()]));
  const state={mode:'SMART',records:[],storageError:false,timer:null,at:0,started:false,preview:null};
  const model=()=>models[state.mode];
  const text=(id,value)=>{byId(id).textContent=String(value);};
  const number=value=>{const s=String(value??'').trim();return s===''?NaN:Number(s);};
  const fmt=seconds=>Math.floor(seconds/60)+'m '+String(Math.floor(seconds%60)).padStart(2,'0')+'s';
  const snapshot=m=>JSON.stringify({name:m.name,time:m.time,steps:m.steps,smart:m.smart,adaptive:m.adaptive});
  const recordValid=x=>x&&typeof x.id==='string'&&modes.includes(x.mode)&&x.data&&typeof x.data==='object';
  function storageRead(){
    try{const raw=localStorage.getItem(key);if(raw===null)return [];const data=JSON.parse(raw);if(!Array.isArray(data))throw new Error();return data;}
    catch(_){state.storageError=true;return [];}
  }
  function storageWrite(records){
    if(state.storageError){storageMessage('Datele salvate nu pot fi citite; modificările sunt blocate.');return false;}
    try{localStorage.setItem(key,JSON.stringify(records));return true;}
    catch(_){storageMessage('Browserul nu permite salvarea locală.');return false;}
  }
  function storageMessage(message){const node=byId('ap-storage-status');node.textContent=message||'';node.hidden=!message;}
  function error(message){const box=byId('ap-error');box.textContent=message||'';box.hidden=!message;}
  function dirty(){
    const m=model();byId('ap-program-actions').hidden=!m.selected||!byId('ap-new-form').hidden;
    byId('ap-save').hidden=!m.selected||m.baseline===snapshot(m);
  }
  function showPrograms(){
    const m=model(),list=byId('ap-program-list');list.replaceChildren();
    for(const record of state.records.filter(r=>recordValid(r)&&r.mode===state.mode)){
      const b=document.createElement('button');b.type='button';b.textContent=String(record.data.name||'Program');
      b.setAttribute('aria-current',String(record.id===m.selected));
      b.addEventListener('click',()=>load(record.id));list.append(b);
    }
    text('ap-current-name',m.name+(m.selected?'':' · nesalvat'));dirty();
    if(state.storageError)storageMessage('Datele salvate nu pot fi citite; modificările sunt blocate.');
  }
  function formOpen(open){
    byId('ap-new-form').hidden=!open;byId('ap-new').hidden=open;
    byId('ap-new').setAttribute('aria-expanded',String(open));byId('ap-program-picker').open=false;
    if(open){byId('ap-name').value='';byId('ap-name').focus();}dirty();
  }
  const put=(id,value)=>{byId(id).value=String(value);};
  function writeForm(renderRows=true){
    const m=model();put('ap-time',m.time);put('ap-smart-low',m.smart.low);put('ap-smart-high',m.smart.high);put('ap-smart-duration',m.smart.duration);
    put('ap-adaptive-low',m.adaptive.low);put('ap-adaptive-high',m.adaptive.high);
    ['ap-adaptive-under','ap-adaptive-middle','ap-adaptive-above'].forEach((id,i)=>put(id,m.adaptive.durations[i]));
    document.querySelectorAll('[data-ap-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.apMode===state.mode)));
    document.querySelectorAll('[data-ap-panel]').forEach(p=>p.hidden=p.dataset.apPanel!==state.mode);
    for(const [attr,value] of [['scope',m.smart.scope],['metric',m.smart.metric],['rule',m.smart.rule],['reference',m.adaptive.source]])
      document.querySelectorAll('[data-ap-'+attr+']').forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-ap-'+attr)===value)));
    byId('ap-smart-high-wrap').hidden=m.smart.rule!=='between';
    const humidity=m.smart.metric==='humidity';
    for(const id of ['ap-smart-low','ap-smart-high']){byId(id).min=humidity?'0':'-40';byId(id).max=humidity?'100':'85';}
    const low=m.adaptive.low||'—',high=m.adaptive.high||'—';
    text('ap-band-low','Sub '+low+'°C');text('ap-band-middle','De la '+low+'°C până sub '+high+'°C');text('ap-band-high','De la '+high+'°C');
    byId('ap-climate').hidden=state.mode==='SEQUENCE';if(renderRows)renderSteps();showPrograms();
  }
  function readForm(){
    const m=model();m.time=byId('ap-time').value;
    m.smart.low=byId('ap-smart-low').value;m.smart.high=byId('ap-smart-high').value;m.smart.duration=byId('ap-smart-duration').value;
    m.adaptive.low=byId('ap-adaptive-low').value;m.adaptive.high=byId('ap-adaptive-high').value;
    m.adaptive.durations=['ap-adaptive-under','ap-adaptive-middle','ap-adaptive-above'].map(id=>byId(id).value);
  }
  function inputFor(m,mode){
    const steps=mode==='SEQUENCE'?m.steps.map(x=>({type:x.type,minutes:number(x.minutes)})):[{type:'ON',minutes:mode==='SMART'?number(m.smart.duration):10}];
    return {mode,plan:{version:1,name:m.name,start:m.time,steps},
      smart:{scope:m.smart.scope==='either'?'one':m.smart.scope,metric:m.smart.metric,rule:m.smart.rule,low:number(m.smart.low),high:number(m.smart.high)},
      adaptive:{source:m.adaptive.source,low:number(m.adaptive.low),high:number(m.adaptive.high),durations:m.adaptive.durations.map(number)}};
  }
  function save(asNew){
    const m=model(),name=asNew?byId('ap-name').value.trim():m.name;
    if(!name||name.length>60||/[\x00-\x1f]/.test(name)){storageMessage('Scrie un nume pentru program.');return;}
    const draft={...m,name},check=engine.validateConfig(inputFor(draft,state.mode));
    if(!check.ok){storageMessage(check.reason);return;}
    const existing=asNew?null:state.records.find(x=>recordValid(x)&&x.id===m.selected&&x.mode===state.mode);
    if(!asNew&&!existing){storageMessage('Alege un program din modul curent.');return;}
    const id=existing?.id||('ap-'+Date.now()+'-'+Math.random().toString(36).slice(2,9));
    const data={name,time:m.time,steps:copy(m.steps),smart:copy(m.smart),adaptive:copy(m.adaptive)};
    const record={id,mode:state.mode,version:1,data};
    const next=existing?state.records.map(x=>x===existing?record:x):[...state.records,record];
    if(!storageWrite(next))return;
    state.records=next;m.name=name;m.selected=id;m.baseline=snapshot(m);storageMessage('');formOpen(false);showPrograms();
  }
  function load(id){
    const r=state.records.find(x=>recordValid(x)&&x.id===id&&x.mode===state.mode);if(!r)return;
    const d=r.data;
    if(r.version!==1||typeof d.name!=='string'||typeof d.time!=='string'||!Array.isArray(d.steps)||d.steps.some(s=>!s||typeof s!=='object')||!d.smart||!d.adaptive||!Array.isArray(d.adaptive.durations)||d.adaptive.durations.length!==3){
      storageMessage('Acest program nu poate fi deschis; datele rămân păstrate.');return;
    }
    const candidate={...initial(),name:d.name,time:d.time,steps:copy(d.steps),smart:{...initial().smart,...d.smart},adaptive:{...initial().adaptive,...d.adaptive},selected:id};
    const valid=engine.validateConfig(inputFor(candidate,state.mode));
    if(!valid.ok){storageMessage('Program invalid; datele rămân păstrate. '+valid.reason);return;}
    stop();models[state.mode]=candidate;candidate.baseline=snapshot(candidate);state.started=false;state.at=0;
    byId('ap-program-picker').open=false;formOpen(false);storageMessage('');writeForm();preview();
  }
  function remove(){
    const m=model();if(!m.selected)return;const next=state.records.filter(x=>!recordValid(x)||x.id!==m.selected||x.mode!==state.mode);
    if(!storageWrite(next))return;state.records=next;m.selected='';m.baseline=null;showPrograms();storageMessage('');
  }
  function renderSteps(){
    const host=byId('ap-steps');host.replaceChildren();const m=model();
    m.steps.forEach((step,i)=>{
      const row=document.createElement('div');row.className='ap-step-row';
      const index=document.createElement('span');index.textContent=String(i+1);
      const type=document.createElement('button');type.type='button';type.className='ap-step-type';type.textContent=step.type==='ON'?'Udare':'Pauză';type.setAttribute('aria-label','Schimbă tipul pasului '+(i+1));
      type.addEventListener('click',()=>{step.type=step.type==='ON'?'OFF':'ON';renderSteps();changed();});
      const minutes=document.createElement('input');minutes.type='number';minutes.min='1';minutes.max='120';minutes.step='1';minutes.value=String(step.minutes);minutes.setAttribute('aria-label','Minute pas '+(i+1));
      minutes.addEventListener('input',()=>{step.minutes=minutes.value;changed();});
      const actions=document.createElement('div');actions.className='ap-step-controls';
      for(const [action,label,glyph] of [['up','Mută mai sus','↑'],['down','Mută mai jos','↓'],['remove','Șterge','×']]){
        const b=document.createElement('button');b.type='button';b.textContent=glyph;b.setAttribute('aria-label',label+' pasul '+(i+1));
        b.disabled=action==='up'&&i===0||action==='down'&&i===m.steps.length-1;
        b.addEventListener('click',()=>{if(action==='remove')m.steps.splice(i,1);else{const j=i+(action==='up'?-1:1);[m.steps[i],m.steps[j]]=[m.steps[j],m.steps[i]];}renderSteps();changed();});actions.append(b);
      }
      row.append(index,type,minutes,actions);host.append(row);
    });
    byId('ap-add-on').disabled=byId('ap-add-off').disabled=m.steps.length>=16;
  }
  function parseClock(raw){
    const x=String(raw||'').trim().match(/^(\d{2})[.\- ](\d{2})[.\- ](\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);if(!x)return NaN;
    const [,ds,ms,ys,hs,mins,ss='00']=x,d=Number(ds),m=Number(ms),y=Number(ys),h=Number(hs),min=Number(mins),sec=Number(ss);
    const t=new Date(y,m-1,d,h,min,sec);return t.getFullYear()===y&&t.getMonth()===m-1&&t.getDate()===d&&t.getHours()===h&&t.getMinutes()===min&&t.getSeconds()===sec?t.getTime():NaN;
  }
  function climate(){
    const unavailable={climate:{},nowMs:0,maxAgeMs:16*60*1000,status:'Date indisponibile.'};
    if(typeof forceMock!=='function'||!forceMock())return {...unavailable,status:'Proveniența datelor reale nu este confirmată; simularea condiționată este blocată.'};
    if(typeof uiState==='undefined'||!uiState.connected||typeof i3Fresh!=='function'||!i3Fresh()||!uiState.live)
      return {...unavailable,status:'Date DEMO indisponibile sau expirate.'};
    const live=uiState.live,nowMs=parseClock(live.dataOra),maxAgeMs=16*60*1000;
    if(!Number.isFinite(nowMs))return {...unavailable,status:'Data DEMO lipsește sau este invalidă.'};
    const pieces=[];const pair={};
    for(const [id,source] of [['sera1',1],['sera2',2]]){
      const g=live[id],seen=parseClock(g?.lastSeen),age=nowMs-seen;
      const online=!!g&&(g.online===true||(g.online==null&&String(g.status||'').toUpperCase()==='ONLINE'));
      const t=typeof v13CalValue==='function'?v13CalValue(g?.temp,'temp'):null,h=typeof v13CalValue==='function'?v13CalValue(g?.hum,'hum'):null;
      pair[id]={present:!!g,online,source,acceptedProvenance:true,climateReceivedMs:seen,temperatureC:t,humidityPercent:h};
      const timing=online&&Number.isFinite(seen)&&age>=0&&age<maxAgeMs;
      const needTemperature=state.mode==='ADAPTIVE'||model().smart.metric==='temperature';
      const temperatureValid=Number.isFinite(t)&&t>=-40&&t<=85,humidityValid=Number.isFinite(h)&&h>=0&&h<=100;
      const valid=timing&&(needTemperature?temperatureValid:humidityValid);
      pieces.push('Sera '+source+': '+(valid?((temperatureValid?t+'°C':'temperatură indisponibilă')+' · '+(humidityValid?h+'%':'umiditate indisponibilă')+' · '+Math.floor(age/1000)+' s'):(!online?'indisponibilă':'date invalide sau expirate')));
    }
    return {climate:pair,nowMs,maxAgeMs,status:'Date DEMO · '+pieces.join(' | ')};
  }
  function evaluate(){const data=climate();text('ap-climate-status',data.status);return engine.simulate({...inputFor(model(),state.mode),...data});}
  function stop(){if(state.timer!==null){clearInterval(state.timer);state.timer=null;}text('ap-play','▶ Simulează');}
  function decisionText(value){
    const d=value.decision;
    if(!d)return value.reason;
    if(d.mode==='SMART')return (value.eligible?'Condiție îndeplinită · ':'Condiție neîndeplinită · ')+d.checks.map(c=>'Sera '+c.greenhouse+': '+c.value+(d.metric==='temperature'?'°C':'%')+(c.matches?' ✓':' ✕')).join(' · ');
    if(d.mode==='ADAPTIVE'){const source={s1:'Sera 1',s2:'Sera 2',average:'Media serelor'}[d.source];return source+': '+d.temperatureC+'°C · udare '+d.minutes+' min';}
    return 'Secvență simulată · fără comandă reală';
  }
  function showEvaluation(value){
    state.preview=value.eligible?value:null;
    const timeline=byId('ap-timeline');timeline.replaceChildren();
    ['ap-band-low','ap-band-middle','ap-band-high'].forEach((id,i)=>byId(id).parentElement.classList.toggle('is-active',value.eligible&&value.decision?.mode==='ADAPTIVE'&&value.decision.band===i));
    if(!value.eligible){text('ap-state','BLOCAT');text('ap-decision',value.decision?decisionText(value):'Simulare indisponibilă.');error(value.decision?'':value.reason);for(const id of ['ap-requested','ap-total','ap-on','ap-rest','ap-start-clock','ap-end-clock'])text(id,'—');byId('ap-progress').disabled=true;byId('ap-play').disabled=true;text('ap-remaining','Rămase —');text('ap-adaptive-result','');return;}
    error('');text('ap-decision',state.mode==='ADAPTIVE'?'Durata este aleasă pentru simulare.':decisionText(value));
    text('ap-adaptive-result',state.mode==='ADAPTIVE'?decisionText(value):'');
    for(const segment of value.result.segments){const bar=document.createElement('span');bar.className='ap-segment '+segment.state.toLowerCase();bar.style.width=((segment.to-segment.from)/value.result.totalSeconds*100)+'%';bar.title='Pas '+segment.step+' · '+segment.state+' · '+fmt(segment.to-segment.from);timeline.append(bar);}
    const requested=value.plan.steps.filter(s=>s.type==='ON').reduce((sum,s)=>sum+s.minutes*60,0);
    const endClock=seq.wallClock(value.plan.start,value.result.totalSeconds)+(value.result.totalSeconds%60?':'+String(value.result.totalSeconds%60).padStart(2,'0'):'');
    text('ap-start-clock',seq.wallClock(value.plan.start,0));text('ap-end-clock',endClock);
    timeline.setAttribute('aria-label','Cronologia simulării, '+seq.wallClock(value.plan.start,0)+'–'+endClock+', '+fmt(requested)+' udare și '+fmt(value.result.restSeconds)+' pauze de protecție.');
    text('ap-requested',fmt(requested));text('ap-total',fmt(value.result.totalSeconds));text('ap-on',fmt(value.result.pumpSeconds));text('ap-rest',fmt(value.result.restSeconds));
    byId('ap-progress').max=String(value.result.totalSeconds);byId('ap-progress').disabled=false;byId('ap-play').disabled=false;progress();
  }
  function preview(){stop();state.at=0;state.started=false;showEvaluation(evaluate());}
  function progress(){
    if(!state.preview)return;const result=state.preview.result;state.at=Math.max(0,Math.min(result.totalSeconds,state.at));
    const s=seq.stateAt(result,state.at),label=!state.started?'Pregătit':s.state==='ON'?'POMPĂ ON':s.state==='OFF'?'PAUZĂ':s.state==='REST'?'PAUZĂ PROTECȚIE':'Finalizat';
    text('ap-state',label);text('ap-elapsed',fmt(state.at));text('ap-remaining','Rămase '+fmt(result.totalSeconds-state.at));byId('ap-progress').value=String(state.at);
    if(state.at>=result.totalSeconds)stop();
  }
  function play(){
    if(state.timer!==null){stop();return;}
    if(!state.started||!state.preview||state.at>=state.preview.result.totalSeconds){
      state.at=0;showEvaluation(evaluate());if(!state.preview)return;state.started=true;
    }
    // Freeze the evaluated plan and climate for this run; resuming does not re-evaluate.
    state.timer=setInterval(()=>{state.at=Math.min(state.preview.result.totalSeconds,state.at+15);progress();},250);
    text('ap-play','Ⅱ Pauză');progress();
  }
  function changed(){stop();state.at=0;state.started=false;readForm();writeForm(false);preview();}
  function init(){
    if(!byId('ap-dialog')||!byId('ap-open'))return;
    state.records=storageRead();writeForm();
    byId('ap-open').addEventListener('click',()=>{preview();const dialog=byId('ap-dialog');if(!dialog.open)dialog.showModal();dialog.querySelector('[data-ap-mode="'+state.mode+'"]').focus();});
    byId('ap-close').addEventListener('click',()=>byId('ap-dialog').close());
    byId('ap-dialog').addEventListener('close',()=>{stop();byId('ap-open').focus();});
    byId('ap-dialog').addEventListener('click',e=>{if(e.target===byId('ap-dialog'))byId('ap-dialog').close();});
    document.querySelectorAll('[data-ap-mode]').forEach(b=>b.addEventListener('click',()=>{if(state.mode===b.dataset.apMode)return;stop();readForm();state.mode=b.dataset.apMode;state.at=0;state.started=false;formOpen(false);storageMessage('');writeForm();preview();}));
    for(const [attr,obj,prop] of [['scope','smart','scope'],['metric','smart','metric'],['rule','smart','rule'],['reference','adaptive','source']])
      document.querySelectorAll('[data-ap-'+attr+']').forEach(b=>b.addEventListener('click',()=>{model()[obj][prop]=b.getAttribute('data-ap-'+attr);changed();}));
    for(const id of ['ap-time','ap-smart-low','ap-smart-high','ap-smart-duration','ap-adaptive-low','ap-adaptive-high','ap-adaptive-under','ap-adaptive-middle','ap-adaptive-above'])
      byId(id).addEventListener('input',changed);
    byId('ap-new').addEventListener('click',()=>formOpen(true));byId('ap-cancel-new').addEventListener('click',()=>{formOpen(false);byId('ap-new').focus();});
    byId('ap-save-new').addEventListener('click',()=>save(true));byId('ap-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save(true);}});
    byId('ap-save').addEventListener('click',()=>save(false));byId('ap-delete').addEventListener('click',remove);
    for(const [id,type] of [['ap-add-on','ON'],['ap-add-off','OFF']])byId(id).addEventListener('click',()=>{if(model().steps.length<16){model().steps.push({type,minutes:type==='ON'?'10':'5'});renderSteps();changed();}});
    byId('ap-play').addEventListener('click',play);byId('ap-restart').addEventListener('click',preview);
    byId('ap-progress').addEventListener('input',()=>{stop();if(!state.preview)return;state.started=true;state.at=Number(byId('ap-progress').value);progress();});
    preview();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
