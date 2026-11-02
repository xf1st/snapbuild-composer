import {afterEach,describe,it,expect,vi} from 'vitest';
import type {Asset} from '../src/model';
const asset={id:'known',name:'Книга',tags:[]} as Asset;
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.useRealTimers();});
class FakeWorker{
 static last:FakeWorker;onmessage:((e:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;terminated=false;
 constructor(){FakeWorker.last=this;}postMessage(){}terminate(){this.terminated=true;}
 emit(data:unknown){this.onmessage?.({data});}
}
describe('browser worker failure and cancellation',()=>{
 it('does not accept invented object IDs',async()=>{vi.stubGlobal('Worker',FakeWorker);const {semanticSelect}=await import('../src/semanticClient');const p=semanticSelect('idea',[asset],()=>{});FakeWorker.last.emit({type:'result',ranked:[{id:'invented'}]});await expect(p).rejects.toThrow(/некорректный/);expect(FakeWorker.last.terminated).toBe(true);});
 it('cancels work and allows a fresh attempt',async()=>{vi.stubGlobal('Worker',FakeWorker);const {semanticSelect,cancelSemantic}=await import('../src/semanticClient');const p=semanticSelect('idea',[asset],()=>{});cancelSemantic();await expect(p).rejects.toThrow(/отменён/);const retry=semanticSelect('idea',[asset],()=>{});FakeWorker.last.emit({type:'result',ranked:[{id:'known'}]});expect((await retry).assets).toEqual([asset]);});
 it('terminates a timed out download without becoming permanently busy',async()=>{vi.useFakeTimers();vi.stubGlobal('Worker',FakeWorker);const {semanticSelect}=await import('../src/semanticClient');const p=semanticSelect('idea',[asset],()=>{});const assertion=expect(p).rejects.toThrow(/5 минут/);await vi.advanceTimersByTimeAsync(300000);await assertion;expect(FakeWorker.last.terminated).toBe(true);});
 it('handles missing Worker support without leaving selection locked',async()=>{vi.stubGlobal('Worker',class{constructor(){throw Error('unsupported');}});const {semanticSelect}=await import('../src/semanticClient');await expect(semanticSelect('idea',[asset],()=>{})).rejects.toThrow(/не поддерживает/);await expect(semanticSelect('idea',[asset],()=>{})).rejects.toThrow(/не поддерживает/);});
});
