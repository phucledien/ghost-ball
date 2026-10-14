// Authored temporal geometry: hard-edged ribbons, bright seams and faceted debris.
// One dynamic ribbon batch + one instanced shard batch; no bloom or textures.
import * as THREE from 'three';
const TAU=Math.PI*2, clamp=x=>Math.max(0,Math.min(1,x));
const dummy=new THREE.Object3D();
export function makeSpellArt(motif,color='#7edfff',duration=.72,{radius=1,windup=false}={}){
 const group=new THREE.Group(),verts=[],colors=[];
 const base=new THREE.Color(color),core=base.clone().lerp(new THREE.Color('#ffffff'),.85),edge=base.clone().multiplyScalar(.42);
 const maxVerts=6000,geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxVerts*3),3).setUsage(THREE.DynamicDrawUsage));
 geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(maxVerts*3),3).setUsage(THREE.DynamicDrawUsage));
 const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false});
 const ribbons=new THREE.Mesh(geo,mat);ribbons.frustumCulled=false;ribbons.userData.disposeGeometry=true;group.add(ribbons);
 const shardGeo=new THREE.OctahedronGeometry(1,0),shardMat=new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,toneMapped:false});
 const shards=new THREE.InstancedMesh(shardGeo,shardMat,28);shards.frustumCulled=false;shards.userData.disposeGeometry=true;group.add(shards);
 const add=(p,c)=>{verts.push(...p);colors.push(c.r,c.g,c.b);};
 const strip=(path,width,col,layer=0)=>{
  const n=16;
  for(let i=0;i<n;i++){
   const u=i/n,v=(i+1)/n,a=path(u),b=path(v),dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
   const wa=width*Math.sin(Math.PI*u)*.5,wb=width*Math.sin(Math.PI*v)*.5;
   const p=[a[0]-dz/l*wa,a[1]+layer,a[2]+dx/l*wa],q=[a[0]+dz/l*wa,a[1]+layer,a[2]-dx/l*wa];
   const r=[b[0]-dz/l*wb,b[1]+layer,b[2]+dx/l*wb],s=[b[0]+dz/l*wb,b[1]+layer,b[2]-dx/l*wb];
   for(const pt of [p,q,r,q,s,r])add(pt,col);
  }
 };
 const ribbon=(fn,w)=>{strip(fn,w*1.35,edge);strip(fn,w,base,.007);strip(fn,w*.18,core,.014);};
 function update(t){
  const u=clamp(t/duration),out=clamp((1-u)/.38),grow=1-Math.pow(1-clamp(u*3.3),3);
  verts.length=colors.length=0;
  mat.opacity=windup?.45+.5*u:out;shardMat.opacity=windup?.65:out;
  if(windup){
   for(let j=0;j<3;j++)ribbon(s=>{const a=j*TAU/3+s*1.8+t*5,r=(1.5-u*.9)*(1-s*.3);return [Math.cos(a)*r,.12+s*.45,Math.sin(a)*r];},.12*(.5+u));
  }else if(['lane','wedge','split','chevrons','kick'].includes(motif)){
   const lanes=motif==='split'?3:1;
   for(let j=0;j<lanes;j++)for(let k=0;k<2;k++){
    const side=k?1:-1,offset=(j-(lanes-1)/2)*.85;
    ribbon(s=>{const z=.25+s*(motif==='wedge'?3.6:2.6)*grow+u*.8;return [offset+side*Math.sin(s*Math.PI)*(.75+.2*k)*(1-u*.45),.18+Math.sin(s*Math.PI)*(.3+k*.35),z];},(motif==='wedge'?.42:.22)*out);
   }
   for(let j=0;j<2;j++)ribbon(s=>{const a=(s-.5)*Math.PI*1.35;return [Math.sin(a)*(.45+grow*.7),.18+(j?Math.cos(a)*.75:0),.15+grow*(.55+j*.6)+Math.cos(a)*.45];},.19*out);
  }else if(motif==='cross'){
   for(let j=0;j<4;j++){const a=j*TAU/4+.3;ribbon(s=>{const r=(s-.3)*3.5*grow;return [Math.cos(a)*r,.17+Math.sin(s*Math.PI)*.6,Math.sin(a)*r];},.38*out);}
  }else if(motif==='wall'||motif==='crown'){
   const n=motif==='wall'?5:6;
   for(let j=0;j<n;j++)ribbon(s=>{const a=j*TAU/n,r=.8+Math.sin(s*Math.PI)*.35;return motif==='wall'?[(j-2)*.45+Math.sin(s*6+t*4)*.08,s*1.8*grow,.7]:[Math.cos(a)*r,s*1.8*grow,Math.sin(a)*r];},.23*out);
  }else if(motif==='arc'||motif==='curve'){
   for(let j=0;j<3;j++)ribbon(s=>{const a=s*Math.PI*1.35+t*1.5,r=.7+j*.27;return [Math.cos(a)*r,.12+(motif==='arc'?Math.sin(s*Math.PI)*1.6:Math.sin(a)*.1),Math.sin(a)*r+grow*.45];},.24*out);
  }else{
   const frost=motif==='freeze',inward=motif==='trap'||motif==='catch',blink=motif==='blink';
   const r=frost?radius*grow:inward?1.55-grow*.9:.55+grow*1.1;
   for(let j=0;j<(blink?4:3);j++)ribbon(s=>{const a=j*TAU/3+s*2+t*2.5,rr=r+Math.sin(s*Math.PI)*.12;return [Math.cos(a)*rr+(blink?(j%2?1:-1)*.7:0),.07+Math.sin(s*Math.PI)*.14,Math.sin(a)*rr];},(frost?.22:.18)*out);
  }
  // Contact core is deliberately brief; later motion stays below the face.
  if(!windup&&u<.22)for(let j=0;j<4;j++){const a=j*TAU/4;strip(s=>{const r=(s-.5)*1.3*(1-u*2);return [Math.cos(a)*r,.25,Math.sin(a)*r];},.16,core,.03);}
  const count=windup?8:motif==='freeze'?28:16;shards.count=count;
  for(let i=0;i<count;i++){
   const a=i*2.39996,delay=(i%4)*.025,age=Math.max(0,t-delay),q=clamp(age/duration),fade=clamp((1-q)/.35);
   let r=windup?1.4-u:motif==='freeze'?radius*(.45+.5*grow):.35+q*1.8;
   let y=windup?.15+u*.5:.1+Math.sin(q*Math.PI)*(.35+(i%3)*.18);
   let x=Math.cos(a)*r,z=Math.sin(a)*r;
   if(['lane','wedge','chevrons','kick'].includes(motif)){z=Math.abs(z)+q*1.8;y*=.65;}
   dummy.position.set(x,y,z);dummy.rotation.set(q*3,a,q*2);
   const sz=(windup?.045:motif==='freeze'?.14+(i%3)*.035:.065+(i%3)*.018)*fade;
   dummy.scale.set(sz,motif==='freeze'?(.18+1.0*Math.sin(q*Math.PI))*fade:sz*2.7,sz);dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);
  }
  shards.instanceMatrix.needsUpdate=true;
  geo.attributes.position.array.set(verts);geo.attributes.color.array.set(colors);geo.setDrawRange(0,verts.length/3);
  geo.attributes.position.needsUpdate=geo.attributes.color.needsUpdate=true;
 }
 update(0);group.userData.program=motif;
 return {group,duration,update};
}

