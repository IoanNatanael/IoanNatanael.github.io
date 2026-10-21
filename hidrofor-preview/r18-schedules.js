/* V13-R18 — only WEB UI: reuse existing i9 schedule controls and mock state. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const days = ['Du','Lu','Ma','Mi','Jo','Vi','Sa'];
  const safeTime = entry => {
    if (typeof entry.time === 'string' && /^\d\d:\d\d$/.test(entry.time)) return entry.time;
    const n = Number(entry.time);
    if (!Number.isInteger(n) || n < 0 || n > 2359 || n % 100 > 59) return null;
    return pad(Math.floor(n / 100)) + ':' + pad(n % 100);
  };
  const recurrence = e => {
    if (Number(e.mode) === 0) {
      const d = String(e.date || '');
      return /^\d{8}$/.test(d) ? `${d.slice(6,8)}.${d.slice(4,6)}` : 'o dată';
    }
    if (Number(e.mode) === 1) return 'zilnic';
    if (Number(e.mode) === 2) {
      const mask = Number(e.weekdays) || 0;
      const chosen = days.filter((_, i) => mask & (1 << i));
      return chosen.length > 3 ? `${chosen.length} zile/săpt.` : chosen.join(', ');
    }
    return e.repeat ? 'zilnic' : 'o dată';
  };
  function nextOccurrence(e, now) {
    const time = safeTime(e);
    if (!time) return null;
    const [h, min] = time.split(':').map(Number);
    const candidate = new Date(now);
    candidate.setHours(h, min, 0, 0);
    const mode = Number(e.mode);
    if (mode === 0) {
      const date = String(e.date || '');
      if (!/^\d{8}$/.test(date)) return null;
      candidate.setFullYear(Number(date.slice(0,4)), Number(date.slice(4,6))-1, Number(date.slice(6,8)));
      return candidate > now ? candidate : null;
    }
    if (mode === 2) {
      const mask = Number(e.weekdays) || 0;
      for(let j=0;j<8;j++) {
        const d = new Date(candidate); d.setDate(d.getDate()+j);
        if (d > now && (mask & (1 << d.getDay()))) return d;
      }
      return null;
    }
    if (candidate <= now) candidate.setDate(candidate.getDate()+1);
    return candidate;
  }
  function getSchedules() {
    if (typeof i9State !== 'undefined' && Array.isArray(i9State.items)) {
      return {items: i9State.items, available: i9State.available,
        suspended: !!(i9State.suspended || i9State.bootRearmRequired || i9State.needsFaultAck || i9State.rtcRecoveryRequired || !i9State.clockReady)};
    }
    return {items: [], available: false, suspended: false};
  }
  let modal, overview, lastTrigger;
  function renderSummary() {
    if (!overview) return;
    const data = getSchedules();
    const enabled = data.items.filter(e => !!e.enabled);
    const active = data.available && !data.suspended;
    const now = new Date();
    const upcoming = enabled.map(e => ({e, at:nextOccurrence(e, now)})).filter(x=>x.at).sort((a,b)=>a.at-b.at);
    const summary = $('r18ScheduleSummary');
    const hint = $('r18ScheduleHint');
    const times = $('r18ScheduleTimes');
    if (!summary || !hint || !times) return;
    const card = $('r18OpenSchedules');
    if (card) card.dataset.state = !data.available ? 'offline' : data.suspended ? 'paused' : 'active';
    if (!data.available) {
      summary.textContent = 'Programări · indisponibile';
      hint.textContent = 'Se verifică datele din centrală';
      times.replaceChildren();
      return;
    }
    summary.textContent = `${enabled.length} ${enabled.length === 1 ? 'programare activată' : 'programări activate'}`;
    if (!enabled.length) hint.textContent = data.items.length ? `${data.items.length} salvate · toate oprite` : 'Nicio programare salvată';
    else if (!active) hint.textContent = 'Suspendate · nu vor porni automat';
    else hint.textContent = upcoming.length ? 'Următoarele ore programate' : 'Nu există o pornire viitoare';
    times.replaceChildren();
    const shown = (active ? upcoming : enabled.map(e=>({e,at:nextOccurrence(e,now)})) ).slice(0,3);
    for (const {e,at} of shown) {
      const chip = document.createElement('span'); chip.className = 'r18-time-chip';
      const time = document.createElement('b'); time.textContent = safeTime(e) || '—';
      const label = document.createElement('span'); label.textContent = recurrence(e);
      chip.append(time,label); times.append(chip);
    }
    if (enabled.length > shown.length) {
      const more = document.createElement('span'); more.className='r18-overview-sub';
      more.textContent=`+${enabled.length-shown.length} altele`; times.append(more);
    }
  }
  function setView(view) {
    if (!modal) return;
    modal.dataset.view = view;
    for(const tab of modal.querySelectorAll('.r18-dialog-tab')) tab.setAttribute('aria-selected',String(tab.dataset.view===view));
    if (view === 'create') {
      const minutes = $('r18ScheduleMinutes');
      const refill = $('r18ScheduleRefill');
      if (minutes) minutes.value = $('autoTimerInput')?.value || '10';
      if (refill) refill.value = $('autoRefillMinutes')?.value || '10';
    }
  }
  function open(view, trigger) {
    if(!modal) return;
    lastTrigger = trigger;
    setView(view);
    if (!modal.open) modal.showModal();
    const focusTarget = modal.querySelector('.r18-dialog-tab[aria-selected="true"]');
    focusTarget?.focus({preventScroll:true});
  }
  function init() {
    const container = $('autoControlSection');
    const body = container?.querySelector('.r13-unified-body');
    const pane = $('r13SchedulePane');
    const now = $('r13NowPane');
    if(!container || !body || !pane || !now || $('r18ScheduleDialog')) return;
    // The legacy Now / Schedule tabs no longer belong to the AUTO screen.
    container.querySelector('.r13-start-picker')?.remove();
    now.hidden = false;
    overview = document.createElement('div');
    overview.className='r18-schedule-overview-wrap';
    overview.innerHTML = `
      <button id="r18OpenSchedules" class="r18-overview-card" data-state="active" type="button" aria-haspopup="dialog" aria-controls="r18ScheduleDialog">
        <span class="r18-overview-head"><strong id="r18ScheduleSummary">Programări automate</strong><span class="r18-overview-arrow" aria-hidden="true">↗</span></span>
        <span class="r18-overview-sub" id="r18ScheduleHint">Se citesc programările...</span>
        <span class="r18-times" id="r18ScheduleTimes"></span>
      </button>
      <div class="r18-overview-actions"><button class="r18-quick-add" id="r18QuickAdd" type="button">+ Adaugă programare</button></div>`;
    body.insertBefore(overview, body.firstChild);
    modal = document.createElement('dialog');
    modal.id='r18ScheduleDialog';modal.className='r18-dialog';modal.dataset.view='list';
    modal.setAttribute('aria-labelledby','r18ModalTitle');
    modal.innerHTML = `<div class="r18-dialog-header">
      <div class="r18-dialog-heading"><strong id="r18ModalTitle">Programări automate</strong><small>Calendar de udare · maxim 8</small></div>
      <button class="r18-dialog-close" id="r18CloseDialog" type="button" aria-label="Închide">×</button>
      </div><div class="r18-dialog-scroll"><div class="r18-dialog-tabs" role="tablist" aria-label="Gestionare programări">
        <button class="r18-dialog-tab" type="button" data-view="list" aria-selected="true" role="tab">Programările mele</button>
        <button class="r18-dialog-tab" type="button" data-view="create" aria-selected="false" role="tab">+ Adaugă</button>
      </div><div id="r18LegacyHost"></div></div>`;
    document.body.append(modal);
    // Move, do NOT clone: legacy event handlers and IDs remain exactly the same.
    modal.querySelector('#r18LegacyHost').append(pane);
    pane.hidden=false;
    const formPanel = pane.querySelector('.schedule-panel');
    if (formPanel) {
      const extra = document.createElement('div');extra.className='r18-create-extra';
      extra.innerHTML=`<label>Durata udării (min)<input id="r18ScheduleMinutes" type="number" min="1" max="120" step="1" inputmode="numeric" value="10"></label>
        <label>Refacerea apei (min)<input id="r18ScheduleRefill" type="number" min="1" max="120" step="1" inputmode="numeric" value="10"></label>`;
      formPanel.prepend(extra);
      const footnote=document.createElement('p');footnote.className='r18-create-hint';
      footnote.textContent='Durata și pauza alese se aplică și selecției AUTO.';
      pane.querySelector('.r13-schedule-submit')?.after(footnote);
    }
    const openList=$('r18OpenSchedules'); const add=$('r18QuickAdd');
    openList.addEventListener('click',()=>open('list',openList));
    add.addEventListener('click',()=>open('create',add));
    modal.querySelectorAll('.r18-dialog-tab').forEach(tab=>tab.addEventListener('click',()=>setView(tab.dataset.view)));
    $('r18CloseDialog').addEventListener('click',()=>modal.close());
    modal.addEventListener('click',event=>{
      if(event.target!==modal)return;
      const r=modal.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();
    });
    modal.addEventListener('close',()=>lastTrigger?.focus({preventScroll:true}));
    document.querySelectorAll('[data-hydro-mode]').forEach(button=>button.addEventListener('click',()=>{
      if(modal.open)modal.close();
    }));
    // Sync the two modal fields to the existing AUTO inputs BEFORE the established save handlers.
    $('autoAddSchedule')?.addEventListener('click',event=>{
      const duration=Number($('r18ScheduleMinutes')?.value);
      const refill=Number($('r18ScheduleRefill')?.value);
      if(!Number.isInteger(duration)||duration<1||duration>120||!Number.isInteger(refill)||refill<1||refill>120){
        event.stopImmediatePropagation();event.preventDefault();
        if (typeof showAutoToast==='function') showAutoToast('Durata și refacerea trebuie să fie între 1 și 120 min');
        return;
      }
      if ($('autoTimerInput')) $('autoTimerInput').value=String(duration);
      if ($('autoRefillMinutes')) $('autoRefillMinutes').value=String(refill);
      if(typeof setAutoSelectedMinutes==='function')setAutoSelectedMinutes(duration);
    },true);
    const list=$('autoScheduleList');
    if(list){
      const observer=new MutationObserver(renderSummary);
      observer.observe(list,{childList:true,subtree:true});
    }
    renderSummary();
    setInterval(renderSummary,60000);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
