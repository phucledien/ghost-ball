#!/usr/bin/env python3
"""Read-only source/commit/place/WAV verification; no Roblox runtime claims."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import wave
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[2]
BASE = Path.home() / 'Library/Developer/CodexBuilds/ghost-ball/roblox'


def digest(data):
 return hashlib.sha256(data).hexdigest()


def verify():
 assert BASE.resolve() == BASE, 'Build root must be real local Developer storage'
 manifest = json.loads((BASE / 'build/manifest.json').read_text())
 revision = manifest['sourceRevision']
 assert revision == subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip()
 assert manifest['runtimeVerified'] is False and manifest['place'] == 'LOCAL ONLY'
 for path, expected in manifest['sourceFiles'].items():
  assert path.startswith('roblox/')
  assert digest((REPO / path).read_bytes()) == expected, path
  blob = subprocess.check_output(['git', 'show', revision + ':' + path], cwd=REPO)
  assert digest(blob) == expected, 'Uncommitted source: ' + path
 print('PASS', len(manifest['sourceFiles']), 'source hashes equal HEAD and current files', revision)
 for name, spec in manifest['outputs'].items():
  path = Path(spec['path'])
  assert path.resolve() == path and path.is_relative_to(BASE)
  data = path.read_bytes()
  assert digest(data) == spec['sha256'] and len(data) == spec['bytes']
  sources = []
  classes = []
  for item in ET.fromstring(data).iter('Item'):
   classes.append(item.attrib['class'])
   source = item.find("./Properties/*[@name='Source']")
   if source is not None:
    matches = [p for p, h in manifest['sourceFiles'].items() if digest((source.text or '').encode()) == h]
    assert len(matches) == 1, matches
    sources.append(matches[0])
  assert len(sources) == len(set(sources)), 'Duplicate embedded scripts'
  if name == 'GhostBall':
   expected = {p for p in manifest['sourceFiles'] if p.startswith('roblox/src/') and p.endswith('.luau')}
   assert classes.count('RemoteEvent') == 3 and classes.count('LocalScript') == 1
  else:
   expected = {p for p in manifest['sourceFiles'] if p.startswith('roblox/src/shared/') and p.endswith('.luau')}
   expected.update('roblox/' + p for p in ['src/server/InputGateway.luau', 'src/client/Prediction.luau',
    'src/client/InputController.luau', 'src/client/CameraController.luau', 'src/client/HUD.luau', 'tests/Studio.server.luau',
    'tests/HUDLayout.luau', 'tests/Suite.luau', 'tests/Regressions.luau', 'tests/InputHandlers.luau', 'tests/CameraAdapter.luau'])
   assert not any(c in ('RemoteEvent', 'LocalScript') for c in classes)
  assert set(sources) == expected, (name, set(sources) ^ expected)
  print('PASS XML', name, len(sources), 'exact Source blobs', spec['bytes'], 'bytes', spec['sha256'])
 audio = json.loads((BASE / 'exports/audio/manifest.json').read_text())
 for field, path in [('sourceSha256', 'src/engine/audio.js'), ('exporterSha256', 'roblox/tools/manage.py'),
  ('recipeExtractorSha256', 'roblox/tools/recipes.mjs')]:
  assert digest((REPO / path).read_bytes()) == audio[field]
 assert len(audio['cues']) == 6
 for name, cue in audio['cues'].items():
  path = Path(cue['path'])
  assert path.resolve() == path and path.is_relative_to(BASE)
  assert digest(path.read_bytes()) == cue['sha256']
  with wave.open(str(path)) as wav:
   assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, 48000)
   assert wav.getnframes() > 0
  assert cue['assetId'] is None and cue['audibleRuntimeTest'] == 'PENDING'
 print('PASS six WAV hashes/format and source recipes; actual loading/audio PENDING')


if __name__ == '__main__':
 verify()
