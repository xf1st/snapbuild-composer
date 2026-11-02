import type { Asset } from './model';
export const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const meanings: Record<string,string[]> = {
 'книга':['Знания, обучение, чтение, образование. Открывать новые горизонты и постигать неизвестное.','Книга символизирует опыт, мудрость и источник информации.'],
 'телефон':['Общение, связь на расстоянии, звонки, сообщения. Всегда оставаться на связи.','Телефон символизирует цифровые технологии, коммуникацию и контакт с близкими.'],
 'наушники':['Музыка, звук, подкасты и отдых. Настроиться на свою волну и отвлечься от шума.','Наушники символизируют сосредоточенность, личное пространство и умение слушать.'],
 'лампа':['Озарение, новая идея, вдохновение. Пролить свет на сложный вопрос, найти решение.','Лампа освещает путь, помогает работать ночью, символизирует ясность мысли.'],
 'кошелек':['Сбережения, личные финансы, бюджет. Сохранить деньги на чёрный день.','Кошелёк символизирует финансовую безопасность, накопления и запас ресурсов.'],
 'ручка':['Записать мысль, составить план, написать историю. Дать идеям форму.','Ручка символизирует творчество, авторство, письмо и начало нового дела.'],
 'папка':['Документы, организация, порядок. Разложить всё по полочкам и упорядочить хаос.','Папка символизирует работу с информацией, системность, хранение важных дел.'],
 'монета':['Деньги, доход, инвестиции, прибыль. Заставить накопления расти и окупить усилия.','Монета символизирует ценность, оплату, экономику, достаток и результат труда.'],
 'пазлы':['Командная работа, сотрудничество, единство. Собрать целое из частей и найти недостающий элемент.','Пазлы символизируют взаимопомощь, сложную задачу и поиск подходящего решения.'],
 'растение':['Рост, развитие, забота и терпение. Посеять семена будущего и вырастить своё дело.','Растение символизирует жизнь, природу, экологию, восстановление и постепенный прогресс.'],
};
export const normalize=(s:string)=>s.toLowerCase().replace(/ё/g,'е').trim();
export function catalog(assets:Asset[]){
 const seen=new Set<string>();return assets.filter(a=>{const key=normalize(a.name.split('·')[0]);if(seen.has(key)||/^(фон|background)(\s|$)/.test(key))return false;seen.add(key);return true;}).map(a=>({id:a.id,name:a.name,texts:[`${a.name}. ${a.tags.join(', ')}`,...(meanings[normalize(a.name.split('·')[0])]??[])]}));
}
export function rankVectors(query:number[], vectors:{id:string;vector:number[]}[], limit=3){
 if(!query.length||!query.every(Number.isFinite))throw Error('Некорректный вектор запроса');
 const scores=new Map<string,number>();for(const {id,vector} of vectors){if(vector.length!==query.length||!vector.every(Number.isFinite))throw Error('Некорректный вектор объекта');const dot=query.reduce((n,v,i)=>n+v*vector[i],0),norm=Math.hypot(...query)*Math.hypot(...vector),score=norm?dot/norm:0;scores.set(id,Math.max(scores.get(id)??-1,score));}
 const ranked=[...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score);
 const best=ranked[0]?.score??0;
 return ranked.filter(x=>x.score>=Math.max(.35,best*.85)).slice(0,limit);
}
