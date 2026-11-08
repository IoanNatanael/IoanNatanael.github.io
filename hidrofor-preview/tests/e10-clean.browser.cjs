
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
  if(!['/e10-lab.html','/app.html','/r18-schedules.js','/r18-schedules.css'].includes(pathname)){res.writeHead(404);res.end();return;}
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
    for(const width of [360,390,1280]){
      const context=await browser.newContext({viewport:{width,height:850}});
      const page=await context.newPage(),errors=[],external=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',req=>{
        if(!req.url().startsWith(origin)||req.method()!=='GET')external.push(req.method()+' '+req.url());
      });
      await page.goto(origin+'/e10-lab.html',{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('.mode-bar [data-mode]').count(),4);
      assert.equal(await page.locator('#timedEditor').isVisible(),true);
      assert.equal(await page.locator('#sequenceEditor').isVisible(),false);
      assert.match(await page.locator('#durationOn').textContent(),/10m/);

      await page.locator('[data-mode="SMART"]').click();
      assert.equal(await page.locator('#smartNew').isVisible(),true);
      assert.equal(await page.locator('#adaptiveNew').isVisible(),false);
      await page.locator('#sensorDetails summary').click();
      await page.locator('[data-rule="under"]').click();
      await page.locator('#smartLimitLow').fill('35');
      assert.equal(await page.locator('#playSimulation').isEnabled(),true);
      await page.locator('[data-rule="between"]').click();
      await page.locator('#smartLimitLow').fill('29');
      await page.locator('#smartLimitHigh').fill('31');
      assert.equal(await page.locator('#playSimulation').isDisabled(),true);
      await page.locator('[data-scope="one"]').click();
      assert.equal(await page.locator('#playSimulation').isEnabled(),true);
      await page.locator('#s2state').selectOption('missing');
      assert.equal(await page.locator('#playSimulation').isDisabled(),true,'missing node must block even for ANY');
      await page.locator('#s2state').selectOption('ok');

      await page.locator('[data-mode="ADAPTIVE"]').click();
      assert.equal(await page.locator('#adaptiveNew').isVisible(),true);
      assert.match(await page.locator('#adaptiveFeedback').textContent(),/10 minute/);
      await page.locator('#s1t').fill('22');await page.locator('#s2t').fill('24');
      assert.match(await page.locator('#adaptiveFeedback').textContent(),/8 minute/);
      await page.locator('#s1t').fill('10');await page.locator('#s2t').fill('12');
      assert.match(await page.locator('#adaptiveFeedback').textContent(),/5 minute/);

      await page.locator('[data-mode="SEQUENCE"]').click();
      assert.equal(await page.locator('#sequenceEditor').isVisible(),true);
      assert.equal(await page.locator('#smartNew').isVisible(),false);
      assert.equal(await page.locator('#stepRows .step').count(),3);
      assert.match(await page.locator('#durationOn').textContent(),/40m/);
      assert.match(await page.locator('#durationTotal').textContent(),/64m 30s/);
      await page.locator('#playSimulation').click();
      await page.waitForTimeout(350);
      await page.locator('#playSimulation').click();
      assert.match(await page.locator('#elapsed').textContent(),/[0-9]+m [0-9]{2}s/);
      await page.locator('#restartSimulation').click();
      await page.locator('#showDrafts').click();
      await page.locator('#savePlan').click();
      assert.equal(await page.locator('#savedMenu .saved-item').count(),1);
      await page.reload();
      await page.locator('#showDrafts').click();
      assert.equal(await page.locator('#savedMenu .saved-item').count(),1);
      await page.locator('#savedMenu .saved-item').first().click();
      assert.equal(await page.locator('[data-mode="SEQUENCE"]').getAttribute('aria-pressed'),'true');
      assert.deepEqual(errors,[]);
      assert.deepEqual(external,[]);
      await context.close();
      console.log('PASS',width+'px','FIX, SMART, ADAPTIVE, Cu pași, draft save/load, no network');
    }
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
