import './art.css';
import './device.css';
const params=new URLSearchParams(location.search);
document.querySelector('#device-app').innerHTML=`<header><a href="./art.html">GHOST<span>●</span>BALL</a><span>DEVICE CHECK / ANIMATED EFFECTS / SHOWCASE 8</span><a href="./">Play ↗</a></header><main><div class="intro"><div><p class="eyebrow">RUN ON THE DEVICE YOU WANT TO CHECK</p><h1>Measure the<br><em>real match.</em></h1></div><div class="intro-note"><p>Three arenas, fourteen players, two balls and the live Blender masters. Keep this tab visible. A browser simulation is not a physical-phone result.</p></div></div><section class="controls"><label>Device label<input id="deviceLabel" placeholder="e.g. iPhone 16e · Safari"></label><button id="start">Run 45-second check</button><button id="download" disabled>Download results</button><a href="./art.html">Back to Art Lab ↗</a></section><p id="status" role="status">Ready. The game fills the screen while measuring.</p><div class="table-wrap"><table><thead><tr><th>Arena</th><th>Median frame</th><th>95th percentile</th><th>Frames &gt;33 ms</th><th>Draw calls</th></tr></thead><tbody id="results"></tbody></table></div><section class="notes"><div><h2>Also check by eye.</h2><p>Play a short match after the measurement. Check the bright ball on Frost, the whole roster in a crowded lane, skill effects around a catch, and touch controls in both orientations.</p><p>This tool measures frame delivery intervals, not GPU time. Browser throttling, thermal state, display refresh and background tabs affect results. It records interruptions so a hidden-tab run cannot silently pass.</p></div><div><h2>Keep an honest record.</h2><p>Results stay in this browser and can be downloaded. Device labels are user supplied; the tool records the actual browser and viewport. It does not infer a physical device from a narrow viewport.</p><p>A 95th-percentile frame interval below 33.4 ms is a provisional 30 fps target. Visual and input checks are still separate.</p></div></section><footer>Ghost Ball / repeatable art-performance review</footer></main><div id="runner" hidden><div class="runbar"><b id="progress"></b><button id="cancel">Cancel</button></div><iframe id="game" title="Live benchmark match"></iframe></div>`;
const $=s=>document.querySelector(s),maps=['temple','egolab','frost'];let report=null,cancelled=false,hiddenCount=0;
$('#deviceLabel').value=params.get('label')||'';
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!$('#runner').hidden)hiddenCount++});
$('#cancel').onclick=()=>{cancelled=true};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 if(!$('#runner').hidden)return;
 cancelled=false;hiddenCount=0;$('#results').innerHTML='';$('#start').disabled=true;$('#download').disabled=true;$('#runner').hidden=false;
 report={version:2,artRevision:'animated-showcase-8',runId:params.get('run')||crypto.randomUUID(),startedAt:new Date().toISOString(),label:$('#deviceLabel').value.trim()||'Unlabelled device',userAgent:navigator.userAgent,devicePixelRatio,screen:{width:screen.width,height:screen.height},results:[],physicalDeviceVerified:false};
 try{
  for(const map of maps){
   if(cancelled)throw new Error('Cancelled');
   $('#progress').textContent=`${map.toUpperCase()} / loading`;const frame=$('#game');const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Game load timed out')),20000);frame.onload=()=>{clearTimeout(timer);resolve()}});frame.src=`./?autoplay=1&demo=1&hero=echo&mode=twin&map=${map}&art=master&bench=1`;
   await loaded;const deadline=performance.now()+20000;
   while(!frame.contentWindow?.__gb?.match){if(cancelled)throw new Error('Cancelled');if(performance.now()>deadline)throw new Error('Game did not load');await wait(100);}
   await wait(1000);const intervals=[],calls=[];let last=0;const end=performance.now()+15000;
   while(performance.now()<end){
    if(cancelled)throw new Error('Cancelled');
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Frame delivery stopped. Keep the page visible and try again.')),3000);frame.contentWindow.requestAnimationFrame(t=>{clearTimeout(timer);if(last)intervals.push(Math.round((t-last)*1000)/1000);last=t;calls.push(frame.contentWindow.__gb.stage.renderer.info.render.calls);resolve()})});
    $('#progress').textContent=`${map.toUpperCase()} / ${Math.max(0,Math.ceil((end-performance.now())/1000))} seconds`;
   }
   intervals.sort((a,b)=>a-b);const percentile=p=>intervals[Math.floor((intervals.length-1)*p)];const gb=frame.contentWindow.__gb;
   const result={map,samples:intervals.length,medianMs:percentile(.5),p95Ms:percentile(.95),over33ms:intervals.filter(v=>v>33.4).length,maxDrawCalls:Math.max(...calls),players:gb.match.players.length,heroes:[...new Set(gb.match.players.map(p=>p.heroId))],balls:gb.match.balls.length,viewport:{width:frame.clientWidth,height:frame.clientHeight},renderSize:{width:gb.stage.lowW,height:gb.stage.lowH},pixelScale:gb.stage.pixelScale,artRevision:gb.artRevision};
   report.results.push(result);const tr=document.createElement('tr');for(const text of [map,result.medianMs.toFixed(1)+' ms',result.p95Ms.toFixed(1)+' ms',result.over33ms,result.maxDrawCalls]){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('#results').append(tr);
  }
  report.finishedAt=new Date().toISOString();report.hiddenCount=hiddenCount;report.valid=hiddenCount===0;
  report.frameTargetMet=report.valid&&report.results.every(r=>r.p95Ms<=33.4);
  $('#status').textContent=report.valid?'Measurement complete. Download the record, then check readability and touch controls.':'Measurement interrupted by a hidden tab. Run again with the page visible.';
  localStorage.setItem('ghostball.device-check.v1',JSON.stringify(report));$('#download').disabled=false;
  // A local QA server accepts this opt-in same-origin callback. Hosted runs keep results local.
  if(params.get('report')==='1')await fetch('./qa-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)}).catch(()=>{});
 }catch(e){$('#status').textContent=e.message;report=null;}
 finally{$('#runner').hidden=true;$('#game').src='about:blank';$('#start').disabled=false;}
}
$('#start').onclick=run;
$('#download').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ghost-ball-device-check.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.__deviceCheck={get report(){return report},run};
if(params.get('auto')==='1')run();
