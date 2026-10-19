#!/usr/bin/env python3
"""Local-only reproducible Roblox tooling; never uploads or publishes anything."""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import random
import struct
import subprocess
import sys
import urllib.request
import wave
import zipfile
import xml.etree.ElementTree as ET

SOURCE = Path(__file__).resolve().parents[1]
REPO = SOURCE.parent
DEVELOPER = Path.home() / 'Library/Developer'
BASE = DEVELOPER / 'CodexBuilds/ghost-ball/roblox'
TOOLS = {
 'rojo': {'version':'7.7.1','url':'https://github.com/rojo-rbx/rojo/releases/download/v7.7.1/rojo-7.7.1-macos-aarch64.zip',
          'sha256':'a702659940f6ca061a62df34aa0002ff024aa264efb859007ba890e9524753a4','files':['rojo']},
 'luau': {'version':'0.743','url':'https://github.com/luau-lang/luau/releases/download/0.743/luau-macos.zip',
          'sha256':'4334afbfb0c05ee697c9bfea64a85f950249c1e8f6f7d99aaa5a24ee362b09c3','files':['luau','luau-analyze','luau-compile']},
}

def sha(path):
 return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def output(relative):
 # Refuse symlinks through Developer itself, the root or any output ancestor.
 # This deliberately permits only this real local Mac Developer subtree.
 path = BASE / relative
 if DEVELOPER.resolve() != DEVELOPER or BASE.resolve() != BASE or path.resolve() != path:
  raise RuntimeError(f'Output contains symlink: {path} -> {path.resolve()}')
 if any(x in path.parts for x in ('Documents','Desktop','Mobile Documents','CloudStorage','iCloud Drive')):
  raise RuntimeError(f'Synced output forbidden: {path}')
 path.resolve().relative_to(DEVELOPER)
 path.parent.mkdir(parents=True, exist_ok=True)
 return path

def run(args, log=None):
 result = subprocess.run([str(x) for x in args], cwd=REPO, capture_output=True, text=True)
 text = '$ ' + ' '.join(map(str,args)) + '\n' + result.stdout + result.stderr + f'\nexit={result.returncode}\n'
 print(text, end='')
 if log is not None:
  with log.open('a') as handle: handle.write(text)
 if result.returncode: raise RuntimeError(f'Command failed ({result.returncode}): {args[0]}')
 return result.stdout

def revision():
 return subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()

def setup():
 if platform.system() != 'Darwin' or platform.machine() != 'arm64':
  raise RuntimeError('Pinned bootstrap targets Apple Silicon macOS; supply verified matching tools for another host.')
 for name,spec in TOOLS.items():
  archive=output(f'tools/{name}.zip')
  if not archive.exists() or sha(archive)!=spec['sha256']:
   urllib.request.urlretrieve(spec['url'],archive)
  if sha(archive)!=spec['sha256']: raise RuntimeError(f'{name} download checksum mismatch')
  with zipfile.ZipFile(archive) as z:
   for member in spec['files']:
    binary=output('tools/'+member); binary.write_bytes(z.read(member)); binary.chmod(0o755)
  print(name,spec['version'],archive,sha(archive))
 print('Checksums pin retrieved publisher artifacts; they are not an independent publisher signature.')

def inspect_place(path, test_place=False):
 tree=ET.parse(path).getroot()
 instances={}
 def walk(item,parent=''):
  prop=item.find("./Properties/string[@name='Name']")
  name=prop.text if prop is not None else item.attrib['class']
  current=parent+'/'+name
  instances[current]=item.attrib['class']
  for child in item.findall('Item'): walk(child,current)
 for item in tree.findall('Item'): walk(item)
 if test_place:
  assert instances['/ServerScriptService/RulesTests']=='Script'
  assert instances['/ServerStorage/GhostBallTests/Suite']=='ModuleScript'
  assert not any(c in ('RemoteEvent','LocalScript') for c in instances.values())
 else:
  assert instances['/ServerScriptService/GhostBall/Main']=='Script'
  assert instances['/StarterPlayer/StarterPlayerScripts/GhostBall/Main']=='LocalScript'
  for remote in ('Input','Snapshot','Event'):
   assert instances['/ReplicatedStorage/GhostBall/'+remote]=='RemoteEvent'
  assert not any('Tests' in p or '/Suite' in p for p in instances)
 print('XML service/remote/test isolation PASS:',path.name,len(instances),'instances')

def build():
 rojo=output('tools/rojo')
 if not rojo.exists(): raise RuntimeError('Run setup first')
 if run([rojo,'--version']).strip()!='Rojo 7.7.1': raise RuntimeError('Rojo version mismatch')
 outputs={}
 for project,name in [('default.project.json','GhostBall'),('test.project.json','GhostBallTests')]:
  dest=output('build/'+name+'.rbxlx')
  run([rojo,'build',SOURCE/project,'-o',dest])
  inspect_place(dest,name=='GhostBallTests')
  outputs[name]={'path':str(dest),'sha256':sha(dest),'bytes':dest.stat().st_size}
 manifest={'sourceRevision':revision(),'sourceDirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=REPO,text=True).strip()),
  'utc':dt.datetime.now(dt.timezone.utc).isoformat(),'tools':TOOLS,'rulesVersion':1,'protocolVersion':1,
  'place':'LOCAL ONLY','runtimeVerified':False,'outputs':outputs,
  'sourceFiles':{str(p.relative_to(REPO)):sha(p) for p in sorted(SOURCE.rglob('*')) if p.is_file() and '.git' not in p.parts}}
 dest=output('build/manifest.json');dest.write_text(json.dumps(manifest,indent=2)+'\n');print(dest)

