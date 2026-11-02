/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers';
import { MODEL_ID, rankVectors } from './semantic';
env.allowLocalModels=false;
env.backends.onnx.wasm!.numThreads=1;
let extractor: Promise<Awaited<ReturnType<typeof makeExtractor>>> | undefined;
function makeExtractor(){return pipeline('feature-extraction',MODEL_ID,{device:'wasm',dtype:'q8',progress_callback:(event)=>{if(event.status==='progress'&&event.file.endsWith('.onnx'))self.postMessage({type:'progress',stage:'download',percent:event.progress});}});}
let signature='',cached:{id:string;vector:number[]}[]=[];
self.onmessage=async(event:MessageEvent<{query:string;catalog:{id:string;name:string;texts:string[]}[]}>)=>{
 try{
  self.postMessage({type:'progress',stage:extractor?'prepare':'download'});
  extractor??=makeExtractor().catch(e=>{extractor=undefined;throw e;});
  const pipe=await extractor;
  self.postMessage({type:'progress',stage:'prepare'});
  const next=JSON.stringify(event.data.catalog);
  if(next!==signature){
   const rows=event.data.catalog.flatMap(a=>a.texts.map(text=>({id:a.id,text})));
   const embeddings:number[][]=[];
   for(const row of rows){const result=await pipe(row.text,{pooling:'mean',normalize:true});embeddings.push(result.tolist()[0] as number[]);}
   cached=rows.map((r,i)=>({id:r.id,vector:embeddings[i]}));signature=next;
  }
  self.postMessage({type:'progress',stage:'match'});
  const output=await pipe(event.data.query,{pooling:'mean',normalize:true});
  self.postMessage({type:'result',ranked:rankVectors(output.tolist()[0] as number[],cached)});
 }catch{self.postMessage({type:'error',text:'Не удалось загрузить или запустить модель. Проверьте интернет и попробуйте снова. Можно выбрать режим «По названиям». Нынешняя композиция сохранена.'});}
};
