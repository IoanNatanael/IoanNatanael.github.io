// Integrated WEB-ONLY acceptance test. No hardware or external APIs are contacted.
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..');
const files=new Set(['app.html','r18-schedules.js','r18-schedules.css','advanced-programs.css','advanced-programs.js','e10-advanced-engine.js']);
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1);
  if(req.method!=='GET'||!files.has(name)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});fs.createReadStream(path.join(root,name)).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
  try{
    for(const width of [360,390,430,1280]){
      const ctx=await browser.newContext({viewport:{width,height:850}}),page=await ctx.newPage(),errors=[],writes=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
      await page.goto(origin+'/app.html',{waitUntil:'load'});
      await page.locator('[data-page="hidrofor"]').first().click();await page.locator('[data-hydro-mode="auto"]').click();
      assert.equal(await page.locator('#r18OpenSchedules').isVisible(),true);
      await page.locator('#r18OpenSchedules').click();assert.equal(await page.locator('#r18ScheduleDialog').evaluate(e=>e.open),true);
      await page.locator('#r18CloseDialog').click();assert.equal(await page.locator('#r18ScheduleDialog').evaluate(e=>e.open),false);
      await page.locator('#ap-open').click();assert.equal(await page.locator('#ap-dialog').evaluate(e=>e.open),true);
      for(const mode of ['SEQUENCE','ADAPTIVE','SMART']){
        await page.locator('[data-ap-mode="'+mode+'"]').click();
        assert.equal(await page.locator('#ap-new').isVisible(),true);
        for(const id of ['ap-program-picker','ap-overview','ap-editor','ap-preview'])
          assert.equal(await page.locator('#'+id).isVisible(),false);
      }
      await page.locator('#ap-new').click();
      assert.equal(await page.locator('[data-ap-panel="SMART"]').isVisible(),true);
      await page.locator('#ap-name').fill('Seră dimineața');
      await page.locator('[data-ap-rule="between"]').click();
      assert.equal(await page.locator('#ap-smart-high-wrap').isVisible(),true);
      await page.locator('#ap-smart-low').fill('32');
      await page.locator('#ap-smart-high').fill('28');
      await page.locator('#ap-save').click();
      assert.match(await page.locator('#ap-storage-status').textContent(),/Prag/i);
      await page.locator('#ap-smart-low').fill('20');
      await page.locator('#ap-smart-high').fill('35');
      await page.locator('#ap-save').click();
      assert.equal(await page.locator('#ap-current-name').textContent(),'Seră dimineața');
      assert.equal(await page.locator('#ap-editor').isVisible(),false);
      assert.match(await page.locator('#ap-overview-value').textContent(),/20°C până sub 35°C/);
      assert.match(await page.locator('#ap-climate-status').textContent(),/DEMO/);
      if(width===390){
        await page.evaluate(()=>{
          const original=uiState.live.sera1.lastSeen;
          uiState.live.sera1.lastSeen='31.12.2099 23:59:59';
          document.querySelector('#ap-restart').click();
          uiState.live.sera1.lastSeen=original;
        });
        assert.equal(await page.locator('#ap-play').isDisabled(),true);
        await page.evaluate(()=>{
          window.HIDROFOR_PREVIEW_ONLY=false;
          document.querySelector('#ap-restart').click();
          window.HIDROFOR_PREVIEW_ONLY=true;
        });
        assert.equal(await page.locator('#ap-play').isDisabled(),true);
        assert.match(await page.locator('#ap-climate-status').textContent(),/Proveniența/);
        await page.locator('#ap-restart').click();
      }
      await page.locator('#ap-play').click();
      await page.waitForFunction(()=>document.querySelector('#ap-elapsed').textContent!=='0m 00s');
      assert.notEqual(await page.locator('.ap-timeline-track').evaluate(el=>el.style.getPropertyValue('--ap-progress')),'0%');

      await page.locator('[data-ap-mode="SEQUENCE"]').click();
      await page.locator('#ap-new').click();
      assert.equal(await page.locator('#ap-steps .ap-step-row').count(),3);
      const firstMinutes=page.locator('#ap-steps input').first();
      await firstMinutes.fill('');
      await firstMinutes.pressSequentially('12');
      assert.equal(await firstMinutes.inputValue(),'12');
      await firstMinutes.fill('10');
      await page.locator('#ap-add-off').click();
      assert.equal(await page.locator('#ap-steps .ap-step-row').count(),4);
      await page.locator('#ap-steps button[aria-label="Șterge pasul 4"]').click();
      await page.locator('#ap-name').fill('Program cu pași');
      await page.locator('#ap-steps button[aria-label="Mută mai sus pasul 2"]').click();
      await page.locator('#ap-save').click();
      assert.equal(await page.locator('#ap-editor').isVisible(),true);
      assert.equal(await page.locator('#ap-storage-status').isVisible(),true);
      await page.locator('#ap-steps button[aria-label="Mută mai jos pasul 1"]').click();
      await page.locator('#ap-save').click();
      assert.deepEqual(await page.locator('#ap-summary-rows dt').allTextContents(),['1. Udare','2. Pauză','3. Udare']);
      assert.deepEqual(await page.locator('#ap-summary-rows dd').allTextContents(),['10 min','20 min','30 min']);
      assert.equal(await page.locator('#ap-preview').isVisible(),true);
      assert.equal(await page.locator('#ap-requested').textContent(),'40m 00s');
      assert.equal(await page.locator('#ap-total').textContent(),'64m 30s');
      assert.equal(await page.locator('#ap-rest').textContent(),'4m 30s');
      assert.equal(await page.locator('#ap-start-clock').textContent(),'07:00');
      assert.equal(await page.locator('#ap-end-clock').textContent(),'08:04:30');
      await page.locator('#ap-play').click();
      await page.waitForFunction(()=>document.querySelector('#ap-elapsed').textContent!=='0m 00s');
      await page.locator('#ap-program-picker summary').click();
      assert.deepEqual(await page.locator('#ap-program-list button').allTextContents(),['Program cu pași']);

      await page.locator('[data-ap-mode="ADAPTIVE"]').click();
      await page.locator('#ap-new').click();
      await page.locator('#ap-name').fill('Program adaptiv');
      await page.locator('#ap-adaptive-low').fill('18');
      await page.locator('#ap-adaptive-high').fill('29');
      await page.locator('#ap-adaptive-middle').fill('7');
      await page.locator('#ap-save').click();
      assert.deepEqual(await page.locator('#ap-summary-rows dt').allTextContents(),['Sub 18°C','De la 18°C până sub 29°C','29°C și peste']);
      assert.deepEqual(await page.locator('#ap-summary-rows dd').allTextContents(),['5 min','7 min','10 min']);
      await page.evaluate(()=>{
        uiState.live.sera1.temp='15.0 C';
        document.querySelector('#ap-restart').click();
        document.querySelector('#ap-play').click();
      });
      assert.match(await page.locator('#ap-preview-duration').textContent(),/5 min/);
      await page.evaluate(()=>{uiState.live.sera1.temp='35.0 C';});
      await page.waitForFunction(()=>document.querySelector('#ap-elapsed').textContent!=='0m 00s');
      assert.match(await page.locator('#ap-preview-duration').textContent(),/5 min/,'active run must keep its evaluated duration');
      await page.evaluate(()=>{uiState.live.sera1.temp='35.0 C';document.querySelector('#ap-restart').click();});
      assert.match(await page.locator('#ap-preview-duration').textContent(),/10 min/);
      assert.equal(await page.locator('#ap-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      if(width===390&&process.env.AP_SCREENSHOT)await page.screenshot({path:process.env.AP_SCREENSHOT});
      await page.evaluate(()=>{uiState.live.sera1.temp='n/a';document.querySelector('#ap-restart').click();});
      assert.equal(await page.locator('#ap-play').isDisabled(),true);
      assert.match(await page.locator('#ap-error').textContent(),/invalid/i);

      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#ap-dialog').evaluate(el=>el.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'ap-open');
      await page.locator('#ap-open').click();
      await page.locator('[data-ap-mode="SMART"]').click();
      await page.locator('#ap-program-picker summary').click();
      assert.deepEqual(await page.locator('#ap-program-list button').allTextContents(),['Seră dimineața']);
      await page.locator('#ap-program-list button').click();
      await page.locator('#ap-edit').click();
      await page.locator('#ap-smart-low').fill('21');
      await page.locator('[data-ap-mode="ADAPTIVE"]').click();
      await page.locator('[data-ap-mode="SMART"]').click();
      assert.equal(await page.locator('#ap-smart-low').inputValue(),'21');
      await page.locator('#ap-cancel').click();
      assert.match(await page.locator('#ap-overview-value').textContent(),/20°C/);
      await page.locator('#ap-edit').click();
      await page.locator('#ap-smart-low').fill('22');
      await page.locator('#ap-save').click();
      assert.match(await page.locator('#ap-overview-value').textContent(),/22°C/);
      await page.locator('#ap-new').click();
      assert.equal(await page.locator('#ap-name').inputValue(),'');
      assert.equal(await page.locator('#ap-smart-low').inputValue(),'28');
      await page.locator('#ap-cancel').click();
      assert.equal(await page.locator('#ap-current-name').textContent(),'Seră dimineața');
      await page.reload({waitUntil:'load'});
      await page.locator('[data-page="hidrofor"]').first().click();
      await page.locator('#ap-open').click();
      assert.equal(await page.locator('#ap-current-name').textContent(),'Seră dimineața');
      assert.match(await page.locator('#ap-overview-value').textContent(),/22°C până sub 35°C/);
      await page.locator('#ap-edit').click();
      await page.locator('#ap-delete').click();
      assert.equal(await page.locator('#ap-new').isVisible(),true);
      assert.equal(await page.locator('#ap-preview').isVisible(),false);
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await ctx.close();console.log('PASS '+width+'px: integrated dialog, SMART, steps, adaptive freeze, saved programs, no writes');
    }
    const ctx=await browser.newContext(),page=await ctx.newPage();
    await page.addInitScript(()=>localStorage.setItem('hidrofor-advanced-programs-v1','{broken'));
    await page.goto(origin+'/app.html',{waitUntil:'load'});await page.locator('[data-page="hidrofor"]').first().click();await page.locator('[data-hydro-mode="auto"]').click();await page.locator('#ap-open').click();
    await page.locator('#ap-new').click();await page.locator('#ap-name').fill('Nu suprascrie');await page.locator('#ap-save').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('hidrofor-advanced-programs-v1')),'{broken');
    assert.match(await page.locator('#ap-storage-status').textContent(),/blocate/i);await ctx.close();console.log('PASS unreadable local programs remain untouched');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
