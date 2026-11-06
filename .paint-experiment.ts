import { chromium, firefox } from 'playwright-core';
import { PNG } from 'pngjs';
const front = (tag='g',attrs='') => `<${tag} ${attrs}><rect x="4" y="4" width="12" height="12" fill="#804020" style="mix-blend-mode:screen"/></${tag}>`;
const variants={plain:front(),normal:front('g','style="mix-blend-mode:normal"'),transform:front('g','transform="translate(0)"'),opacity:front('g','opacity="0.5"'),isolated:front('g','style="isolation:isolate"'),plus:'<rect x="4" y="4" width="12" height="12" fill="#804020" style="mix-blend-mode:plus-lighter"/>',arithmetic:'<defs><filter id="add" x="-1" y="-1" width="3" height="3" color-interpolation-filters="sRGB"><feComposite in="SourceGraphic" in2="BackgroundImage" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter></defs><rect x="4" y="4" width="12" height="12" fill="#804020" filter="url(#add)"/>'};
for (const [name,engine,path] of [['chromium',chromium,'/home/jarvis/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'],['firefox',firefox,'/home/jarvis/.cache/ms-playwright/firefox-1555/firefox/firefox']] as const) {
 const b=await engine.launch({headless:true,executablePath:path});const p=await b.newPage();
 for(const [variant,content] of Object.entries(variants)) {
 await p.setContent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 20 20" style="isolation:isolate"><rect width="20" height="20" fill="#204060"/>${content}</svg>`);
 const img=PNG.sync.read(await p.locator('svg').screenshot());console.log(name,variant,[...img.data.subarray((120*240+120)*4,(120*240+120)*4+4)]);
 }
 await b.close();
}
