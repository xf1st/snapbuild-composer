import DOMPurify from 'dompurify';
import type { Asset, Scene, Project } from './model';
const NS = 'http://www.w3.org/2000/svg';
const forbidden = ['script','foreignObject','image','iframe','audio','video','animate','animateTransform','set'];
function parse(svg: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('Файл не является корректным SVG.');
  return doc.documentElement as unknown as SVGSVGElement;
}
export function cleanSvg(raw: string): string {
  if (raw.length > 3_000_000) throw new Error('Один SVG должен быть меньше 3 МБ.');
  const original = parse(raw);
  if (original.querySelector('image,foreignObject')) throw new Error('Нужен векторный SVG без растровых картинок и HTML.');
  if (original.querySelector('style')) throw new Error('SVG со встроенным CSS не поддерживается. Экспортируйте его с цветами в атрибутах или inline-стилях.');
  const fragment = DOMPurify.sanitize(raw, { RETURN_DOM_FRAGMENT: true, USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['use'], ADD_ATTR: ['href','xlink:href'], FORBID_TAGS: [...forbidden, 'style'], FORBID_ATTR: ['class'] });
  const clean = new XMLSerializer().serializeToString(fragment);
  const root = parse(clean);
  for (const el of [root, ...root.querySelectorAll('*')]) for (const attr of Array.from(el.attributes)) {
    const v = attr.value;
    const externalUrl=Array.from(v.matchAll(/url\(([^)]*)\)/gi)).some(m=>!m[1].trim().replace(/^['"]|['"]$/g,'').startsWith('#'));
    if (/^on/i.test(attr.name) || (/(?:^|:)href$/i.test(attr.name) && !v.startsWith('#')) || externalUrl || /(?:https?:|data:|javascript:|@import)/i.test(v)) el.removeAttribute(attr.name);
  }
  if (!root.querySelector('path,rect,circle,ellipse,polygon,polyline,line,text,use')) throw new Error('В SVG не найдены векторные элементы.');
  let vb = root.getAttribute('viewBox');
  if (!vb) { const w = Number.parseFloat(root.getAttribute('width') || ''), h = Number.parseFloat(root.getAttribute('height') || ''); if (!(w > 0 && h > 0)) throw new Error('В SVG нужны viewBox или размеры.'); vb = `0 0 ${w} ${h}`; }
  const box = vb.trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || box.some(v => !Number.isFinite(v)) || box[2] <= 0 || box[3] <= 0 || !Number.isFinite(box[2]/box[3]) || box[2]/box[3]<.0001 || box[2]/box[3]>10000) throw new Error('Некорректный viewBox.');
  root.setAttribute('viewBox', box.join(' ')); root.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns', NS); root.removeAttribute('width'); root.removeAttribute('height');
  return new XMLSerializer().serializeToString(root);
}
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(c => c+c).join('');
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(v);
  if (m && m.slice(1).every(x => +x <= 255)) return '#' + m.slice(1).map(x => (+x).toString(16).padStart(2, '0')).join('');
  if (v === 'white') return '#ffffff'; if (v === 'black') return '#000000'; return null;
}
export function svgColors(svg: string): string[] {
  const root = parse(svg), colors = new Set<string>();
  for (const el of [root,...root.querySelectorAll('*')]) for (const key of ['fill','stroke','stop-color']) {
    for (const value of [el.getAttribute(key), (el as SVGElement).style?.getPropertyValue(key)]) {
      const color = normalizeColor(value);
      if (color) { const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)); const neutral=Math.max(...rgb)-Math.min(...rgb)<18; if (!(neutral && (Math.max(...rgb)<60 || Math.min(...rgb)>240))) colors.add(color); }
    }
  }
  return [...colors];
}
export async function importAsset(raw: string, name: string, source: string): Promise<Asset> {
  const svg = cleanSvg(raw), viewBox = parse(svg).getAttribute('viewBox')!;
  const [, ,w,h] = viewBox.split(' ').map(Number);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  return { id: crypto.randomUUID(), name: name.replace(/\.svg$/i,''), tags: [], svg, viewBox, ratio: w/h, source, digest, colors: svgColors(svg) };
}
export function paletteSourceColors(assets: Asset[]): string[] {
  return [...new Set(assets.flatMap(a=>a.colors))].sort();
}
export function renderAsset(asset: Asset, palette: string[], prefix: string, sourceColors = asset.colors): SVGSVGElement {
  const root = parse(asset.svg), ids = new Map<string,string>();
  for (const el of [root,...root.querySelectorAll('[id]')]) { const id = el.getAttribute('id'); if (!id) continue; const next = `${prefix}-${id}`; ids.set(id,next); el.setAttribute('id', next); }
  for (const el of [root,...root.querySelectorAll('*')]) for (const attr of Array.from(el.attributes)) {
    let v = attr.value;
    v = v.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (all,a,b,c)=>{const target=String(a??b??c).trim();const next=target.startsWith('#')?ids.get(target.slice(1)):undefined;return next?`url(#${next})`:all;});
    if (/(?:^|:)href$/.test(attr.name) && v.startsWith('#')) { const next=ids.get(v.slice(1));if(next)v=`#${next}`; }
    if (attr.name !== 'id') el.setAttributeNS(attr.namespaceURI,attr.name,v);
  }
  if (palette.length) {
    const colorMap = new Map(sourceColors.map((c,i)=>[c,palette[i % palette.length]]));
    for (const el of [root,...root.querySelectorAll('*')]) for (const key of ['fill','stroke','stop-color']) {
      const direct = el.getAttribute(key), inline = (el as SVGElement).style?.getPropertyValue(key);
      if (direct) { const mapped = colorMap.get(normalizeColor(direct) || ''); if (mapped) el.setAttribute(key,mapped); }
      if (inline) { const mapped = colorMap.get(normalizeColor(inline) || ''); if (mapped) (el as SVGElement).style.setProperty(key,mapped); }
    }
  }
  return root;
}
export function exportScene(scene: Scene, assets: Asset[]): string {
  const sourceColors = paletteSourceColors(assets);
  const doc = document.implementation.createDocument(NS,'svg',null), root = doc.documentElement;
  root.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns',NS); root.setAttribute('viewBox',`0 0 ${scene.width} ${scene.height}`); root.setAttribute('width',String(scene.width)); root.setAttribute('height',String(scene.height));
  const title = doc.createElementNS(NS,'title'); title.textContent = scene.title; root.append(title);
  if (scene.background !== 'transparent') { const bg=doc.createElementNS(NS,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill',scene.background);root.append(bg); }
  for (const item of scene.items.filter(i=>!i.hidden)) {
    const asset=assets.find(a=>a.id===item.assetId); if(!asset)throw new Error('Для одного объекта не найден исходник.');
    const h=item.width/asset.ratio, g=doc.createElementNS(NS,'g');g.setAttribute('id',`object-${item.id}`);g.setAttribute('data-name',asset.name);g.setAttribute('transform',`translate(${item.x} ${item.y}) rotate(${item.rotation})`);
    const svg=renderAsset(asset,scene.palette,item.id,sourceColors);svg.setAttribute('x',String(-item.width/2));svg.setAttribute('y',String(-h/2));svg.setAttribute('width',String(item.width));svg.setAttribute('height',String(h));g.append(doc.importNode(svg,true));root.append(g);
  }
  return new XMLSerializer().serializeToString(root);
}
export function parsePalette(text: string): string[] {
  let values: string[];
  try { const j:unknown=JSON.parse(text); const a=Array.isArray(j)?j:(j as {colors?:unknown})?.colors; if(!Array.isArray(a))throw new Error(); values=a.map(v=>typeof v==='string'?v:(v as {color?:string}).color||''); }
  catch { values=text.match(/#[a-f\d]{6}\b|#[a-f\d]{3}\b/gi)||[]; }
  const colors=[...new Set(values.map(normalizeColor).filter((c):c is string=>!!c))];
  if(!colors.length || colors.length>12)throw new Error('В палитре нужно от 1 до 12 цветов HEX (JSON или текст).'); return colors;
}
export function validateProject(value: unknown): Project {
  const p=value as Project;
  if(!p || p.version!==1 || !Array.isArray(p.assets) || !p.scene || !Array.isArray(p.scene.items) || p.assets.length>200 || p.scene.items.length>200)throw new Error('Неизвестный формат проекта.');
  const ids=new Set<string>();
  const assets=p.assets.map(a=> { if(!a || typeof a.id!=='string'||ids.has(a.id)||typeof a.svg!=='string'||typeof a.name!=='string')throw new Error('Повреждённая библиотека.');ids.add(a.id);const svg=cleanSvg(a.svg);const vb=parse(svg).getAttribute('viewBox')!; const b=vb.split(' ').map(Number);return {...a,svg,viewBox:vb,ratio:b[2]/b[3],tags:Array.isArray(a.tags)?a.tags.filter(t=>typeof t==='string'):[],colors:svgColors(svg)}; });
  const s=p.scene;
  if(typeof s.title!=='string' || ![s.width,s.height].every(v=>Number.isFinite(v)&&v>=100&&v<=4096) || (s.background!=='transparent'&&!normalizeColor(s.background)) || !Array.isArray(s.palette)||s.palette.length>12||s.palette.some(c=>!normalizeColor(c)))throw new Error('Некорректные параметры холста.');
  if(s.layout!==undefined&&!['cluster','offset','title'].includes(s.layout))throw new Error('Неизвестная схема расположения.');
  const itemIds=new Set<string>();
  for(const i of s.items) { if(!i||typeof i.id!=='string'||itemIds.has(i.id)||!ids.has(i.assetId)||![i.x,i.y,i.width,i.rotation].every(Number.isFinite)||i.width<.0001||i.width>20000||Math.abs(i.x)>20000||Math.abs(i.y)>20000||typeof i.hidden!=='boolean')throw new Error('Некорректные объекты сцены.');itemIds.add(i.id); }
  return {version:1,assets,scene:{...s,layout:s.layout??'cluster'}};
}