// History-driven tapered wake follows the real ball trajectory, including bounces.
export function makeBallWake(color){
 const group=new THREE.Group(),geo=new THREE.BufferGeometry(),N=18;
 geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array((N-1)*6*3),3).setUsage(THREE.DynamicDrawUsage));
 geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array((N-1)*6*3),3));
 const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false});
 const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;group.add(mesh);const points=[];
 return {group,update(pos,dt,col=color){
  if(dt>0){if(!points.length||points[0].distanceToSquared(pos)>.008)points.unshift(pos.clone());if(points.length>N)points.pop();}
  const arr=geo.attributes.position.array,cols=geo.attributes.color.array,c=new THREE.Color(col);let index=0;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,w=.14*(1-i/N),nx=-dz/len,nz=dx/len;
   for(const [p,side] of [[a,-1],[a,1],[b,-1],[a,1],[b,1],[b,-1]]){arr[index]=p.x+nx*w*side;arr[index+1]=p.y;arr[index+2]=p.z+nz*w*side;const bright=(1-i/N);cols[index]=c.r*bright;cols[index+1]=c.g*bright;cols[index+2]=c.b*bright;index+=3;}
  }
  geo.setDrawRange(0,index/3);geo.attributes.position.needsUpdate=geo.attributes.color.needsUpdate=true;
 },dispose(){group.removeFromParent();geo.dispose();mat.dispose();}};
}
