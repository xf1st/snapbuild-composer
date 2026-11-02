import type { ModelProgress } from './ModelLoading';
import type { Asset } from './model';
import { catalog } from './semantic';
let worker:Worker|undefined;
let pending=false;
let cancelPending:(()=>void)|undefined;
export function cancelSemantic(){cancelPending?.();}
export function semanticSelect(query:string,assets:Asset[],progress:(value:ModelProgress)=>void):Promise<{assets:Asset[];explanation:string}>{
 if(pending)return Promise.reject(Error('Подбор уже выполняется.'));
 pending=true;
 return new Promise((resolve,reject)=>{
  try{worker??=new Worker(new URL('./semantic.worker.ts',import.meta.url),{type:'module'});}catch{pending=false;reject(Error('Этот браузер не поддерживает запуск модели. Выберите подбор по названиям.'));return;}
  const current=worker;
  let timer:ReturnType<typeof setTimeout>;
  const done=()=>{clearTimeout(timer);pending=false;cancelPending=undefined;current.onmessage=null;current.onerror=null;};
  const fail=(message:string)=>{done();current.terminate();worker=undefined;reject(Error(message));};
  cancelPending=()=>fail('Подбор отменён.');
  timer=setTimeout(()=>fail('Модель не успела загрузиться за 5 минут. Проверьте интернет или выберите подбор по названиям.'),300000);
  current.onerror=()=>fail('Ошибка браузерной модели. Попробуйте снова или выберите подбор по названиям.');
  current.onmessage=(event)=>{const data=event.data;if(data.type==='progress'){progress({stage:['download','prepare','match'].includes(data.stage)?data.stage:'prepare',percent:typeof data.percent==='number'&&Number.isFinite(data.percent)?data.percent:undefined});return;}if(data.type==='error'){fail(String(data.text));return;}if(data.type!=='result')return;
   if(!Array.isArray(data.ranked)){fail('Модель вернула некорректный подбор.');return;}
   const allowed=new Map(assets.map(a=>[a.id,a]));const ids=data.ranked.map((r:{id?:string}|null)=>r?.id) as string[];
   if(ids.some(id=>!allowed.has(id))||new Set(ids).size!==ids.length||ids.length>4){fail('Модель вернула некорректный подбор.');return;}
   const selected=ids.map(id=>allowed.get(id)!);done();resolve({assets:selected,explanation:selected.length?`По смыслу подобраны: ${selected.map(a=>a.name).join(', ')}. Можно заменить объекты вручную.`:'В библиотеке не нашлось достаточно близких объектов. Уточните идею или перечислите объекты по названиям.'});
  };
  current.postMessage({query:query.slice(0,2000),catalog:catalog(assets)});
 });
}
