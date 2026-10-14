"""Authored roster masters. Run with Blender --background --python tools/art/build-hero.py -- --hero nova.
All coordinates authored Y-up/+Z-front to match the game's rig. Blender stores Z-up.
No generated concept geometry is traced automatically. Output paths are explicit/local.
"""
import bpy, json, math, sys, os
from pathlib import Path
from mathutils import Vector, Matrix, Euler
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('GHOST_ART_BUILD','/Users/thohong/Library/Developer/CodexBuilds/ghost-ball-art')).resolve()
if any(s in str(OUT) for s in ('Mobile Documents','/Documents/','/Desktop/')):raise RuntimeError('Use a real local render destination')
OUT.mkdir(parents=True,exist_ok=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
HERO=args[args.index('--hero')+1] if '--hero' in args else 'nova'
assert HERO in ('nova','bolt','titan','jinx','echo','kaiz')
SCALE={'nova':(1,1,1),'bolt':(.88,1.02,.92),'titan':(1.27,1.04,1.18),'jinx':(.94,.92,.96),'echo':(.90,1.09,.94),'kaiz':(.86,1.07,.90)}[HERO]
HIPS=.88*SCALE[1]
FOOT=[0,-.39*SCALE[1],.24*SCALE[2]]
for dest in [ROOT/f'art/source/{HERO}',ROOT/f'public/assets/heroes/{HERO}']:
 dest.mkdir(parents=True,exist_ok=True)
RENDER='--render' in args
BAKE='--bake' in args
if (ROOT/f'art/source/{HERO}/{HERO}-master.blend').exists() and '--force' not in args:
 raise RuntimeError('Master exists. This bootstrap script replaces authored geometry. Use --force only to deliberately regenerate; preserve manual .blend edits first.')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_percentage=100
scene.display.shading.light='FLAT';scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=False
scene.display.shading.show_specular_highlight=False
scene.display.shading.show_object_outline=False;scene.display.shading.object_outline_color=(.035,.05,.09)
scene.display.render_aa='OFF'
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.world.color=(.15,.15,.15)
scene.render.fps=100
# Linear display colours: the palette is shared with the browser exporter.
PALETTE={
 'blue':['#244776','#2f6fe0','#6495ed'],
 'navy':['#141c30','#23314c','#374765'],
 'cream':['#b1aa92','#eee6d2','#fff7e5'],
 'skin':['#a76348','#db9b6e','#f0ba8a'],
 'hair':['#101827','#1d293c','#354458'],
 'ink':['#101827']*3,
}
if HERO=='bolt':
 PALETTE.update(blue=['#82303d','#cf4b57','#ee7c79'],navy=['#251725','#482535','#694052'],hair=['#722d35','#b64349','#e56e60'],skin=['#aa7053','#e1aa82','#f3c7a0'])
elif HERO=='titan':
 PALETTE.update(blue=['#141720','#2c303b','#484e5c'],navy=['#916426','#d49f44','#efc66b'],cream=['#a7752b','#e5b456','#ffe094'],skin=['#71452e','#b9784e','#d89b68'],hair=['#10151c','#212730','#38414c'])
elif HERO=='jinx':
 PALETTE.update(blue=['#a87827','#d9ac43','#f3d476'],navy=['#171d29','#2a303b','#48505c'],hair=['#24191b','#49302c','#705044'],skin=['#a77454','#e5b58c','#f5cda7'])
elif HERO=='echo':
 PALETTE.update(blue=['#b0b8b7','#e6e9df','#fff7e5'],navy=['#204a53','#347b83','#63a9ad'],cream=['#23545c','#478c93','#80b9ba'],hair=['#9ba7b6','#d5dee5','#f3f5ed'],skin=['#a87b61','#e7bc99','#f3d2b3'])
elif HERO=='kaiz':
 PALETTE.update(blue=['#3c294f','#654175','#986291'],navy=['#a69e8a','#e8dfc9','#fff7e5'],hair=['#a47831','#dbb657','#f4d985'],skin=['#ad7d5e','#e7bd99','#f5d4b4'])
PALETTE['boot']={'nova':PALETTE['cream'],'bolt':PALETTE['cream'],'titan':PALETTE['blue'],'jinx':['#792b37','#bd4251','#e27079'],'echo':['#557990','#9cc5da','#d5eaf2'],'kaiz':PALETTE['blue']}[HERO]
MATS={}

def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (1,3,5))
for role,colors in PALETTE.items():
 for n,h in enumerate(colors):
  m=bpy.data.materials.new(role+str(n));m.diffuse_color=(*rgb(h),1);m.use_nodes=True
  bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb(h),1)
  bs.inputs['Roughness'].default_value=1
  MATS[(role,n)]=m
