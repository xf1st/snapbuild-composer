import { Check, Sparkles, X } from 'lucide-react';
export type ModelProgress={stage:'download'|'prepare'|'match';percent?:number};
export default function ModelLoading({progress,onCancel}:{progress:ModelProgress;onCancel:()=>void}){
 const index=['download','prepare','match'].indexOf(progress.stage);
 const percent=progress.percent===undefined?undefined:Math.max(0,Math.min(100,Math.floor(progress.percent)));
 const titles=['Знакомимся с вашей идеей','Готовим мастерскую','Находим подходящие объекты'];
 return <section className="model-loading" aria-label="Подбор композиции">
  <div className="model-loading-top"><span className="model-loading-icon"><Sparkles size={21}/><i/></span><div className="model-loading-copy"><span className="model-loading-eyebrow">НЕМНОГО МАГИИ, ВСЁ ЛОКАЛЬНО</span><h3>{titles[index]}</h3></div><button className="model-loading-cancel" aria-label="Отменить подбор" title="Отменить подбор" onClick={onCancel}><X size={16}/></button></div>
  <div className="model-loading-meta" role="status" aria-live="polite"><span>{index===0?'Загружаем модель':index===1?'Подготавливаем библиотеку':'Сопоставляем смысл и иллюстрации'}</span><strong>{index===0&&percent!==undefined?`${percent}%`:'Подождите немного'}</strong></div>
  <div className={'model-loading-track '+(index!==0||percent===undefined?'indeterminate':'')} role="progressbar" aria-label={index===0?'Загрузка модели':'Подготовка подбора'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={index===0?percent:undefined}><span style={{width:index===0&&percent!==undefined?`${percent}%`:undefined}}/></div>
  <ol className="model-loading-steps">{['Модель','Библиотека','Композиция'].map((step,i)=><li key={step} className={i<index?'done':i===index?'current':''}>{i<index?<Check size={12}/>:<span>{i+1}</span>}{step}</li>)}</ol>
  <p>{index===0?'Первая загрузка займёт немного времени. Модель останется в кеше браузера.':'Исходные иллюстрации остаются векторными. Новые объекты не создаются.'}</p>
 </section>;
}
