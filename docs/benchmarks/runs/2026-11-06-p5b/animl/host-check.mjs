// Public web entry points and documented host API; no runtime implementation reads.
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const audit = async (kind, errors) => appendFile(root+'evidence/aux-checks.jsonl', JSON.stringify({at:new Date().toISOString(),kind,errors})+'\n');
let browser, page;
try {
  const bundle = await build({stdin:{contents:`import '@anima-format/web';
import '@anima-format/web/paint'; import '@anima-format/web/assets';
import '@anima-format/web/events'; import '@anima-format/web/components';
import '@anima-format/web/lists'; import '@anima-format/web/data';
import '@anima-format/web/bind'; import '@anima-format/web/derive';
import '@anima-format/web/host'; import '@anima-format/web/host-edit';`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
  await audit('browser bundle build', 0);
  browser = await chromium.launch({executablePath:process.env.HOME+'/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox']});
  page = await browser.newPage({viewport:{width:600,height:500}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('http://playlist.test/**', async route=> {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (!name) return route.fulfill({contentType:'text/html',body:'<body style="margin:0"><script src="/bundle.js"></script><anima-icon auto-bind src="/playlist.ani" style="font-size:480px"></anima-icon>'});
    if(name==='bundle.js') return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
    return route.fulfill({body:await readFile(root+name),contentType:name.endsWith('.wav')?'audio/wav':'application/json'});
  });
  await page.addInitScript(()=> {
    window.playbacks=[];window.assetRequests=[];window.diagnostics=[];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(){
      const source=original.call(this), start=source.start.bind(source);
      source.start=(...args)=>{window.playbacks.push({args,duration:source.buffer?.duration});return start(...args);};
      return source;
    };
    document.addEventListener('anima:error', e=>window.diagnostics.push(e.detail),true);
  });
  page.on('request', request=>{if(request.url().endsWith('.wav'))page.evaluate(url=>window.assetRequests.push(url),request.url());});
  await page.goto('http://playlist.test/');
  await page.waitForFunction(()=>document.querySelector('anima-icon')?.player && document.querySelector('anima-icon')?.data);
  await page.evaluate(async()=>{window.icon=document.querySelector('anima-icon');await icon.ready;});
  const snapshots=[];
  async function snap(label){
    const result=await page.evaluate(label=>({label,tracks:icon.data.get('$tracks'),count:icon.data.get('$count'),selected:icon.data.get('$selected'),values:icon.player.values(),states:icon.player.states(),svg:icon.shadowRoot.innerHTML}),label);
    snapshots.push(result);
    return result;
  }
  async function edit(code){await page.evaluate(code);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}
  await snap('initial');
  // A real pointer click activates Web Audio as well as the row listener.
  const box=await page.locator('anima-icon').boundingBox();
  await page.mouse.click(box.x+36,box.y+120);
  console.log("after click",box,await page.evaluate(()=>({selected:icon.data.get("$selected"),plays:playbacks,diagnostics,shadow:icon.shadowRoot.innerHTML.slice(0,500)})));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  await snap('tide clicked');
  await edit(()=>{icon.data.list('$tracks').add(icon.data.instance('moss'));});
  await snap('add moss');
  await edit(()=>{icon.data.list('$tracks').insert(1,{id:'dusk',title:'Dusk',titleChars:4,duration:80,cover:'ember',clip:'ember'});});
  await snap('insert dusk at 1');
  await edit(()=>{icon.data.list('$tracks').remove(0);});
  await snap('remove dawn');
  await edit(()=>{icon.data.list('$tracks').swap(1,3);});
  await snap('swap tide and moss');
  // Tide is now last: click y=22 at 12 pixels per grid unit.
  await page.mouse.click(box.x+36,box.y+264);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  await snap('moved tide clicked again');
  // Count drops through two and zero without writing count.
  await edit(()=>{const t=icon.data.list('$tracks');t.remove(3);t.remove(2);});
  await snap('remove to two');
  await edit(()=>{const t=icon.data.list('$tracks');t.remove(1);t.remove(0);});
  await snap('remove to zero');
  const evidence=await page.evaluate(()=>({playbacks,assetRequests,diagnostics}));
  await writeFile(root+'evidence/host-snapshots.json',JSON.stringify(snapshots,null,2)+'\n');
  await writeFile(root+'evidence/playback.json',JSON.stringify({...evidence,pageErrors:errors},null,2)+'\n');
  if(errors.length||evidence.diagnostics.length)throw Error(JSON.stringify({errors,diagnostics:evidence.diagnostics}));
  await audit('browser host edit and audio sample',0);
  // Independent root-level audio control distinguishes harness failure from repeat routing.
  await page.evaluate(()=>new Promise(resolve=>{icon.addEventListener('anima:load',resolve,{once:true});icon.setAttribute('src','/audio-control.ani');}));
  await page.mouse.click(box.x+120,box.y+120);
  await page.waitForTimeout(500);
  const control=await page.evaluate(()=>({playbacks,assetRequests,diagnostics,activated:navigator.userActivation.hasBeenActive}));
  await writeFile(root+'evidence/audio-control.json',JSON.stringify(control,null,2)+'\n');
  await audit('root audio control sample',control.playbacks.length===1?0:1);
  console.log(JSON.stringify({snapshots:snapshots.length,...evidence,pageErrors:errors,control}));
} catch(e){if(page){await page.screenshot({path:root+'evidence/host-failure.png'});await writeFile(root+'evidence/host-failure.json',JSON.stringify(await page.evaluate(()=>({plays:window.playbacks,diagnostics:window.diagnostics,body:document.body.innerHTML})),null,2));}await audit('host-check failure',1);console.error(e);process.exitCode=1;}
finally{await browser?.close();}
