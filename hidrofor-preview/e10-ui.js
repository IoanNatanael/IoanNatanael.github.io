
/* E10 Lab experience: progressive disclosure on top of the ORIGINAL deterministic
   engine. This file only reorders existing DOM nodes and adds presentation.
   No commands, HTTP, ESP-NOW, firmware, or scheduling side effects. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const node = (tag,cls,text) => {
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  const shell = (cls,...children) => {
    const el=node("div",cls);
    for(const child of children)if(child)el.append(child);
    return el;
  };
  const header = (title,subtitle) => {
    const h=shell("e10-section-header");
    const body=node("div");
    body.append(node("h3","",title),node("p","",subtitle));
    h.append(body);
    return h;
  };
  const fold = (title,content,open=false) => {
    const d=node("details","e10-fold");
    d.append(node("summary","",title),shell("e10-fold-body",content));
    d.open=open;
    return d;
  };
  const gotoPage = (page) => {
    const modal=$("e10LabDialog");
    if(!modal)return;
    modal.querySelectorAll(".e10-wizard-panel").forEach(p=>p.hidden=p.dataset.page!==page);
    modal.querySelectorAll(".e10-tab").forEach(b=>{
      const active=b.dataset.page===page;
      b.setAttribute("aria-selected",String(active));
      b.tabIndex=active?0:-1;
    });
    const scroll=modal.querySelector(".e10-body");
    if(scroll)scroll.scrollTop=0;
  };
  function setup(){
    const modal=$("e10LabDialog");
    const body=modal?.querySelector(".e10-body");
    if(!body||body.dataset.redesigned==="1")return;
    // Transactional DOM reorganization: if any part fails, put the ORIGINAL
    // nodes back. This preserves listeners, draft values, and a usable editor.
    const originalNodes=[...body.childNodes];
    try {
    body.dataset.redesigned="1";
    const panels={};
    for(const name of ["program","conditions","results"]){
      const panel=node("section","e10-wizard-panel");
      panel.dataset.page=name;panel.hidden=name!=="program";panels[name]=panel;
    }
    const source=[...body.children];
    let section="program",safety=null;
    for(const child of source){
      if(child.classList.contains("e10-safe")){safety=child;continue;}
      if(child.tagName==="H3"){
        const t=child.textContent.toLowerCase();
        if(t.includes("metode de control"))section="conditions";
        else if(t.includes("comparație fix"))section="results";
      }
      panels[section].append(child);
    }

    /* Step 1 — program library and ordered ON/OFF actions. */
    const libraryLabel=$("e10Saved")?.closest("label");
    const libraryTools=$("e10New")?.closest(".e10-controls");
    const editorTitle=panels.program.querySelector("h3");
    const programFields=$("e10Name")?.closest(".e10-fields");
    const steps=$("e10Steps");
    const stepActions=$("e10AddOn")?.closest(".e10-controls");
    const programHelp=panels.program.querySelector(".e10-info");
    if(!libraryLabel||!libraryTools||!editorTitle||!programFields||!steps||!stepActions)throw new Error("program controls missing");
    libraryLabel.firstChild.textContent="Schițele mele · salvate doar aici";
    const library=shell("e10-surface e10-library",libraryLabel,libraryTools);
    editorTitle.textContent="Pașii programului";
    stepActions.classList.add("e10-add-actions");
    const editor=shell("e10-surface",
      editorTitle,
      node("p","e10-info","Alege ordinea și durata fiecărei acțiuni. Poți muta, șterge sau adăuga pași."),
      programFields,steps,stepActions,programHelp);
    const programFeedback=node("p","e10-error");
    programFeedback.id="e10ProgramFeedback";programFeedback.setAttribute("role","status");
    panels.program.replaceChildren(
      header("Construiește programul","Păstrează întâi secvența de bază, apoi testează o strategie."),
      library,editor,programFeedback,
      footer(null,"Condiții și metode","conditions")
    );

    /* Step 2 — strategy switch and greenhouse test inputs. */
    const methodInfo=panels.conditions.querySelector("p.e10-info");
    const strategyLabel=$("e10Strategy")?.closest("label");
    const climateGrids=[...panels.conditions.querySelectorAll(".e10-climate-grid")];
    if(!strategyLabel||climateGrids.length!==2)throw new Error("climate inputs missing");
    strategyLabel.classList.add("e10-strategy-input");
    const modes=node("div","e10-methods");
    const descriptions={
      FIX:"Execută pașii așa cum i-ai introdus, fără condiții climatice.",
      SMART:"Acceptă programul numai când regulile pentru ambele sere sunt valide.",
      ADAPTIVE:"Modifică doar totalul ON și îl redistribuie între pașii de udare; OFF rămâne fix."
    };
    [["FIX","Fix","Secvența originală"],["SMART","Smart","Reguli după senzori"],["ADAPTIVE","Adaptive","Durată ajustată"]].forEach(([v,title,detail])=>{
      const btn=node("button","e10-mode-button");btn.type="button";btn.dataset.method=v;
      btn.append(node("strong","",title),node("span","",detail));
      btn.addEventListener("click",()=>{
        const el=$("e10Strategy");el.value=v;
        el.dispatchEvent(new Event("change",{bubbles:true}));
        refreshMode();
      });
      modes.append(btn);
    });
    const modeNote=node("p","e10-method-note");modeNote.id="e10ModeNote";
    climateGrids[0].querySelectorAll("fieldset").forEach((field,ix)=>{
      const labels=[...field.querySelectorAll(":scope > label")];
      if(labels.length<4)return;
      const readings=shell("e10-readings",labels[0],labels[1]);
      const advanced=node("details","e10-advanced");
      advanced.append(node("summary","", "Praguri SMART și simulare erori"),
        shell("e10-advanced-content",...labels.slice(2)));
      const health=node("p","e10-node-indicator");
      health.id=ix===0?"e10S1Health":"e10S2Health";
      field.append(readings,health,advanced);
    });
    const rules=node("details","e10-rules-wrap e10-advanced");
    rules.append(node("summary","", "Praguri și parametri avansați"),climateGrids[1]);
    const conditionsTop=shell("e10-surface e10-surface-muted",modes,strategyLabel,modeNote);
    panels.conditions.replaceChildren(
      header("Alege strategia","Toate valorile sunt introduse manual pentru test. Nu citim încă serele reale."),
      conditionsTop,
      header("Datele celor două sere","Temperatură și umiditate a aerului, numai pentru simulare."),
      climateGrids[0],rules,methodInfo,
      footer("Înapoi la program","Vezi rezultatele","results","program")
    );
    $("e10Strategy").addEventListener("change",refreshMode);
    function refreshMode(){
      const chosen=$("e10Strategy").value;
      modes.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.method===chosen)));
      modeNote.textContent=descriptions[chosen]||"";
      updateClimateHealth();
    }
    function updateClimateHealth(){
      for(const [prefix,id] of [["e10S1","e10S1Health"],["e10S2","e10S2Health"]]){
        const bits=[];
        if($(prefix+"Missing")?.checked)bits.push("nod lipsă");
        if($(prefix+"Stale")?.checked)bits.push("date expirate");
        if($(prefix+"Untrusted")?.checked)bits.push("sursă respinsă");
        const health=$(id);
        if(health){
          health.textContent=bits.length?"● Atenție: "+bits.join(" · "):"● Nod activ · date valide (simulat)";
          health.dataset.health=bits.length?"bad":"good";
        }
      }
    }
    modal.querySelectorAll("[data-e10-climate]").forEach(el=>el.addEventListener("change",updateClimateHealth));
    refreshMode();

    /* Step 3 — outcome first, technical details on demand. */
    const msg=$("e10Message"),sum=$("e10Summary"),timeline=$("e10Timeline"),
      legend=panels.results.querySelector(".e10-legend"),
      now=$("e10Now"),scrub=$("e10Scrub")?.closest("label"),elapsed=$("e10Elapsed"),
      comparisonTable=$("e10DecisionTable")?.closest(".e10-table-wrap"),
      comparisonNote=$("e10DecisionNote"),
      record=$("e10RecordCompare")?.closest(".e10-controls"),
      comparisonLog=$("e10ReadOnlyJournal")?.closest("details"),
      faultFields=$("e10Fault")?.closest(".e10-fields"),
      history=$("e10History");
    if(!msg||!sum||!timeline||!legend||!now||!scrub||!elapsed||!comparisonTable||!comparisonNote||!record||!comparisonLog||!faultFields||!history)throw new Error("results controls missing");
    elapsed.classList.add("e10-elapsed");
    const resultsHero=shell("e10-results-hero",msg,sum,
      node("h3","", "Cronologia execuției"),timeline,legend,now,scrub,elapsed);
    const decisionCards=node("div","e10-decision-cards");decisionCards.id="e10DecisionCards";
    const compareTechnical=fold("Deschide tabelul tehnic complet",comparisonTable);
    const comparison=shell("e10-surface",
      node("h3","", "Compară cele trei metode"),
      node("p","e10-info", "Timpul ON este solicitat sau simulat, nu măsurat la pompă."),
      decisionCards,comparisonNote,compareTechnical,record);
    const faultCard=fold("Testează un defect (opțional)",
      shell("e10-surface-muted",faultFields,
        node("p","e10-fault-note", "Un defect simulat oprește cronologia și nu afectează instalația.")));
    const journal=fold("Jurnal de simulare și comparații",
      shell("",node("h3","", "Tranziții ON / OFF"),history,comparisonLog));
    panels.results.replaceChildren(
      header("Rezultatul simulării","Vezi durata, pauzele de siguranță și decizia fiecărei strategii."),
      resultsHero,comparison,faultCard,journal,
      node("p","e10-info", "Previzualizare software, nu confirmare de releu. Protecția reală de 5 minute rămâne pe ESP-01S."),
      footer("Înapoi la condiții",null,null,"conditions")
    );

    function formatMetrics(){
      [...sum.children].forEach(el=>{
        if(el.dataset.metric==="1")return;
        const text=el.textContent||"",i=text.indexOf(":");
        if(i<0)return;
        const k=text.slice(0,i),v=text.slice(i+1).trim();
        el.classList.add("e10-metric");el.dataset.metric="1";
        el.replaceChildren(node("small","",k),node("strong","",v));
      });
    }
    function formatComparison(){
      const rows=[...$("e10DecisionTable").querySelectorAll("tbody tr")];
      const selected=$("e10Strategy").value;
      const holder=$("e10DecisionCards");
      holder.replaceChildren();
      for(const tr of rows){
        const vals=[...tr.querySelectorAll("td")].map(n=>n.textContent.trim());
        if(vals.length<5)continue;
        const [method,state,on,total,reason]=vals;
        const btn=node("button","e10-decision-card");btn.type="button";
        btn.dataset.selected=String(method===selected);
        btn.dataset.eligible=String(!state.includes("BLOCAT"));
        btn.setAttribute("aria-label","Selectează metoda "+method);
        btn.append(node("strong","",method),node("span","e10-decision-status",state),
          node("b","",on),node("small","", "Total: "+total),
          node("small","",reason));
        btn.addEventListener("click",()=>{
          const el=$("e10Strategy");el.value=method;el.dispatchEvent(new Event("change",{bubbles:true}));
          refreshMode();
        });
        holder.append(btn);
      }
    }
    new MutationObserver(formatMetrics).observe(sum,{childList:true});
    new MutationObserver(formatComparison).observe($("e10DecisionTable"),{childList:true});
    const feedback=$("e10ProgramFeedback");
    new MutationObserver(()=>{feedback.textContent=msg.textContent||"";}).observe(msg,{childList:true,subtree:true,characterData:true});
    formatMetrics();formatComparison();

    const hero=node("div","e10-wizard-hero");
    const heroText=node("div");
    heroText.append(node("span","e10-eyebrow","Hidrofor · laborator de control"),
      node("h2","", "Programe de udare"),
      node("p","", "Construiește, testează și compară fără să pornești pompa."));
    hero.append(heroText,node("span","e10-status","SIMULARE OFFLINE"));
    const tabs=node("nav","e10-wizard-tabs");tabs.setAttribute("aria-label","Etapele laboratorului");
    [["program","01","Program"],["conditions","02","Condiții"],["results","03","Rezultate"]].forEach(([page,n,t])=>{
      const b=node("button","e10-tab");b.type="button";b.dataset.page=page;
      b.setAttribute("aria-selected",String(page==="program"));
      b.append(node("span","e10-index",n),node("span","",t));
      b.addEventListener("click",()=>gotoPage(page));tabs.append(b);
    });
    body.replaceChildren(hero,tabs,safety,...Object.values(panels));
    modal.querySelectorAll(".e10-step").forEach(row=>row.dataset.state=row.querySelector("select")?.value||"ON");
    new MutationObserver(()=> {
      modal.querySelectorAll(".e10-step").forEach(row=> {
        row.dataset.state=row.querySelector("select")?.value||"ON";
      });
    }).observe(steps,{childList:true,subtree:true,attributes:true,attributeFilter:["value"]});
    steps.addEventListener("change",()=> {
      steps.querySelectorAll(".e10-step").forEach(row=>row.dataset.state=row.querySelector("select")?.value||"ON");
    });
    gotoPage("program");
    } catch(error) {
      // Never leave an empty full-screen overlay after a UI regression.
      body.replaceChildren(...originalNodes);
      body.dataset.redesigned="fallback";
      const note=node("p","e10-safe","Aspectul nou nu s-a încărcat complet; editorul clasic este disponibil pentru test.");
      body.prepend(note);
      console.error("E10 presentation fallback:",error);
    }
  }
  function footer(backLabel,nextLabel,nextPage,backPage){
    const bar=node("div","e10-actions-footer");
    if(backLabel){
      const b=node("button","",backLabel);b.type="button";
      b.addEventListener("click",()=>gotoPage(backPage));bar.append(b);
    }else bar.append(node("span"));
    if(nextLabel){
      const b=node("button","e10-next",nextLabel+" →");b.type="button";
      b.addEventListener("click",()=>gotoPage(nextPage));bar.append(b);
    }
    return bar;
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});
  else setup();
})();
