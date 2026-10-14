"""Verify editable Aseprite sources against every published sprite frame.

Exports and reports stay in the real local Developer build directory. Requires
Pillow and Aseprite; does not modify source art or runtime assets.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
HEROES = ['nova', 'bolt', 'titan', 'jinx', 'echo', 'kaiz']
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--hero', choices=HEROES)
parser.add_argument('--aseprite', default='/Applications/Aseprite.app/Contents/MacOS/aseprite')
args = parser.parse_args()
build = Path(os.environ.get('GHOST_ART_BUILD', '/Users/thohong/Library/Developer/CodexBuilds/ghost-ball-art')).resolve()
developer = (Path.home() / 'Library/Developer').resolve()
assert build.is_relative_to(developer), 'Verification exports must stay under the real local Library/Developer directory'
out = build / 'qa/asset-source-verification'
out.mkdir(parents=True, exist_ok=True)


def same_pixels(a, b):
    return a.size == b.size and a.tobytes() == b.tobytes()


results = []
for hero in [args.hero] if args.hero else HEROES:
    dest = ROOT / f'public/assets/heroes/{hero}'
    manifest = json.loads((dest / f'{hero}-atlas.json').read_text())
    clips = json.loads((ROOT / f'art/specs/{hero}-clips.json').read_text())
    frames = list(manifest['frames'].items())
    assert len(frames) == 480, (hero, 'frame count')
    assert len(clips) == 10, (hero, 'clip count')
    palette = {tuple(bytes.fromhex(c[1:])) for c in manifest['palette']}
    pages = []
    masks = []
    for index, page in enumerate(manifest['pages']):
        path = dest / page['file']
        im = Image.open(path).convert('RGBA')
        assert im.size == tuple(page['size']), (hero, index, 'page dimensions')
        assert im.size == ((2048, 2048) if index == 0 else (1024, 1024)), (hero, index, 'unexpected page size')
        assert hashlib.sha256(path.read_bytes()).hexdigest() == page['sha256'], (hero, index, 'page checksum')
        base_im = Image.open(dest / page['baseFile']).convert('RGBA')
        assert base_im.size == im.size, (hero, index, 'base page dimensions')
        for variant, image in [('finished', im), ('base', base_im)]:
            for rgba in set(image.get_flattened_data()):
                assert rgba[3] in (0, 255), (hero, index, variant, 'partial alpha')
                if rgba[3]:
                    assert rgba[:3] in palette, (hero, index, variant, 'outside declared palette', rgba)
        assert ImageChops.subtract(base_im.getchannel('A'), im.getchannel('A')).getbbox() is None, (hero, index, 'base alpha exceeds finished silhouette')
        pages.append(im)
        masks.append(Image.new('L', im.size))
    assert len(pages) == 2, (hero, 'page count')

    sheet_path = out / f'{hero}-export.png'
    data_path = out / f'{hero}-export.json'
    subprocess.run([
        args.aseprite, '--batch', '--list-tags', '--list-layers', '--list-slices',
        str(ROOT / f'art/source/{hero}/{hero}-cleanup.aseprite'),
        '--sheet-type', 'rows', '--sheet-columns', '60', '--sheet', str(sheet_path),
        '--format', 'json-array', '--data', str(data_path),
    ], check=True, capture_output=True, text=True)
    source = Image.open(sheet_path).convert('RGBA')
    metadata = json.loads(data_path.read_text())
    assert len(metadata['frames']) == 480, (hero, 'source frame count')
    tags = metadata['meta']['frameTags']
    assert len(tags) == 80, (hero, 'source tags')
    assert len(metadata['meta']['layers']) == 2, (hero, 'editable layers')
    slice_keys = metadata['meta']['slices'][0]['keys']
    assert slice_keys[0]['pivot'] == {'x': 48, 'y': 70}, (hero, 'source pivot')
    expected_tags = []
    position = 0
    for facing in range(8):
        for action, clip in clips.items():
            count = len(clip['frames'])
            expected_tags.append((f'{action}_{facing}', position, position + count - 1))
            position += count
    assert [(t['name'], t['from'], t['to']) for t in tags] == expected_tags, (hero, 'tag ranges/order')

    margin = 96
    for (name, frame), exported in zip(frames, metadata['frames']):
        assert exported['duration'] == frame['duration'], (hero, name, 'source duration')
        assert frame['duration'] == clips[frame['action']]['frames'][frame['index']]['duration'], (hero, name, 'clip duration')
        x, y, w, h = frame['rect']
        assert (w, h) == (96, 96), (hero, name, 'cell size')
        page = frame['page']
        assert 2 <= x and 2 <= y and x + w + 2 <= pages[page].width and y + h + 2 <= pages[page].height
        packed = pages[page].crop((x, y, x + w, y + h))
        bounds = packed.getbbox()
        assert bounds is not None
        margin = min(margin, bounds[0], bounds[1], 96 - bounds[2], 96 - bounds[3])
        assert margin > 0, (hero, name, 'cell clipping')
        padded = pages[page].crop((x - 2, y - 2, x + w + 2, y + h + 2)).getchannel('A')
        ImageDraw.Draw(padded).rectangle((2, 2, 97, 97), fill=0)
        assert padded.getbbox() is None, (hero, name, 'nontransparent two-pixel padding')
        ImageDraw.Draw(masks[page]).rectangle((x, y, x + w - 1, y + h - 1), fill=255)
        r = exported['frame']
        composite = source.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        assert same_pixels(composite, packed), (hero, name, 'Aseprite composite differs from runtime')
    for page, mask in zip(pages, masks):
        assert ImageChops.multiply(page.getchannel('A'), ImageChops.invert(mask)).getbbox() is None, (hero, 'opaque pixels outside frame cells')
    finished = Image.open(build / f'renders/{hero}-finished.png').convert('RGBA')
    assert same_pixels(source, finished), (hero, 'Aseprite export differs from finished source sheet')
    result = {'hero': hero, 'frames': len(frames), 'tags': len(tags), 'editableLayers': 2,
              'exactCompositeMatch': True, 'durationsMatch': True, 'paletteAlphaPaddingValid': True,
              'pageSizes': [list(p.size) for p in pages], 'minimumCellMargin': margin}
    results.append(result)
    print(json.dumps(result))

(out / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
