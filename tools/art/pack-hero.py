"""Pack six authored masters with a repeatable, editable pixel finish.
Base colours and corrections stay on separate Aseprite layers. No diffusion/dither.
"""
from pathlib import Path
import json, math, hashlib, os, argparse
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
BUILD=Path(os.environ.get('GHOST_ART_BUILD','/Users/thohong/Library/Developer/CodexBuilds/ghost-ball-art')).resolve()
parser=argparse.ArgumentParser();parser.add_argument('--hero',choices=['nova','bolt','titan','jinx','echo','kaiz'],default='nova');HERO=parser.parse_args().hero
RAW=BUILD/f'renders/{HERO}-v2';DEST=ROOT/f'public/assets/heroes/{HERO}';DEST.mkdir(parents=True,exist_ok=True)
spec=json.loads((RAW/'frames.json').read_text());master=json.loads((ROOT/f'src/engine/assets/{HERO}-master.json').read_text())
clips=json.loads((ROOT/f'art/specs/{HERO}-clips.json').read_text())
palette=list(dict.fromkeys(h for row in master['palette'].values() for h in row));ink='#101725'
if ink not in palette:palette.append(ink)
colors=[tuple(bytes.fromhex(h[1:])) for h in palette];inkrgba=(*bytes.fromhex(ink[1:]),255)
cell=96;pad=2;stride=100;lookup={};cleaned=[];bases=[];corrections=[];bounds=[];pages=[];page_images=[];base_pages=[];stats={'outlinePixels':0,'clusterPixels':0,'authoredPixels':0}
# Only opaque shade specks are merged. Preserve ink, eyes, highlights and silhouette.
shade_colors={tuple(bytes.fromhex(row[0][1:])) for role,row in master['palette'].items() if role not in ['ink','hair']}
patchfile=ROOT/f'art/specs/{HERO}-pixel-patches.json';patches=json.loads(patchfile.read_text()) if patchfile.exists() else {}
for n,fr in enumerate(spec['frames']):
 im=Image.open(RAW/(fr['name']+'.png')).convert('RGBA');assert im.size==(cell,cell)
 data=[]
 for r,g,b,a in im.get_flattened_data():
  if a<128:data.append((0,0,0,0));continue
  c=min(colors,key=lambda c:(c[0]-r)**2+(c[1]-g)**2+(c[2]-b)**2);data.append((*c,255))
 im.putdata(data);base=im.copy();overlay=Image.new('RGBA',im.size);px=base.load();dst=im.load();op=overlay.load()
 for y in range(1,95):
  for x in range(1,95):
   c=px[x,y];neighbours=[px[x-1,y],px[x+1,y],px[x,y-1],px[x,y+1]]
   if c[3]==0 and any(v[3] for v in neighbours):dst[x,y]=op[x,y]=inkrgba;stats['outlinePixels']+=1
   elif c[3] and c[:3] in shade_colors and all(v[3] for v in neighbours) and c not in neighbours:
    winner=max(set(neighbours),key=neighbours.count)
    if neighbours.count(winner)>=3:dst[x,y]=op[x,y]=winner;stats['clusterPixels']+=1
 for x,y,color in patches.get(fr['name'],[]):
  assert color in palette and 0<x<95 and 0<y<95
  dst[x,y]=op[x,y]=(*bytes.fromhex(color[1:]),255);stats['authoredPixels']+=1
 bound=im.getbbox();assert bound and min(bound)>0 and bound[2]<96 and bound[3]<96,fr['name']+' clips cell';bounds.append(bound)
 # At most 400 frames in a 2048² page; final 80 use 1024². No page exceeds 2048.
 page=n//400;local=n%400
 if page==len(page_images):
  remaining=len(spec['frames'])-n;cols=20 if remaining>100 else 10;side=2048 if remaining>100 else 1024
  page_images.append(Image.new('RGBA',(side,side)));base_pages.append(Image.new('RGBA',(side,side)));pages.append({'file':f'{HERO}-atlas'+('' if page==0 else f'-{page+1}')+'.png','size':[side,side],'columns':cols})
 x=(local%pages[page]['columns'])*stride+pad;y=(local//pages[page]['columns'])*stride+pad
 page_images[page].paste(im,(x,y));base_pages[page].paste(base,(x,y));cleaned.append(im);bases.append(base);corrections.append(overlay)
 lookup[fr['name']]={**fr,'page':page,'rect':[x,y,cell,cell],'sourceSize':[cell,cell]}
for meta,im,base in zip(pages,page_images,base_pages):
 meta['baseFile']=meta['file'].replace('-atlas','-base-atlas');base.save(DEST/meta['baseFile'],optimize=True)
 im.save(DEST/meta['file'],optimize=True);meta['sha256']=hashlib.sha256((DEST/meta['file']).read_bytes()).hexdigest()
manifest={'version':2,'id':f'{HERO}-v2','status':'finished-review','camera':spec['camera'],'pivot':spec['pivot'],'atlas':pages[0]['file'],'atlasSize':pages[0]['size'],'pages':pages,'pixelsPerUnit':24,'directions':8,'palette':palette,'frames':lookup,'loops':[k for k,c in clips.items() if c['loop']],'finish':stats,'notes':'Authored Blender geometry and poses; hard palette, one-pixel contour and selective cluster finishing on an editable correction layer. Live 3D remains the gameplay route.'}
manifest['sha256']=pages[0]['sha256'];(DEST/f'{HERO}-atlas.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
review=Image.new('RGB',(8*192,len(clips)*212),'#eeece5');d=ImageDraw.Draw(review)
for row,action in enumerate(clips):
 index=2 if action in ['run','pass','dash'] else 1 if action in ['catch','attack','defense'] else 0
 for facing in range(8):
  fr=lookup[f'{action}_{facing}_{index:02d}'];x,y,w,h=fr['rect'];im=page_images[fr['page']].crop((x,y,x+w,y+h)).resize((192,192),Image.Resampling.NEAREST)
  review.paste(im,(facing*192,row*212),im);d.text((facing*192+10,row*212+192),f'{action} / {facing*45} deg',fill='#182338')
review.save(BUILD/f'qa/{HERO}-contact-sheet.png')
# 60 source frames per facing; columns reflect the manifest, never assumed by a consumer.
per_facing=len(cleaned)//8
for suffix,images in [('import',bases),('corrections',corrections),('finished',cleaned)]:
 source=Image.new('RGBA',(per_facing*96,8*96))
 for n,im in enumerate(images):source.paste(im,((n%per_facing)*96,(n//per_facing)*96))
 source.save(BUILD/f'renders/{HERO}-{suffix}.png')
(BUILD/f'renders/{HERO}-tags.json').write_text(json.dumps([{'name':k,'durations':[f['duration'] for f in v['frames']]} for k,v in clips.items()]))
print(json.dumps({'hero':HERO,'frames':len(lookup),'palette':len(palette),'pages':[p['size'] for p in pages],'finish':stats,'maxBounds':[max(b[2]-b[0] for b in bounds),max(b[3]-b[1] for b in bounds)]}))