# Three -> Blender: x,y,z => x,-z,y. Positive Three Euler X stays Blender X.
B=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
def bv(p):return B@Vector(p)
nodes={}; node_specs=[]; meshes=[]
def node(name,parent,pos):
 pos=[round(v*SCALE[i],6) for i,v in enumerate(pos)]
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o)
 if parent:o.parent=nodes[parent]
 o.location=bv(pos);nodes[name]=o;node_specs.append({'name':name,'parent':parent,'position':pos})
 return o
node('rig',None,[0,0,0]);node('hips','rig',[0,.88,0]);node('body','hips',[0,.12,0]);node('head','body',[0,.59,0])
if HERO in ('bolt','echo'):node('secondary','head' if HERO=='bolt' else 'body',[0,0,0])
for side,s in [('L',1),('R',-1)]:
 node('sh.'+side,'body',[s*.43,.43,0])
 node('el.'+side,'sh.'+side,[0,-.29,0])
 node('hip.'+side,'hips',[s*.18,0,0])
 node('knee.'+side,'hip.'+side,[0,-.43,0])
 node('ankle.'+side,'knee.'+side,[0,-.39,0])
 node('boot.'+side,'ankle.'+side,[0,0,.24])

def mesh(name,parent,verts,faces,role='blue'):
 # Proportion changes are authored into mesh coordinates, never runtime root scale.
 factors=list(SCALE)
 if parent=='head' or (HERO=='bolt' and parent=='secondary'):factors=[SCALE[0]**.38,SCALE[1],SCALE[2]**.5]
 if HERO=='titan' and parent in ('sh.L','sh.R','el.L','el.R'):factors[0]*=1.12
 verts=[[v*factors[i] for i,v in enumerate(p)] for p in verts]
 data=bpy.data.meshes.new(name);data.from_pydata([bv(v) for v in verts],[],faces);data.update()
 o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.parent=nodes[parent]
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
 for n in range(3):data.materials.append(MATS[(role,n)])
 # Deliberately broad object-space planes, not a noisy dynamically lit shader.
 light=Vector((-.6,.8,.5)).normalized()
 for p in data.polygons:
  normal=B.transposed()@p.normal;d=normal.dot(light)
  p.material_index=2 if d>.65 else 0 if d<-.12 else 1
  p.use_smooth=False
 o['role']=role;meshes.append(o);return o

def form(name,parent,levels,role,offset=(0,0,0),bevel=.20):
 verts=[]
 for y,w,d,z in levels:
  b=min(w,d)*bevel
  for x,t in [(-w/2+b,-d/2),(w/2-b,-d/2),(w/2,-d/2+b),(w/2,d/2-b),(w/2-b,d/2),(-w/2+b,d/2),(-w/2,d/2-b),(-w/2,-d/2+b)]:
   verts.append([x+offset[0],y+offset[1],t+z+offset[2]])
 faces=[tuple(reversed(range(8)))]
 for i in range(len(levels)-1):
  for j in range(8):faces.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
 faces.append(tuple(range((len(levels)-1)*8,len(levels)*8)))
 return mesh(name,parent,verts,faces,role)

def box(name,parent,center,size,role,bevel=.12):
 x,y,z=center;w,h,d=size
 return form(name,parent,[(y-h/2,w,d,z),(y+h/2,w,d,z)],role,(x,0,0),bevel)
