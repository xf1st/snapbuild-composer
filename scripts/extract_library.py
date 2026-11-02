"""Split the authorized Figma SVG export without modifying path geometry.

Usage: python scripts/extract_library.py path/to/export.svg
Optional development dependency: pip install svgpathtools
The original is retained under assets-private (not tracked).
"""
from pathlib import Path
import copy
import hashlib
import json
import sys
import xml.etree.ElementTree as ET

from svgpathtools import parse_path

ROOT = Path(__file__).resolve().parents[1]
NS = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', NS[1:-1])
NAMES = {'Книга': 'book', 'Телефон': 'phone', 'Наушники': 'headphones',
         'Лампа': 'lamp', 'Кошелек': 'wallet', 'Ручка': 'pen',
         'Папка': 'folder', 'Монета': 'coin', 'Пазлы': 'puzzle'}


def decode_label(value):
    try:
        return value.encode('latin1').decode('utf8')
    except (UnicodeError, ValueError):
        return value


def main(source):
    original = Path(source).read_bytes()
    root = ET.fromstring(original)
    section = next(c for c in root if decode_label(c.get('id', '')) == 'Размер L')
    defs = root.find(NS + 'defs')
    private = ROOT / 'assets-private'
    private.mkdir(exist_ok=True)
    (private / 'figma-library-L.svg').write_bytes(original)
    target = ROOT / 'public/library'
    target.mkdir(exist_ok=True)
    old_manifest = json.loads((ROOT / 'public/library.json').read_text(encoding='utf8'))
    old_tags = {entry['name'].split(' · ')[0]: entry.get('tags', []) for entry in old_manifest}
    manifest, provenance = [], []
    for group in section:
        label = decode_label(group.get('id', ''))
        base = label.removesuffix('_2')
        plant = label in ('Group 2136136344', 'Group 2136136347')
        if group.tag != NS + 'g' or (base not in NAMES and not plant):
            continue
        mono = label.endswith('_2') or label == 'Group 2136136347'
        name = 'Растение' if plant else base
        stem = 'plant' if plant else NAMES[base]
        filename = stem + ('-mono.svg' if mono else '-color.svg')
        bounds = []
        for node in group.iter():
            if node.get('transform'):
                raise ValueError('Unexpected transform; handle it before cropping: ' + label)
            if node.tag == NS + 'path' and node.get('d'):
                bounds.append(parse_path(node.get('d')).bbox())
        if not bounds:
            raise ValueError('No path geometry: ' + label)
        x0 = min(b[0] for b in bounds) - 2
        y0 = min(b[2] for b in bounds) - 2
        x1 = max(b[1] for b in bounds) + 2
        y1 = max(b[3] for b in bounds) + 2
        svg = ET.Element(NS + 'svg', {'viewBox': f'{x0:.4f} {y0:.4f} {x1-x0:.4f} {y1-y0:.4f}', 'fill': 'none'})
        svg.append(copy.deepcopy(group))
        if defs is not None:
            svg.append(copy.deepcopy(defs))
        ET.ElementTree(svg).write(target / filename, encoding='utf8', xml_declaration=False)
        manifest.append({'name': name + (' · моно' if mono else ''), 'file': '/library/' + filename, 'tags': old_tags.get(name, [])})
        provenance.append({'file': filename, 'sourceGroupId': group.get('id'), 'sourceSha256': hashlib.sha256(original).hexdigest(), 'pathCount': len(bounds), 'viewBox': svg.get('viewBox')})
    if len(manifest) != 20:
        raise ValueError('Expected20illustration groups, found ' + str(len(manifest)))
    (ROOT / 'public/library.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    (private / 'provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf8')
    print('Extracted20original SVG groups; path data unchanged.')


if __name__ == '__main__':
    main(sys.argv[1])
