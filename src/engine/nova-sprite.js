// Fixed-camera review route. Only the selected hero's pages are resident.
import * as THREE from 'three';
export async function loadHeroAtlas(heroId='nova',finished=true){
 const base=`${import.meta.env.BASE_URL}assets/heroes/${heroId}/`;
 const response=await fetch(base+`${heroId}-atlas.json`);
 if(!response.ok)throw new Error(`${heroId} atlas metadata: ${response.status}`);
 const manifest=await response.json();const pages=manifest.pages||[{file:manifest.atlas,size:manifest.atlasSize}];
 const textures=[];
 try{for(const page of pages){const texture=await new THREE.TextureLoader().loadAsync(base+(!finished&&page.baseFile?page.baseFile:page.file));texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);}}
 catch(error){textures.forEach(t=>t.dispose());throw error;}
 return {manifest,textures,texture:textures[0],dispose(){textures.forEach(t=>t.dispose())}};
}
export function frameAt(manifest,action,facing,elapsed){
 const frames=Object.values(manifest.frames).filter(f=>f.action===action&&f.facing===facing).sort((a,b)=>a.index-b.index);
 if(!frames.length)throw new Error(`Missing animation ${action}/${facing}`);
 const duration=frames.reduce((n,f)=>n+f.duration,0),loop=(manifest.loops||['idle','run']).includes(action);
 let t=loop?((elapsed%duration)+duration)%duration:Math.max(0,Math.min(elapsed,duration-.001));
 for(const f of frames){if(t<f.duration)return f;t-=f.duration;}return frames.at(-1);
}
export function buildNovaSprite(atlas){
 const maps=atlas.textures.map(t=>{const map=t.clone();map.needsUpdate=true;return map});
 const material=new THREE.SpriteMaterial({map:maps[0],alphaTest:.5,transparent:false,depthWrite:true,toneMapped:false});
 const sprite=new THREE.Sprite(material);sprite.scale.set(4,4,1);sprite.center.set(atlas.manifest.pivot[0]/96,1-atlas.manifest.pivot[1]/96);
 const setFrame=frame=>{const page=frame.page||0,map=maps[page];material.map=map;const [x,y,w,h]=frame.rect,[aw,ah]=atlas.manifest.pages?.[page].size||atlas.manifest.atlasSize;map.repeat.set(w/aw,h/ah);map.offset.set(x/aw,1-(y+h)/ah);sprite.userData.frame=frame.name;};
 return {sprite,setFrame,dispose(){maps.forEach(m=>m.dispose());material.dispose()}};
}
export const loadNovaAtlas=()=>loadHeroAtlas('nova');