# Kit: coherent bold bands, fewer decorative surfaces.
form('Jersey','body',[(-.08,.46,.29,0),(.13,.53,.32,0),(.40,.73,.35,0),(.51,.67,.31,0)],'blue')
form('ChestBand','body',[(.30,.682,.36,.002),(.385,.735,.365,.002)],'cream')
form('WaistBand','body',[(-.095,.47,.30,0),(-.045,.48,.31,0)],'navy')
form('Neck','body',[(.48,.20,.19,0),(.65,.20,.19,0)],'skin')
form('Collar','body',[(.49,.28,.25,0),(.55,.26,.23,0)],'cream')
form('ShortsWaist','hips',[(-.16,.47,.33,0),(.10,.49,.33,0)],'navy')
for side,s in [('L',1),('R',-1)]:
 hip='hip.'+side;knee='knee.'+side;sh='sh.'+side;el='el.'+side
 form('Shorts.'+side,hip,[(-.25,.27,.31,.005),(.035,.29,.31,0)],'navy')
 box('ShortsStripe.'+side,hip,[s*.128,-.12,.005],[.035,.22,.29],'cream')
 form('Thigh.'+side,hip,[(-.44,.22,.22,.01),(-.19,.25,.25,0)],'skin')
 form('Calf.'+side,knee,[(-.32,.17,.18,-.012),(-.14,.23,.22,-.025),(.03,.22,.22,0)],'skin')
 form('Sock.'+side,knee,[(-.38,.19,.20,0),(-.19,.22,.23,-.015)],'cream')
 form('SockBand.'+side,knee,[(-.245,.215,.235,-.01),(-.19,.222,.24,-.015)],'navy')
 form('Boot.'+side,knee,[(-.435,.28,.43,.10),(-.35,.28,.44,.10),(-.27,.21,.27,.025)],'cream')
 form('Sole.'+side,knee,[(-.45,.29,.45,.10),(-.411,.29,.45,.10)],'navy')
 box('BootTongue.'+side,knee,[0,-.287,.11],[.12,.035,.17],'cream')
 form('Sleeve.'+side,sh,[(-.16,.28,.29,0),(.07,.30,.31,0)],'blue')
 form('SleeveBand.'+side,sh,[(-.16,.284,.294,0),(-.105,.286,.296,0)],'cream')
 form('UpperArm.'+side,sh,[(-.31,.19,.21,0),(-.13,.235,.235,0)],'skin')
 form('Forearm.'+side,el,[(-.25,.16,.19,.01),(-.07,.22,.23,0),(.02,.19,.20,0)],'skin')
 form('WristTape.'+side,el,[(-.25,.185,.21,.01),(-.185,.195,.22,.01)],'cream')
 form('Hand.'+side,el,[(-.36,.19,.20,.025),(-.25,.20,.22,.02)],'skin')
# Boots have their own ankle pivot; subtract its local offset from vertices.
for o in meshes:
 if o.name.startswith(('Boot.','Sole.','BootTongue.')):
  side=o.name.rsplit('.',1)[1]
  for v in o.data.vertices:v.co+=bv([0,.39*SCALE[1],0])
  o.parent=nodes['ankle.'+side]
# Broad jaw, simple eyes; the face is a graphic at game scale.
form('Head','head',[(.035,.28,.25,.015),(.12,.40,.33,.015),(.34,.43,.36,0),(.44,.36,.32,-.02)],'skin')
for side,s in [('L',1),('R',-1)]:
 box('Ear.'+side,'head',[s*.22,.235,.0],[.075,.12,.10],'skin')
 box('EyeSocket.'+side,'head',[s*.09,.255,.177],[.12,.072,.012],'ink',.04)
 box('Eye.'+side,'head',[s*.09,.254,.185],[.089,.045,.009],'cream',.02)
 box('Iris.'+side,'head',[s*.076,.254,.192],[.034,.045,.008],'ink',.01)
 # Brow wedge rather than single pixel geometry scatter.
 mesh('Brow.'+side,'head',[[s*.035,.282,.190],[s*.15,.303,.17],[s*.15,.326,.17],[s*.035,.306,.190]],[(0,1,2,3)],'hair')
