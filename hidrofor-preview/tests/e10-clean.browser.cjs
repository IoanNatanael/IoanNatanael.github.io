
// E10 flow browser acceptance test: UI only, no ESP32 commands or external APIs.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pw=process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const {chromium}=pw;
const html=fs.readFileSync(path.join(root,'e10-lab.html'),'utf8');
assert(html.includes("connect-src 'none'"),'E10 network calls must remain forbidden by CSP');
assert(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(html),'E10 must not use network APIs');
assert(html.includes('data-mode="SEQUENCE"'),'Cu pași must be a top-level mode');
assert(!html.includes('data-type="SEQUENCE"'),'Obsolete nested sequence selector must be removed');

const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!['/e10-lab.html','/e10-advanced-engine.js','/app.html','/r18-schedules.js','/r18-schedules.css'].includes(pathname)){res.writeHead(404);res.end();return;}
  const local=path.join(root,pathname.slice(1));
  if(!fs.existsSync(local)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':local.endsWith('.css')?'text/css':local.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});
  fs.createReadStream(local).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
  try{
    for(const width of [360,390,430,1280]){
      const context=await browser.newContext({viewport:{width,height:850}});
      const page=await context.newPage(),errors=[],external=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',req=>{
        if(!req.url().startsWith(origin)||req.method()!=='GET')external.push(req.method()+' '+req.url());
      });
      await page.goto(origin+'/e10-lab.html',{waitUntil:'domcontentloaded'});
      assert.deepEqual(await page.locator('.mode-bar [data-mode]').allTextContents(),['Smart','Cu pași','Adaptiv']);
      for(const mode of ['SEQUENCE','ADAPTIVE','SMART']){
        await page.locator('[data-mode="'+mode+'"]').click();
        assert.equal(await page.locator('#newPlan').isVisible(),true);
        for(const id of ['programPicker','programEditor','savedOverview','programPreview'])
          assert.equal(await page.locator('#'+id).isVisible(),false);
      }
      await page.locator('#newPlan').click();
      assert.equal(await page.locator('#smartNew').isVisible(),true);
      assert.equal(await page.locator('#adaptiveNew').isVisible(),false);
      await page.locator('#sensorDetails > summary').click();
      await page.locator('#s1t').fill('');assert.equal(await page.locator('#playSimulation').isDisabled(),true);
      await page.locator('#s1t').fill('30');
      await page.locator('[data-rule="above"]').click();await page.locator('#smartLimitLow').fill('30');
      assert.equal(await page.locator('#playSimulation').isEnabled(),true,'above uses inclusive lower boundary');
      await page.locator('[data-rule="under"]').click();
      await page.locator('#smartLimitLow').fill('35');
      assert.equal(await page.locator('#playSimulation').isEnabled(),true);
      await page.locator('[data-rule="between"]').click();
      await page.locator('#smartLimitLow').fill('29');
      await page.locator('#smartLimitHigh').fill('31');
      assert.equal(await page.locator('#playSimulation').isDisabled(),true);
      await page.locator('[data-scope="one"]').click();
      assert.equal(await page.locator('#playSimulation').isEnabled(),true);
      await page.locator('#climatePanel > details > summary').click();
      await page.locator('#s2state').selectOption('missing');
      assert.equal(await page.locator('#playSimulation').isDisabled(),true,'missing node must block even for ANY');
      await page.locator('#s2state').selectOption('stale');assert.equal(await page.locator('#playSimulation').isDisabled(),true,'stale climate must block');
      await page.locator('#s2state').selectOption('ok');

      await page.locator('[data-mode="ADAPTIVE"]').click();await page.locator('#newPlan').click();
      await page.locator('#sensorDetails > summary').click();
      assert.equal(await page.locator('#adaptiveNew').isVisible(),true);
      assert.match(await page.locator('#adaptiveFeedback').textContent(),/10 minute/);
      await page.locator('#s1t').fill('22');await page.locator('#s2t').fill('24');
      assert.match(await page.locator('#adaptiveFeedback').textContent(),/8 minute/);
      await page.locator('#s1t').fill('10');await page.locator('#s2t').fill('12');
      assert.match(await page.locator('#adaptiveFeedback').textContent(),/5 minute/);

      await page.locator('[data-mode="SEQUENCE"]').click();await page.locator('#newPlan').click();
      assert.equal(await page.locator('#sequenceEditor').isVisible(),true);
      assert.equal(await page.locator('#smartNew').isVisible(),false);
      assert.equal(await page.locator('#stepRows .step').count(),3);
      assert.match(await page.locator('#durationOn').textContent(),/40m/);
      assert.match(await page.locator('#durationTotal').textContent(),/64m 30s/);
      await page.locator('#savePlan').click();
      assert.equal(await page.locator('#editorError').isVisible(),true);
      await page.locator('#planName').fill('Udare cu pași');
      await page.locator('#savePlan').click();
      assert.equal(await page.locator('#programEditor').isVisible(),false);
      assert.equal(await page.locator('#savedOverview').isVisible(),true);
      assert.equal(await page.locator('#programPreview').isVisible(),true);
      await page.locator('#playSimulation').click();
      await page.waitForTimeout(350);
      await page.locator('#playSimulation').click();
      assert.match(await page.locator('#elapsed').textContent(),/[0-9]+m [0-9]{2}s/);
      await page.locator('#restartSimulation').click();
      await page.locator('.preview-details > summary').click();
      await page.locator('summary').filter({hasText:'Testează un defect'}).click();
      await page.locator('#faultSelect').selectOption('LINK');assert.match(await page.locator('#eventList').textContent(),/DEFECT SIMULAT/);
      await page.locator('#faultSelect').selectOption('NONE');
      await page.locator('#showDrafts').click();
      assert.equal(await page.locator('#savedMenu .saved-item').count(),1);
      await page.reload();
      await page.locator('[data-mode="SEQUENCE"]').click();
      await page.locator('#showDrafts').click();
      assert.equal(await page.locator('#savedMenu .saved-item').count(),1);
      await page.locator('#savedMenu .saved-item').first().click();
      assert.equal(await page.locator('[data-mode="SEQUENCE"]').getAttribute('aria-pressed'),'true');
      assert.deepEqual(errors,[]);
      assert.deepEqual(external,[]);
      await context.close();
      console.log('PASS',width+'px','Smart, Adaptiv, Cu pași, empty/editor/summary, simulation, no network');
    }
    const ctx=await browser.newContext({viewport:{width:390,height:850}}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const key='hidrofor-e10-lab-simplu-v3';
      if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify([
        {id:'old-timed',mode:'FIX',type:'TIMED',plan:{name:'Program vechi',start:'07:00',steps:[{type:'ON',minutes:10}]}},
        {id:'unknown',mode:'FUTURE',type:'TIMED',plan:{name:'Păstrat',steps:[]}}
      ]));
    });
    await page.goto(origin+'/e10-lab.html');
    async function create(name){
      await page.locator('#newPlan').click();
      await page.locator('#planName').fill(name);
      await page.locator('#savePlan').click();
    }
    async function names(expected){
      await page.locator('#showDrafts').click();
      assert.deepEqual(await page.locator('#savedMenu .saved-item strong').allTextContents(),expected);
      await page.locator('#showDrafts').click();
    }
    await create('Smart A');await create('Smart B');await names(['Smart A','Smart B']);
    await page.locator('#editPlan').click();
    await page.locator('#smartDuration').fill('13');
    await page.locator('[data-mode="ADAPTIVE"]').click();await create('Adaptiv A');await names(['Adaptiv A']);
    await page.locator('#editPlan').click();
    await page.locator('#adaptiveLowBound').fill('18');
    await page.locator('#adaptiveHighBound').fill('29');
    await page.locator('#adaptiveBetweenM').fill('7');
    await page.locator('#savePlan').click();
    assert.deepEqual(await page.locator('#adaptiveSummary dt').allTextContents(),['Sub 18°C','De la 18°C până sub 29°C','29°C și peste']);
    assert.deepEqual(await page.locator('#adaptiveSummary dd').allTextContents(),['5 min','7 min','10 min']);
    if(process.env.E10_ADAPTIVE_SCREENSHOT)await page.screenshot({path:process.env.E10_ADAPTIVE_SCREENSHOT,fullPage:true});
    await page.locator('[data-mode="SMART"]').click();
    assert.equal(await page.locator('#adaptiveSummary').isVisible(),false);
    assert.equal(await page.locator('#smartDuration').inputValue(),'13');
    await page.locator('#cancelEdit').click();
    assert.match(await page.locator('#progressTitle').textContent(),/10 min/);
    await page.locator('#editPlan').click();await page.locator('#smartDuration').fill('13');await page.locator('#savePlan').click();
    assert.match(await page.locator('#progressTitle').textContent(),/13 min/);
    await page.locator('#showDrafts').click();await page.locator('#savedMenu button').first().click();
    assert.equal(await page.locator('#activePlanName').textContent(),'Smart A');
    if(process.env.E10_SCREENSHOT)await page.screenshot({path:process.env.E10_SCREENSHOT,fullPage:true});
    await page.reload();await names(['Smart A','Smart B']);
    await page.locator('[data-mode="ADAPTIVE"]').click();await names(['Adaptiv A']);
    await page.locator('#editPlan').click();await page.locator('#deletePlan').click();
    assert.equal(await page.locator('#programPreview').isVisible(),false);
    assert.equal(await page.locator('#newPlan').isVisible(),true);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('hidrofor-e10-lab-simplu-v3')));
    assert.equal(stored.length,4);
    assert(stored.some(r=>r.id==='old-timed')&&stored.some(r=>r.id==='unknown'));
    assert.deepEqual(errors,[]);await ctx.close();console.log('PASS mode isolation, edit/cancel, reload, delete, data preservation');
    const bad=await browser.newContext(),badPage=await bad.newPage();
    await badPage.addInitScript(()=>localStorage.setItem('hidrofor-e10-lab-simplu-v3','{invalid'));
    await badPage.goto(origin+'/e10-lab.html');await badPage.locator('#newPlan').click();await badPage.locator('#planName').fill('Nu suprascrie');await badPage.locator('#savePlan').click();
    assert.equal(await badPage.evaluate(()=>localStorage.getItem('hidrofor-e10-lab-simplu-v3')),'{invalid');
    assert.match(await badPage.locator('#savedPlanNotice').textContent(),/nu pot fi citite/i);await bad.close();console.log('PASS unreadable saved data is never overwritten');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
