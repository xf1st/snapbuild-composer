export type Asset = { id: string; name: string; tags: string[]; svg: string; viewBox: string; ratio: number; source: string; digest: string; colors: string[] };
export type Item = { id: string; assetId: string; x: number; y: number; width: number; rotation: number; hidden: boolean };
export type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';
/** Project pointer movement onto the rotated diagonal; the opposite corner stays fixed. */
export function resizeFromCorner(item: Item, ratio: number, corner: ResizeCorner, dx: number, dy: number, maxWidth = 20000): Item {
  if (![ratio, dx, dy, maxWidth].every(Number.isFinite) || ratio <= 0) return item;
  const sx = corner.endsWith('r') ? 1 : -1, sy = corner.startsWith('b') ? 1 : -1;
  const angle = item.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const ux = c * sx - s * sy / ratio, uy = s * sx + c * sy / ratio;
  const width = Math.min(Math.max(20, maxWidth), Math.max(20, item.width + (dx * ux + dy * uy) / (ux * ux + uy * uy)));
  const change = (width - item.width) / 2;
  return { ...item, width, x: item.x + change * ux, y: item.y + change * uy };
}
export type Palette = { name: string; colors: string[]; background: string };
export type Scene = { title: string; width: number; height: number; background: string; items: Item[]; palette: string[]; layout?: string };
export type Project = { version: 1; assets: Asset[]; scene: Scene };
export const initialScene: Scene = { title: 'Новая композиция', width: 1200, height: 630, background: '#eeedfa', items: [], palette: [], layout: 'cluster' };
export function normalizeItem(item: Item): Item {
  const safe = (v:number, fallback:number) => Number.isFinite(v) ? v : fallback;
  return { ...item, x: Math.max(-20000,Math.min(20000,safe(item.x,0))), y: Math.max(-20000,Math.min(20000,safe(item.y,0))), width: Math.max(.0001,Math.min(20000,safe(item.width,20))), rotation: ((safe(item.rotation,0) + 180) % 360 + 360) % 360 - 180 };
}
export const palettes: Palette[] = [
  { name: 'Оригинал', colors: [], background: '#eeedfa' },
  { name: 'Лаванда', colors: ['#b7a2ed', '#ddd3fb', '#f5efff'], background: '#f0ecfa' },
  { name: 'Мята', colors: ['#73bdc2', '#a9e0de', '#e2f6ef'], background: '#e5f5ef' },
  { name: 'Персик', colors: ['#f29c79', '#ffc9a4', '#ffebd7'], background: '#fff0e4' },
];
export function moveLayer(items: Item[], id: string, delta: number): Item[] {
  const from = items.findIndex(i => i.id === id), to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return items;
  const next = [...items]; [next[from], next[to]] = [next[to], next[from]]; return next;
}
export function moveLayerTo(items: Item[], id: string, targetId: string): Item[] {
  const from = items.findIndex(i => i.id === id), to = items.findIndex(i => i.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items], [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export function newItem(asset: Asset, scene: Scene, offset = 0): Item {
  return { id: crypto.randomUUID(), assetId: asset.id, x: scene.width * .5 + offset, y: scene.height * .52 + offset, width: Math.min(scene.width * .27, scene.height * .5 * asset.ratio), rotation: 0, hidden: false };
}
const topics: Record<string, string[]> = {
  'деньг': ['монета', 'кошелек'], 'финанс': ['монета', 'кошелек'], 'сбереж': ['монета', 'кошелек'], 'бюджет': ['кошелек', 'монета'], 'money': ['монета', 'кошелек'], 'wealth': ['монета', 'кошелек'],
  'учеб': ['книга', 'ручка', 'лампа'], 'знан': ['книга', 'лампа'], 'образован': ['книга', 'ручка'], 'развит': ['книга', 'пазлы'], 'learn': ['книга', 'ручка'], 'study': ['книга', 'лампа'],
  'иде': ['лампа', 'пазлы'], 'вдохнов': ['лампа', 'ручка'], 'idea': ['лампа', 'пазлы'], 'творч': ['ручка', 'лампа', 'пазлы'],
  'команд': ['пазлы', 'телефон'], 'вмест': ['пазлы'], 'связ': ['телефон', 'наушники'], 'общен': ['телефон', 'наушники'], 'team': ['пазлы', 'телефон'],
  'работ': ['папка', 'лампа', 'телефон'], 'поряд': ['папка', 'ручка'], 'документ': ['папка', 'ручка'], 'офис': ['лампа', 'папка'],
  'музык': ['наушники', 'телефон'], 'отдых': ['наушники', 'книга'], 'music': ['наушники'], 'фокус': ['наушники', 'лампа'],
};
export function selectAssets(query: string, assets: Asset[]): { assets: Asset[]; explanation: string } {
  const q = query.toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const words = q.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2);
  const suggested = Object.entries(topics).filter(([stem]) => words.some(w=>w.startsWith(stem))).flatMap(([, names]) => names);
  const scored = assets.map(a => {
    const name = a.name.toLocaleLowerCase('ru').replace(/ё/g, 'е'), text = `${name} ${a.tags.join(' ')}`.toLocaleLowerCase('ru').replace(/ё/g, 'е');
    const score = words.reduce((s, w) => s + (text.includes(w) || (w.length > 4 && text.includes(w.slice(0, -2))) ? 10 : 0), 0) + suggested.reduce((s, n) => s + (name.includes(n) ? 4 : 0), 0);
    return { a, score };
  }).filter(v => v.score > 0 && !/^(?:фон(?:\s|$)|background(?:\s|$))/i.test(v.a.name)).sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const explicitCount = new Set(assets.filter(a=>q.includes(a.name.split('·')[0].trim().toLowerCase().replace(/ё/g,'е'))).map(a=>a.name.split('·')[0].trim())).size;
  const picked = scored.filter(({ a }) => { const n = a.name.split('·')[0].trim(); if (used.has(n)) return false; used.add(n); return true; }).slice(0, Math.max(5,explicitCount)).map(v => v.a);
  return { assets: picked, explanation: picked.length ? `Подобраны: ${picked.map(a => a.name).join(', ')}. По названиям, тегам и словарю метафор.` : 'Не нашёл подходящих объектов. Назовите их явно или добавьте теги в библиотеке.' };
}
export function compose(assets: Asset[], scene: Scene, layout: string): Item[] {
  const n = assets.length, w = scene.width, h = scene.height;
  return assets.map((a, i) => {
    const main = i === 0, size = main ? .48 : .22;
    const angle = (i - 1) / Math.max(1, n - 1) * Math.PI * 1.65 - Math.PI * .7;
    let x = main ? .46 : .5 + Math.cos(angle) * .29, y = main ? .56 : .51 + Math.sin(angle) * .29;
    if (layout === 'offset') { x += .12; y += .03; }
    if (layout === 'title') { x = main ? .65 : .61 + Math.cos(angle) * .21; y = main ? .59 : .56 + Math.sin(angle) * .27; }
    let width = Math.min(w * size, h * (main ? .67 : .32) * a.ratio);
    const rotation = main ? 0 : (i % 2 ? -10 : 12), rad = rotation*Math.PI/180;
    const rx=(Math.abs(Math.cos(rad))+Math.abs(Math.sin(rad))/a.ratio)/2, ry=(Math.abs(Math.sin(rad))+Math.abs(Math.cos(rad))/a.ratio)/2;
    width=Math.min(width,w/(2*rx),h/(2*ry));
    return { ...newItem(a, scene), x: Math.max(width*rx,Math.min(w-width*rx,x*w)), y: Math.max(width*ry,Math.min(h-width*ry,y*h)), width, rotation };
  }).reverse();
}

/** Reflow existing instances without revealing hidden items or replacing their identity. */
export function reflowItems(items: Item[], assets: Asset[], scene: Scene, layout: string): Item[] {
  const sources=items.slice().reverse().map(i=>assets.find(a=>a.id===i.assetId)).filter((a):a is Asset=>!!a);
  if(sources.length!==items.length)return items;
  return compose(sources,scene,layout).map((item,index)=>({...item,id:items[index].id,hidden:items[index].hidden}));
}