mesh('Nose','head',[[-.035,.24,.18],[.035,.24,.18],[.03,.18,.18],[-.03,.18,.18],[0,.19,.235]],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'skin')
# The tiny mouth was below one render pixel and shimmered; the jaw carries expression.
if HERO=='nova':
 form('HairMass','head',[(.29,.43,.36,-.055),(.45,.50,.40,-.045),(.54,.37,.32,-.07)],'hair')
 # Five intentional locks: large wedge volumes, no cone scatter.
 for name,base,tip,w,d in [
  ('Crest',(-.045,.47,-.05),(-.12,.65,-.08),.29,.31),
  ('Left',(.13,.43,.02),(.28,.53,-.02),.24,.28),
  ('Right',(-.15,.43,.00),(-.29,.49,-.08),.22,.25),
  ('Fringe',(-.035,.39,.16),(-.14,.26,.22),.24,.12),
  ('Back',(.015,.44,-.19),(.045,.53,-.32),.30,.18)]:
  x,y,z=base
  mesh('Hair.'+name,'head',[[x-w/2,y-.04,z-d/2],[x+w/2,y-.04,z-d/2],[x+w/2,y+.035,z+d/2],[x-w/2,y+.035,z+d/2],list(tip)],[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'hair')
elif HERO=='bolt':
 form('HairCap','head',[(.30,.435,.37,-.045),(.46,.45,.38,-.045),(.52,.32,.29,-.065)],'hair')
 mesh('HairFringe','head',[[-.22,.43,.14],[.19,.45,.17],[.12,.34,.21],[-.08,.26,.205],[-.23,.34,.08]],[(0,1,2,3,4)],'hair')
 # One tapered ponytail mass, separated from the back by a visible neck gap.
 form('Ponytail','secondary',[(.04,.09,.12,-.45),(.25,.23,.21,-.48),(.54,.32,.29,-.40),(.65,.23,.22,-.29),(.57,.14,.12,-.17)],'hair')
 box('HairTie','head',[0,.53,-.215],[.19,.08,.13],'cream')
elif HERO=='titan':
 form('BuzzCut','head',[(.345,.44,.36,-.025),(.46,.425,.35,-.025),(.485,.35,.29,-.025)],'hair',bevel=.13)
 form('Beard','head',[(.015,.30,.24,.07),(.09,.38,.28,.07),(.18,.40,.25,.075)],'hair',bevel=.12)
 box('BeardMouth','head',[0,.15,.207],[.14,.024,.009],'ink')
 # Pendant is separate so the no-accessory loadout can omit it.
 mesh('Chain.L','body',[[-.12,.50,.17],[-.10,.50,.18],[.012,.335,.195],[-.012,.335,.195]],[(0,1,2,3)],'cream')
 mesh('Chain.R','body',[[.12,.50,.17],[.10,.50,.18],[-.012,.335,.195],[.012,.335,.195]],[(0,3,2,1)],'cream')
 box('ChainPendant','body',[0,.32,.193],[.075,.10,.032],'cream')
elif HERO=='jinx':
 form('BobCap','head',[(.28,.47,.39,-.05),(.43,.53,.41,-.04),(.53,.41,.33,-.06)],'hair')
 for side,sgn in [('L',1),('R',-1)]:
  form('BobSide.'+side,'head',[(.16,.15,.22,-.01),(.41,.19,.31,-.04)],'hair',(sgn*.22,0,0))
  box('GoggleFrame.'+side,'head',[sgn*.115,.40,.191],[.18,.135,.055],'navy',.24)
  box('GoggleLens.'+side,'head',[sgn*.115,.40,.224],[.12,.083,.015],'cream',.24)
 box('GoggleBridge','head',[0,.40,.206],[.09,.04,.04],'navy')
 # Offset fringe gives Jinx one clear diagonal silhouette rather than scattered strands.
 mesh('BobFringe','head',[[-.25,.41,.16],[.24,.42,.16],[.18,.29,.20],[-.04,.34,.24],[-.24,.24,.12]],[(0,1,2,3,4)],'hair')
elif HERO=='echo':
 form('HairMass','head',[(.31,.45,.37,-.045),(.48,.50,.38,-.06),(.55,.36,.28,-.09)],'hair')
 for name,x,tip in [('L',.17,[.30,.42,.04]),('C',-.02,[-.12,.24,.22]),('R',-.17,[-.28,.47,-.05])]:
  mesh('HairLock.'+name,'head',[[x-.12,.47,-.16],[x+.12,.47,-.14],[x+.12,.45,.16],[x-.12,.43,.17],tip],[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'hair')
 form('ScarfCollar','body',[(.48,.30,.28,-.01),(.60,.32,.28,-.01)],'cream')
 mesh('ScarfTail','secondary',[[-.12,.53,-.17],[.12,.53,-.17],[.16,.41,-.72],[-.13,.34,-.62],[-.13,.49,-.18],[.13,.49,-.18],[.16,.38,-.72],[-.13,.31,-.62]],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'cream')
else:
 form('HairMass','head',[(.32,.44,.36,-.04),(.47,.45,.37,-.05),(.54,.32,.27,-.10)],'hair')
 mesh('SweptCrest','head',[[-.21,.43,-.13],[.17,.43,-.15],[.20,.48,.14],[-.14,.48,.18],[.08,.73,-.16]],[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'hair')
 form('Circlet','head',[(.335,.455,.375,0),(.385,.455,.375,0)],'hair',bevel=.14)
 box('CircletGem','head',[0,.36,.195],[.08,.065,.025],'cream')
 for side,sgn in [('L',1),('R',-1)]:
  box('RaisedCollar.'+side,'body',[sgn*.13,.56,0],[.08,.20,.23],'cream')
# Reassign whole material groups for signature boots and deliberate kit differences.
for o in meshes:
 role=o['role']
 if o.name.startswith(('Boot.','BootTongue.')):role='boot'
 if HERO=='jinx' and o.name=='Sock.R':role='navy'
 if HERO=='jinx' and o.name.startswith(('ChestBand','SleeveBand','Collar')):role='navy'
 if HERO=='kaiz' and o.name.startswith(('Hand.','WristTape.')):role='ink'
 if role!=o['role']:
  o['role']=role
  for n in range(3):o.data.materials[n]=MATS[(role,n)]
# Titan's kit has dark socks and boots; gold piping stays a single broad band.
if HERO=='titan':
 for o in meshes:
  role='blue' if o.name.startswith(('Sock.','Boot.','WristTape.','ShortsStripe.')) else 'cream' if o.name.startswith(('Sole.','SockBand.')) else o['role']
  if role!=o['role']:
   o['role']=role
   for n in range(3):o.data.materials[n]=MATS[(role,n)]
# Camera contract: all atlas pixels and foot anchor share this projection.
camdata=bpy.data.cameras.new('GameCamera');cam=bpy.data.objects.new('GameCamera',camdata);scene.collection.objects.link(cam);scene.camera=cam
pitch=math.radians(36);yaw=math.radians(45)
direction=Vector((math.cos(pitch)*math.sin(yaw),math.sin(pitch),math.cos(pitch)*math.cos(yaw)))
target=Vector((0,1.15,0));cam.location=bv(target+direction*15)
cam.rotation_euler=(bv(target)-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO';camdata.ortho_scale=4.0
scene.render.resolution_x=scene.render.resolution_y=96
# Export from actual Blender meshes, maintaining named rigid pivots for the phase editor.
export_meshes=[]
for o in meshes:
 data=o.data;data.calc_loop_triangles();vertices=[];colors=[];tones=[]
 for tri in data.loop_triangles:
  tone=data.polygons[tri.polygon_index].material_index
  for idx in tri.vertices:
   vertices.extend(round(float(v),6) for v in B.transposed()@data.vertices[idx].co)
   tones.append(tone)
 export_meshes.append({'name':o.name,'parent':o.parent.name,'role':o['role'],'positions':vertices,'tones':tones})
master={'version':3,'id':f'{HERO}-master-v3','units':'metres','up':'Y','forward':'+Z','palette':PALETTE,'nodes':node_specs,'meshes':export_meshes,'footTip':FOOT,'hipsY':HIPS,'camera':{'pitch':36,'yaw':45,'orthoScale':4,'frameSize':96},'source':f'art/source/{HERO}/{HERO}-master.blend'}
(ROOT/f'src/engine/assets/{HERO}-master.json').write_text(json.dumps(master,separators=(',',':'))+'\n')
(ROOT/f'art/specs/{HERO}-camera-palette.json').write_text(json.dumps({k:master[k] for k in ['version','units','up','forward','palette','camera','footTip','hipsY']},indent=2)+'\n')
clips=json.loads((ROOT/f'art/specs/{HERO}-clips.json').read_text())
def rotate(name,xyz):
 # Three Euler XYZ matrix is Rx @ Ry @ Rz (Blender Euler conventions differ).
 rx,ry,rz=xyz
 r=Matrix.Rotation(rx,3,'X')@Matrix.Rotation(ry,3,'Y')@Matrix.Rotation(rz,3,'Z')
 nodes[name].rotation_euler=(B@r@B.transposed()).to_euler()
def pose(p):
 nodes['hips'].location=bv([0,HIPS+p['y'],0])
 sq=p['squash'];nodes['rig'].scale=(math.sqrt(2-sq),math.sqrt(2-sq),sq)
 rotate('body',[p['lean'],p['twist'],0]);rotate('head',[p['head'],0,0])
 if 'secondary' in nodes:rotate('secondary',[p.get('secondary',0),0,0])
 for side,s in [('L',1),('R',-1)]:
  rotate('hip.'+side,[-p['hip'+side],0,0]);rotate('knee.'+side,[p['knee'+side],0,0]);rotate('ankle.'+side,[p.get('ankle'+side,0),0,0])
  rotate('sh.'+side,[-p['sh'+side],0,p['sh'+side+'z']*s]);rotate('el.'+side,[-p['el'+side],0,0])
# Keep source pose clips as real keyframes with named markers, no opaque procedural-only source.
f=1;scene.timeline_markers.clear()
for action,clip in clips.items():
 scene.timeline_markers.new(action,frame=f)
 for fr in clip['frames']:
  pose(fr['pose'])
  for name,o in nodes.items():
   o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f);o.keyframe_insert('scale',frame=f)
  f+=round(fr['duration']/10)
scene.frame_end=f;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'art/source/{HERO}/{HERO}-master.blend'))
# Portable 3D reference. Runtime uses rigid-part JSON to preserve the existing pose system.
bpy.ops.object.select_all(action='DESELECT')
for o in [*nodes.values(),*meshes]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/assets/heroes/{HERO}/{HERO}-preview.glb'),use_selection=True,export_animations=False)
if RENDER or BAKE:
 for o in nodes.values():o.animation_data_clear()
 pose(clips['idle']['frames'][0]['pose']);scene.render.resolution_x=scene.render.resolution_y=768
 camdata.ortho_scale=3.05
 scene.render.filepath=str(OUT/f'qa/{HERO}-master-front.png');bpy.ops.render.render(write_still=True)
 scene.render.resolution_x=scene.render.resolution_y=96;camdata.ortho_scale=4
if BAKE:
 from bpy_extras.object_utils import world_to_camera_view
 frames=[];outdir=OUT/f'renders/{HERO}-v2';outdir.mkdir(parents=True,exist_ok=True)
 # Foot anchor is projected from the ground origin, shared across all frames.
 anchor=world_to_camera_view(scene,cam,Vector((0,0,0)))
 pivot=[round(anchor.x*96),round((1-anchor.y)*96)]
 for facing in range(8):
  nodes['rig'].rotation_euler[2]=facing*math.pi/4
  for action,clip in clips.items():
   for i,fr in enumerate(clip['frames']):
    pose(fr['pose']);bpy.context.view_layer.update()
    name=f'{action}_{facing}_{i:02d}'
    scene.render.filepath=str(outdir/(name+'.png'));bpy.ops.render.render(write_still=True)
    socket=nodes['boot.R'].matrix_world.translation
    boot=world_to_camera_view(scene,cam,socket)
    frames.append({'name':name,'action':action,'facing':facing,'index':i,'duration':fr['duration'],'event':fr.get('event'),'pivot':pivot,'bootPixel':[round(boot.x*96),round((1-boot.y)*96)],'bootWorld':[round(v,6) for v in B.transposed()@socket]})
 (outdir/'frames.json').write_text(json.dumps({'camera':master['camera'],'pivot':pivot,'frames':frames},indent=2)+'\n')
print(HERO.upper()+' MASTER EXPORTED',len(meshes),'meshes',sum(len(x['positions'])//9 for x in export_meshes),'triangles')
