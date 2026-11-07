(async () => {
  const checks=[]; const snapshots=[];
  const assert=(label,value)=>{checks.push({label,pass:!!value});if(!value)throw Error(label)};
  const tracks=icon.data.list('$tracks');
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const snap=label=>{const s={label,count:tracks.length,titles:Array.from({length:tracks.length},(_,i)=>tracks.at(i).string('title').value),values:icon.values(),dots:icon.shadowRoot.querySelectorAll('circle').length,selected:icon.data.get('$selected')};snapshots.push(s);assert(label+' dot count',s.dots===s.count);return s};
  let s=snap('initial');
  assert('Dawn clicked and highlighted',s.selected===1&&s.values['rows/0/visits']===1&&s.values['rows/0/outline.opacity']===1);
  tracks.add({uid:4,title:'Glow',duration:110,cover:'ember',clip:'ember-clip'}); await frame();
  s=snap('append');assert('append order',s.titles.join(',')==='Dawn,Tide,Ember,Glow');assert('new row width',s.values['rows/3/duration.w']===11);
  tracks.insert(1,{uid:5,title:'Rain',duration:40,cover:'tide',clip:'tide-clip'}); await frame();
  s=snap('insert');assert('insert order',s.titles.join(',')==='Dawn,Rain,Tide,Ember,Glow');assert('Tide state survives insert',s.values['rows/2/visits']===1);
  tracks.swap(0,3); await frame();
  s=snap('swap');assert('swap order',s.titles.join(',')==='Ember,Rain,Tide,Dawn,Glow');assert('Dawn highlight follows swap',s.values['rows/3/outline.opacity']===1&&s.values['rows/3/visits']===1&&s.values['rows/0/outline.opacity']===0);
  tracks.remove(tracks.at(1)); await frame();
  s=snap('remove');assert('remove order',s.titles.join(',')==='Ember,Tide,Dawn,Glow');assert('Dawn state survives removal',s.values['rows/2/outline.opacity']===1&&s.values['rows/2/visits']===1);
  tracks.at(0).string('title').set('Ash'); tracks.at(0).number('duration').set(80); await frame();
  s=snap('edit fields');assert('title width follows title-only edit',s.values['rows/0/title.w']===3);assert('duration edit',s.values['rows/0/duration.w']===8);
  assert('audio decoded and started twice',starts.length===2&&starts.every(s=>s.args[1]===0.2&&s.args[2]===0.8&&s.duration===1.2));
  assert('different source PCM',starts[0].sample!==starts[1].sample);
  assert('no browser diagnostics',errors.length===0);
  window.verification={checks,snapshots,starts,ended,events:events.filter(e=>e.audio),errors};
  return window.verification;
})()
