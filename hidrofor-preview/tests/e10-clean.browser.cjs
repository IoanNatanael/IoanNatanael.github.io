// Browser verification for the demo. It only serves local files and uses a fresh
// browser context; no real controller or external service is contacted.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..');
const current=fs.readFileSync(path.join(root,'e10-lab.html'),'utf8');
// The sequence and climate engines must remain unchanged from the reviewed
// public preview (ddd4e0b), ignoring only checkout line endings.
function engines(html){return [...html.replace(/\r\n/g,'\n').matchAll(/<script>\s*(\/\* (?:E10-P1: pure|E10 integrated offline-only DECISION MODEL)[\s\S]*?)<\/script>/g)].map(x=>x[1]);}
const hashes=engines(current).map(x=>createHash('sha256').update(x).digest('hex'));
assert.deepEqual(hashes,['8db261068a808a0e3f3869cefa59410b35dc3582b5a8ffdfa28d90d9541b821c','4f70d9b75a8e075f7c897a86b75cba33679734c2f808f8850b3916706968c9a4']);
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!/^\/(?:app\.html|e10-lab\.html|r18-schedules\.(?:css|js))$/.test(pathname)){res.writeHead(404);return res.end();}
  const file=path.join(root,pathname.slice(1));
  res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});
  fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
  try{
    for(const width of [360,390,1280]){
      const ctx=await browser.newContext({viewport:{width,height:850}}),page=await ctx.newPage(),errors=[],mutations=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',req=>{if(req.method()!=='GET')mutations.push(req.url())});
      await page.goto(origin+'/app.html',{waitUntil:'domcontentloaded'});
      await page.evaluate(()=>setPage('hidrofor'));
      await page.locator('#e10-site-open').click();
      const frame=page.frameLocator('#e10-site-frame');
      await frame.locator('[data-mode="FIX"]').waitFor();
      await page.screenshot({path:`C:/Users/ursut/Documents/ChatGPT/Hidrofor/build-audit/e10-clean-initial-${width}.png`});
      await frame.locator('[data-mode="SMART"]').click();
      assert.equal(await frame.locator('.top').isVisible(),false,'embedded header should not be duplicated');
      await frame.locator('#smartT').fill('24');await frame.locator('#smartH').fill('46');
      await frame.locator('#smartCombine').selectOption('1');await frame.locator('#s1t').fill('31');
      await frame.locator('summary').filter({hasText:'Schițele mele'}).click();
      await frame.locator('#savePlan').click();
      const saved=await frame.locator('#savedPlans').inputValue();assert(saved);
      await frame.locator('#smartT').fill('35');await frame.locator('#s1t').fill('38');
      await frame.locator('#newPlan').click();await frame.locator('#savedPlans').selectOption(saved);
      assert.equal(await frame.locator('#smartT').inputValue(),'24');assert.equal(await frame.locator('#smartH').inputValue(),'46');
      assert.equal(await frame.locator('#s1t').inputValue(),'31');assert.equal(await frame.locator('#smartCombine').inputValue(),'1');
      assert.equal(await frame.locator('[data-mode="SMART"]').getAttribute('aria-pressed'),'true');
      await frame.locator('#s1t').fill('');assert.match(await frame.locator('#s1status').textContent(),/invalide/);
      assert.equal(await frame.locator('#playSimulation').isDisabled(),true);
      await frame.locator('#s1t').fill('31');await frame.locator('[data-mode="ADAPTIVE"]').click();
      await frame.locator('[data-type="SEQUENCE"]').click();
      assert.equal(await frame.locator('#stepRows .step').count(),3);
      assert.equal(await frame.locator('#playSimulation').isEnabled(),true);
      if(width===390){
        await frame.locator('#newPlan').click();
        await frame.locator('[data-mode="ADAPTIVE"]').click();
        await frame.locator('summary').filter({hasText:'Setări avansate'}).click();
        await frame.locator('#minFactor').fill('63');await frame.locator('#lowT').fill('14');
        await frame.locator('#s2h').fill('61');await frame.locator('#savePlan').click();
        const adaptive=await frame.locator('#savedPlans').inputValue();assert(adaptive);
        await frame.locator('#minFactor').fill('80');await frame.locator('#s2h').fill('42');
        await frame.locator('#newPlan').click();await frame.locator('#savedPlans').selectOption(adaptive);
        assert.equal(await frame.locator('#minFactor').inputValue(),'63');
        assert.equal(await frame.locator('#lowT').inputValue(),'14');
        assert.equal(await frame.locator('#s2h').inputValue(),'61');
        assert.equal(await frame.locator('[data-mode="ADAPTIVE"]').getAttribute('aria-pressed'),'true');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
      await page.screenshot({path:`C:/Users/ursut/Documents/ChatGPT/Hidrofor/build-audit/e10-clean-${width}.png`});
      await frame.locator('[data-mode="SMART"]').focus();await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('#e10-site-modal').open);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'e10-site-open');
      assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
      await ctx.close();console.log(`PASS ${width}px: flows, saved values, missing data, Escape, layout, no mutations`);
    }
    const ctx=await browser.newContext();const page=await ctx.newPage();
    const old={id:'old',mode:'SMART',type:'TIMED',plan:{version:1,name:'Vechi',start:'07:00',steps:[{type:'ON',minutes:10}]},timedMinutes:10};
    await page.addInitScript(v=>localStorage.setItem('hidrofor-e10-lab-simplu-v3',JSON.stringify([v])),old);
    await page.goto(origin+'/e10-lab.html');await page.locator('summary').filter({hasText:'Schițele mele'}).click();
    await page.locator('#savedPlans').selectOption('old');
    assert.match(await page.locator('#savedPlanNotice').textContent(),/Schiță veche/);
    assert.equal(await page.locator('#smartT').inputValue(),'28');
    await ctx.close();console.log('PASS: older draft falls back visibly to default test values');
    const ctx2=await browser.newContext(),p2=await ctx2.newPage();
    await p2.addInitScript(v=>{
      localStorage.setItem('hidrofor-e10-lab-simplu-v3','[]');
      localStorage.setItem('hidrofor-e10-dryrun-drafts-v1',JSON.stringify([v.plan]));
    },old);
    await p2.goto(origin+'/e10-lab.html');
    assert.equal(await p2.locator('#savedPlans option').count(),1,'cleared drafts must not be silently reimported');
    await ctx2.close();console.log('PASS: deleted drafts are not restored from the legacy key');
    const ctx3=await browser.newContext(),p3=await ctx3.newPage();
    await p3.goto(origin+'/e10-lab.html');await p3.locator('[data-mode="SMART"]').click();
    await p3.locator('#smartT').fill('22');await p3.locator('#smartH').fill('55');
    await p3.locator('summary').filter({hasText:'Schițele mele'}).click();
    await p3.locator('#savePlan').click();const savedId=await p3.locator('#savedPlans').inputValue();
    await p3.reload();await p3.locator('summary').filter({hasText:'Schițele mele'}).click();
    await p3.locator('#savedPlans').selectOption(savedId);
    assert.equal(await p3.locator('#smartT').inputValue(),'22');assert.equal(await p3.locator('#smartH').inputValue(),'55');
    await ctx3.close();console.log('PASS: saved conditions survive a page reload');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
