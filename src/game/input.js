// Continuous movement plus event-latched actions. Fast taps survive between frames.
export class Input {
  constructor(stage, touch) {
    this.stage=stage;this.touch=touch;this.keys=new Set();this.prev={a:false,skill:false,item:false};
    this.edges={aPressed:false,aReleased:false,skillPressed:false,itemPressed:false};
    this.mouse=null;this.mouseA=false;this.mouseSkill=false;this.listeners=[];
    const on=(el,name,fn)=>{el.addEventListener(name,fn);this.listeners.push(()=>el.removeEventListener(name,fn))};
    const aliases={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyJ:'j',KeyK:'k',KeyL:'l',KeyQ:'q',KeyE:'e',Space:' '};
    this.onKey=e=>{
      const k=aliases[e.code]||e.key.toLowerCase();
      if(e.type==='keydown'&&e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      if(e.type==='keydown')this.keys.add(k);else this.keys.delete(k);
      this.latch();
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    };
    on(window,'keydown',this.onKey);on(window,'keyup',this.onKey);
    on(window,'blur',()=>this.reset());on(document,'visibilitychange',()=>{if(document.hidden)this.reset()});
    const el=stage.container;
    on(el,'pointermove',e=>{if(e.pointerType!=='mouse')return;const r=el.getBoundingClientRect();this.mouse={x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now()}});
    on(el,'pointerdown',e=>{if(e.pointerType!=='mouse'||e.target.closest?.('.interactive,button,a,input,select'))return;if(e.button===0)this.mouseA=true;if(e.button===2)this.mouseSkill=true;this.latch()});
    const end=e=>{if(e.pointerType!=='mouse')return;if(e.button===0)this.mouseA=false;if(e.button===2)this.mouseSkill=false;this.latch()};
    on(window,'pointerup',end);on(window,'pointercancel',end);on(el,'contextmenu',e=>e.preventDefault());
    if(touch)touch.onChange=()=>this.latch();
  }
  held(){const k=this.keys,t=this.touch;return{a:k.has('j')||k.has(' ')||this.mouseA||!!t?.a,skill:k.has('k')||k.has('q')||this.mouseSkill||!!t?.skill,item:k.has('l')||k.has('e')||!!t?.item}}
  latch(){const now=this.held();for(const key of ['a','skill','item'])if(now[key]&&!this.prev[key])this.edges[key+'Pressed']=true;if(!now.a&&this.prev.a)this.edges.aReleased=true;this.prev=now;return now}
  reset(){this.keys.clear();this.mouseA=this.mouseSkill=false;this.mouse=null;this.prev={a:false,skill:false,item:false};this.edges={aPressed:false,aReleased:false,skillPressed:false,itemPressed:false};if(this.touch){this.touch.reset?.();Object.assign(this.touch,{joy:{x:0,y:0},a:false,skill:false,item:false,aimJoy:null})}this.onReset?.()}
  axes(){const yaw=this.stage.C('camera.yaw')*Math.PI/180;return{up:{x:-Math.sin(yaw),z:-Math.cos(yaw)},right:{x:Math.cos(yaw),z:-Math.sin(yaw)}}}
  toWorld(sx,sy){const{up,right}=this.axes();return{x:right.x*sx+up.x*sy,z:right.z*sx+up.z*sy}}
  poll(player){
    const k=this.keys,t=this.touch;let sx=0,sy=0;
    if(k.has('a')||k.has('arrowleft'))sx--;if(k.has('d')||k.has('arrowright'))sx++;if(k.has('w')||k.has('arrowup'))sy++;if(k.has('s')||k.has('arrowdown'))sy--;
    if(t&&Math.hypot(t.joy.x,t.joy.y)>.12){sx=t.joy.x;sy=t.joy.y}const len=Math.hypot(sx,sy);if(len>1){sx/=len;sy/=len}const mv=this.toWorld(sx,sy);let aim=null;
    if(this.mouse&&player&&performance.now()-this.mouse.t<2500){const g=this.stage.toGround(this.mouse.x,this.mouse.y),dx=g.x-player.x,dz=g.z-player.z;if(Math.hypot(dx,dz)>.3)aim={x:dx,z:dz}}
    if(t?.aimJoy&&Math.hypot(t.aimJoy.x,t.aimJoy.y)>.3)aim=this.toWorld(t.aimJoy.x,t.aimJoy.y);
    if(!aim&&len>.1)aim={x:mv.x,z:mv.z};const held=this.latch();
    const out={mx:mv.x,mz:mv.z,aim,...this.edges,aHeld:held.a};for(const k of Object.keys(this.edges))this.edges[k]=false;return out;
  }
  dispose(){this.reset();for(const off of this.listeners)off();if(this.touch)this.touch.onChange=null}
}
