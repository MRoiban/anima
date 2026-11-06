// Independent assertions over CLI samples, original media, pixels and public host snapshots.
import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
const root = new URL('.', import.meta.url);
const read = async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try {
  const records=(await readFile(new URL('evidence/checks.jsonl',root),'utf8')).trim().split('\n').map(JSON.parse);
  async function samples(script){const row=records.findLast(r=>r.args[0]==='sample'&&r.args.includes(script));return (await readFile(new URL('evidence/'+row.output,root),'utf8')).trim().split('\n').map(JSON.parse);}
  const base='docs/benchmarks/runs/2026-11-06-p5b/animl/';
  const initial=await samples(base+'initial.sample');
  const v=initial[0].values;
  eq([v['$tracks.0.title'],v['$tracks.1.title'],v['$tracks.2.title']],['Dawn','Tide','Ember']);
  eq([v['$tracks.0.duration'],v['$tracks.1.duration'],v['$tracks.2.duration']],[90,150,60]);
  eq([v['rows/0/titleBar.w'],v['rows/1/titleBar.w'],v['rows/2/titleBar.w']],[4,4,5]);
  eq([v['rows/0/durationBar.w'],v['rows/1/durationBar.w'],v['rows/2/durationBar.w']],[9,15,6]);
  const clicks=await samples(base+'clicks.sample');
  for(let i=0;i<3;i++){
    eq(clicks[i].values.$selected,['dawn','tide','ember'][i]);
    eq([0,1,2].map(j=>clicks[i].values[`rows/${j}/highlight.stroke.width`]),[0,1,2].map(j=>i===j?0.3:0));
    eq(clicks[i].events.filter(e=>e.audio).map(e=>e.audio),[['dawnSound'],['tideSound'],['emberSound']][i]);
  }
  eq(clicks[3].values['rows/2/clicks'],2);
  const data=await samples(base+'data.sample');
  eq(data[0].values['rows/0/durationBar.w'],12);
  eq(data[0].values['rows/0/mossCover.visible'],true);
  eq(data[1].events.filter(e=>e.audio).map(e=>e.audio),['mossSound']);
  const host=await read('evidence/host-snapshots.json');
  const orders=[['dawn','tide','ember'],['dawn','tide','ember'],['dawn','tide','ember','moss'],['dawn','dusk','tide','ember','moss'],['dusk','tide','ember','moss'],['dusk','moss','ember','tide'],['dusk','moss','ember','tide'],['dusk','moss'],[]];
  for(let n=0;n<host.length;n++){
    const s=host[n];eq(s.tracks.map(t=>t.id),orders[n]);eq(s.count,orders[n].length);
    eq(Object.keys(s.states).filter(k=>k.endsWith('/audio')).length,s.count);
    eq((s.svg.match(/id="[^"]*-dots\//g)||[]).length,s.count*2); // group + dot ids
    if(n>0&&n<7){const i=s.tracks.findIndex(t=>t.id==='tide');eq(s.values[`rows/${i}/clicks`],n===6?2:1);eq(s.values[`rows/${i}/highlight.stroke.width`],0.3);}
  }
  const doc=await read('playlist.ani');
  for(const name of ['dawn','tide','ember','moss']){
    const image=PNG.sync.read(await readFile(new URL(name+'.png',root)));eq([image.width,image.height],[8,8]);
    const asset=doc.components.row.assets[name+'Sound'];eq([asset.start,asset.end],[0.2,1]);
    const wav=await readFile(new URL(name+'.wav',root));eq([wav.toString('ascii',0,4),wav.toString('ascii',8,12)],['RIFF','WAVE']);eq(wav.readUInt32LE(40)/2/8000,1.2);
  }
  const frame=PNG.sync.read(await readFile(new URL('evidence/initial-final.png',root)));
  // Every interior cover pixel equals its authored texel, including either side of every boundary.
  let pixelChecks=0;
  for(const [row,name] of ['dawn','tide','ember'].entries()){
    const src=PNG.sync.read(await readFile(new URL(name+'.png',root)));
    for(let y=0;y<48;y++)for(let x=0;x<48;x++){
      const i=((84+row*72+y)*frame.width+24+x)*4,j=(Math.floor(y/6)*8+Math.floor(x/6))*4;
      assert.deepEqual([...frame.data.subarray(i,i+4)],[...src.data.subarray(j,j+4)]);pixelChecks++;
    }
  }
  await writeFile(new URL('evidence/assertions.json',root),JSON.stringify({checks,pixelChecks,hostSnapshots:host.length,cliSnapshots:initial.length+clicks.length+data.length},null,2)+'\n');
  await appendFile(new URL('evidence/aux-checks.jsonl',root),JSON.stringify({at:new Date().toISOString(),kind:'independent evidence and pixel check',errors:0})+'\n');
  console.log({checks,pixelChecks});
}catch(e){await appendFile(new URL('evidence/aux-checks.jsonl',root),JSON.stringify({at:new Date().toISOString(),kind:'evidence check failure',errors:1,message:e.message})+'\n');console.error(e);process.exitCode=1;}