def check():
 stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 log=output(f'qa/{revision()[:12]}-{stamp}/checks.log')
 analyze=output('tools/luau-analyze'); compile_=output('tools/luau-compile'); luau=output('tools/luau')
 # The CLI lacks Roblox engine definitions: type-check pure modules and compile every engine module.
 pure=list(sorted((SOURCE/'src/shared').glob('*.luau')))
 run([analyze,*pure,SOURCE/'src/server/InputGateway.luau',SOURCE/'tests/Run.luau',SOURCE/'tests/Suite.luau',SOURCE/'tests/Regressions.luau',SOURCE/'tests/InputHandlers.luau',SOURCE/'tests/CameraAdapter.luau',SOURCE/'tests/HUDLayout.luau',SOURCE/'src/client/Prediction.luau'],log)
 for file in sorted(SOURCE.rglob('*.luau')): run([compile_,'--null',file],log)
 run([luau,SOURCE/'tests/Run.luau'],log)
 run([luau,SOURCE/'tests/RunInput.luau'],log)
 print('Evidence:',log)

# RBJ cookbook biquad, implementing the original WebAudio recipe's filter family.
# The output is a deterministic offline re-render, not bit-identical browser DSP.
def biquad(data,kind,f0,f1,q,duration):
 x1=x2=y1=y2=0.0
 for i,x in enumerate(data):
  f=f0*((f1/f0)**min(1,i/48000/duration)) if f1 else f0
  w=2*math.pi*f/48000; c=math.cos(w); a=math.sin(w)/(2*q)
  if kind=='lowpass': b0=(1-c)/2; b1=1-c; b2=b0
  elif kind=='highpass': b0=(1+c)/2; b1=-(1+c); b2=b0
  else: b0=a; b1=0; b2=-a
  a0=1+a; a1=-2*c; a2=1-a
  y=(b0*x+b1*x1+b2*x2-a1*y1-a2*y2)/a0
  data[i]=y; x2=x1; x1=x; y2=y1; y1=y
 return data

def audio():
 recipes=json.loads(subprocess.check_output(['node',str(SOURCE/'tools/recipes.mjs')],cwd=REPO,text=True))
 source=REPO/'src/engine/audio.js'
 manifest={'sampleRate':48000,'channels':1,'format':'PCM16 WAV','source':'src/engine/audio.js','sourceSha256':sha(source),
  'exporterSha256':sha(__file__),'recipeExtractorSha256':sha(SOURCE/'tools/recipes.mjs'),
  'method':'Original browser cue recipes; deterministic numerical oscillator/noise/biquad rendering; peak normalized to -1 dBFS; not browser-bit-identical',
  'rights':'Owner must confirm before upload','creator':None,'universe':None,'cues':{}}
 for name,cue in recipes.items():
  recipe=cue['recipe']; duration=max(p.get('at',0)+p['dur']+0.04 for p in recipe)
  mixed=[0.0]*math.ceil(duration*48000)
  rng=random.Random(417)
  for p in recipe:
   length=math.ceil((p['dur']+0.02)*48000); offset=round(p.get('at',0)*48000)
   raw=[]; phase=0.0; dur=p['dur']; vol=p.get('vol',0.5)
   for i in range(length):
    t=i/48000
    if p['kind']=='noise': value=rng.uniform(-1,1)
    else:
     f=p.get('f0',440)*((p['f1']/p.get('f0',440))**min(t/dur,1)) if p.get('f1') else p.get('f0',440)
     phase+=f/48000; cycle=phase%1
     value=(1 if cycle<0.5 else -1) if p.get('type')=='square' else (1-4*abs(cycle-0.5))
    raw.append(value)
   if p['kind']=='noise': raw=biquad(raw,p.get('filter','bandpass'),p.get('f0',1200),p.get('f1'),p.get('q',1),dur)
   for i,value in enumerate(raw):
    t=i/48000
    if p['kind']=='tone':
     attack=p.get('attack',0.004)
     gain=0.0001*((vol/0.0001)**(t/attack)) if t<attack else vol*((0.0001/vol)**min(1,(t-attack)/(dur-attack)))
    else: gain=vol*((0.0001/vol)**min(1,t/dur))
    if offset+i<len(mixed): mixed[offset+i]+=value*gain
  # Trim negligible trailing samples then leave a short quiet release tail.
  while len(mixed)>480 and abs(mixed[-1])<1e-5: mixed.pop()
  mixed.extend([0.0]*480)
  peak=max(map(abs,mixed)); gain=(10**(-1/20))/max(peak,1e-9)
  samples=[max(-32767,min(32767,round(x*gain*32767))) for x in mixed]
  path=output('exports/audio/'+name+'.wav')
  with wave.open(str(path),'wb') as w:
   w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000); w.writeframes(struct.pack('<'+'h'*len(samples),*samples))
  manifest['cues'][name]={'sourceCue':cue['sourceCue'],'path':str(path),'sha256':sha(path),
   'duration':len(samples)/48000,'peakDbFS':-1,'assetId':None,'moderation':'NOT UPLOADED','experienceGrant':'UNASSIGNED','audibleRuntimeTest':'PENDING'}
 path=output('exports/audio/manifest.json');path.write_text(json.dumps(manifest,indent=2)+'\n');print(path)

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['setup','build','check','audio'])
 try: globals()[parser.parse_args().command]()
 except (RuntimeError,OSError,subprocess.CalledProcessError,ValueError) as exc:
  print('ERROR:',exc,file=sys.stderr);sys.exit(1)
