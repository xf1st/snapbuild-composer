import {describe,it,expect} from 'vitest';
import {catalog,rankVectors} from '../src/semantic';
import type {Asset} from '../src/model';
const asset=(id:string,name:string):Asset=>({id,name,tags:[],svg:'',viewBox:'0 0 1 1',ratio:1,source:'fixture',digest:'',colors:[]});
describe('semantic selection boundaries',()=>{
 it('builds a catalog only from existing assets and deduplicates mono variants',()=>{const c=catalog([asset('1','Книга'),asset('2','Книга · моно'),asset('3','Телефон'),asset('4','Фон')]);expect(c.map(a=>a.id)).toEqual(['1','3']);expect(c[0].texts.join(' ')).toContain('Знания');});
 it('ranks meanings, deduplicates multiple descriptions and limits weak matches',()=>{expect(rankVectors([1,0],[{id:'plant',vector:[1,0]},{id:'plant',vector:[.9,.1]},{id:'coin',vector:[0,1]}]).map(x=>x.id)).toEqual(['plant']);});
 it('does not manufacture a match for unrelated or zero vectors',()=>{expect(rankVectors([1,0],[{id:'x',vector:[-1,0]}])).toEqual([]);expect(rankVectors([0,0],[{id:'x',vector:[1,0]}])).toEqual([]);});
 it('rejects malformed embedding data',()=>{expect(()=>rankVectors([NaN],[{id:'x',vector:[1]}])).toThrow();expect(()=>rankVectors([1,0],[{id:'x',vector:[1]}])).toThrow();});
});
