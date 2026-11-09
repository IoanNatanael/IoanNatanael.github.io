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
      assert.equal(await page.locator('[data-ap-panel="SMART"]').isVisible(),true);
      assert.match(await page.locator('#ap-climate-status').textContent(),/DEMO/);
      await page.locator('[data-ap-rule="between"]').click();assert.equal(await page.locator('#ap-smart-high-wrap').isVisible(),true);
      await page.locator('#ap-smart-low').fill('32');await page.locator('#ap-smart-high').fill('28');
      assert.equal(await page.locator('#ap-play').isDisabled(),true);assert.match(await page.locator('#ap-error').textContent(),/Prag/i);
      await page.locator('#ap-smart-low').fill('20');await page.locator('#ap-smart-high').fill('35');
      if(width===390){
        await page.evaluate(()=>{window.__apLastSeen=uiState.live.sera1.lastSeen;uiState.live.sera1.lastSeen='31.12.2099 23:59:59';});
        await page.locator('#ap-smart-low').fill('21');assert.equal(await page.locator('#ap-play').isDisabled(),true);
        await page.evaluate(()=>{uiState.live.sera1.lastSeen=window.__apLastSeen;});await page.locator('#ap-smart-low').fill('20');
        await page.evaluate(()=>{window.HIDROFOR_PREVIEW_ONLY=false;});await page.locator('#ap-smart-low').fill('21');
        assert.equal(await page.locator('#ap-play').isDisabled(),true);assert.match(await page.locator('#ap-climate-status').textContent(),/Proveniența/);
        await page.evaluate(()=>{window.HIDROFOR_PREVIEW_ONLY=true;});await page.locator('#ap-smart-low').fill('20');
      }
      await page.locator('#ap-new').click();await page.locator('#ap-name').fill('Seră dimineața');await page.locator('#ap-save-new').click();
      assert.equal(await page.locator('#ap-current-name').textContent(),'Seră dimineața');
      assert.equal(await page.locator('#ap-save').isVisible(),false);
      await page.locator('#ap-play').click();await page.waitForTimeout(300);assert.notEqual(await page.locator('#ap-elapsed').textContent(),'0m 00s');await page.locator('#ap-restart').click();
      await page.locator('[data-ap-mode="SEQUENCE"]').click();assert.equal(await page.locator('#ap-steps .ap-step-row').count(),3);
      assert.equal(await page.locator('#ap-requested').textContent(),'40m 00s');assert.equal(await page.locator('#ap-total').textContent(),'64m 30s');
      assert.equal(await page.locator('#ap-rest').textContent(),'4m 30s');
      assert.equal(await page.locator('#ap-start-clock').textContent(),'07:00');assert.equal(await page.locator('#ap-end-clock').textContent(),'08:04:30');
      await page.locator('#ap-play').click();await page.waitForTimeout(300);assert.notEqual(await page.locator('#ap-elapsed').textContent(),'0m 00s');await page.locator('#ap-restart').click();
      const firstMinutes=page.locator('#ap-steps input').first();await firstMinutes.fill('');await firstMinutes.pressSequentially('12');assert.equal(await firstMinutes.inputValue(),'12');await firstMinutes.fill('10');
      await page.locator('#ap-add-off').click();assert.equal(await page.locator('#ap-steps .ap-step-row').count(),4);await page.locator('#ap-steps button[aria-label="Șterge pasul 4"]').click();
      await page.locator('#ap-steps button[aria-label="Mută mai sus pasul 2"]').click();assert.equal(await page.locator('#ap-play').isDisabled(),true);
      await page.locator('#ap-steps button[aria-label="Mută mai jos pasul 1"]').click();assert.equal(await page.locator('#ap-play').isEnabled(),true);
      await page.locator('#ap-new').click();await page.locator('#ap-name').fill('Program cu pași');await page.locator('#ap-save-new').click();
      await page.locator('#ap-program-picker summary').click();assert.deepEqual(await page.locator('#ap-program-list button').allTextContents(),['Program cu pași']);
      await page.locator('#ap-program-picker summary').click();
      await page.locator('[data-ap-mode="ADAPTIVE"]').click();
      await page.waitForFunction(()=>typeof uiState!=='undefined'&&uiState.live&&uiState.live.sera1);
      await page.evaluate(()=>{uiState.live.sera1.temp='15.0 C'});await page.locator('#ap-adaptive-low').fill('20');
      assert.match(await page.locator('#ap-adaptive-result').textContent(),/5 min/);
      await page.locator('#ap-play').click();assert.match(await page.locator('#ap-adaptive-result').textContent(),/5 min/);
      await page.evaluate(()=>{uiState.live.sera1.temp='35.0 C'});await page.waitForTimeout(350);
      assert.match(await page.locator('#ap-adaptive-result').textContent(),/5 min/,'active run must keep its evaluated duration');
      await page.evaluate(()=>{uiState.live.sera1.temp='35.0 C';document.querySelector('#ap-restart').click();});assert.match(await page.locator('#ap-adaptive-result').textContent(),/10 min/);
      await page.evaluate(()=>{uiState.live.sera1.temp='n/a'});await page.locator('#ap-adaptive-low').fill('21');
      assert.equal(await page.locator('#ap-play').isDisabled(),true);assert.match(await page.locator('#ap-error').textContent(),/invalid/i);
      assert.equal(await page.locator('#ap-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
      if(width===390&&process.env.AP_SCREENSHOT){await page.evaluate(()=>{uiState.live.sera1.temp='30.0 C'});await page.locator('#ap-adaptive-low').fill('20');await page.screenshot({path:process.env.AP_SCREENSHOT});}
      await page.keyboard.press('Escape');assert.equal(await page.locator('#ap-dialog').evaluate(e=>e.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'ap-open');
      await page.locator('#ap-open').click();await page.locator('[data-ap-mode="SMART"]').click();await page.locator('#ap-program-picker summary').click();
      assert.deepEqual(await page.locator('#ap-program-list button').allTextContents(),['Seră dimineața']);
      await page.locator('#ap-program-list button').click();assert.equal(await page.locator('#ap-current-name').textContent(),'Seră dimineața');
      await page.reload({waitUntil:'load'});await page.locator('[data-page="hidrofor"]').first().click();await page.locator('[data-hydro-mode="auto"]').click();await page.locator('#ap-open').click();
      await page.locator('#ap-program-picker summary').click();await page.locator('#ap-program-list button').click();
      assert.equal(await page.locator('#ap-smart-low').inputValue(),'20');assert.equal(await page.locator('#ap-smart-high').inputValue(),'35');
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await ctx.close();console.log('PASS '+width+'px: integrated dialog, SMART, steps, adaptive freeze, saved programs, no writes');
    }
    const ctx=await browser.newContext(),page=await ctx.newPage();
    await page.addInitScript(()=>localStorage.setItem('hidrofor-advanced-programs-v1','{broken'));
    await page.goto(origin+'/app.html',{waitUntil:'load'});await page.locator('[data-page="hidrofor"]').first().click();await page.locator('[data-hydro-mode="auto"]').click();await page.locator('#ap-open').click();
    await page.locator('#ap-new').click();await page.locator('#ap-name').fill('Nu suprascrie');await page.locator('#ap-save-new').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('hidrofor-advanced-programs-v1')),'{broken');
    assert.match(await page.locator('#ap-storage-status').textContent(),/blocate/i);await ctx.close();console.log('PASS unreadable local programs remain untouched');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
