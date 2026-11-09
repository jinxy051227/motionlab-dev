import test from 'node:test';
import assert from 'node:assert/strict';
import {ExperimentEngine,REAGENTS} from '../app/static/experiment-engine.js';
import {reagentAppearance,mixtureAppearance} from '../app/static/liquid-appearance.js';
import {inspectContainer,inspect2D} from '../app/static/container-inspection.js';

test('common clear aqueous reagents are not arbitrarily colored',()=>{
 for(const id of ['water','hcl','naoh','cacl2','na2co3','vinegar','nahco3','brine','indicator']){
   assert.equal(reagentAppearance(id).label.startsWith('无色透明'),true,id);
   assert.equal(REAGENTS[id].color,'#e8f8fa',id);
 }
 assert.equal(reagentAppearance('salt').kind,'solid');
});
test('indicator is pink only in basic neutralization solution with indicator present',()=>{
 const e=new ExperimentEngine('neutralization');e.add('hcl',10);e.add('naoh',12);
 assert.equal(e.observe().appearance,'无色透明');
 e.add('indicator',.1);assert.match(e.observe().appearance,/粉红/);
 assert.ok(e.observe().opacity>.23);
 const e2=new ExperimentEngine('neutralization');e2.add('hcl',10);e2.add('indicator',.1);
 assert.equal(e2.observe().appearance,'无色透明');
});
test('white precipitate is represented as solid in a clear liquid phase',()=>{
 const e=new ExperimentEngine('precipitate');e.add('cacl2',10);e.add('na2co3',10);
 assert.match(e.observe().appearance,/白色碳酸钙/);
 assert.equal(e.observe().color,'#e8f7f8');
});
test('3D vessel tooltip displays dynamically mixed composition and volume',()=>{
 const e=new ExperimentEngine('neutralization');e.add('hcl',10);
 const entity={type:'beaker',spec:{name:'烧杯'},capacityMl:150,volume:10};
 let i=inspectContainer(entity,e);assert.match(i.lines.join(' | '),/稀盐酸/);
 assert.match(i.lines.join(' | '),/10\.00/);
 e.add('naoh',5);i=inspectContainer(entity,e);
 assert.match(i.lines.join(' | '),/氢氧化钠/);assert.match(i.lines.join(' | '),/15\.00/);
 assert.match(i.lines.join(' | '),/pH/);
});
test('lamp tooltip includes ethanol, cap and flame state',()=>{
 const i=inspectContainer({type:'lamp',spec:{name:'酒精灯'},inventoryMl:18,capAttached:false,flame:{visible:true}},null);
 assert.match(i.lines.join(' '),/酒精/);assert.match(i.lines.join(' '),/18\.00/);
 assert.match(i.lines.join(' '),/已取下/);assert.match(i.lines.join(' '),/已点燃/);
});
test('2D bottle and receiver return different truthful contents',()=>{
 const e=new ExperimentEngine('dissolution');e.loadStarter();
 const b=inspect2D('bottle',{scenario:'dissolution',model:e,reagentId:'salt',inventoryMl:41});
 const rec=inspect2D('beaker',{scenario:'dissolution',model:e,reagentId:'salt',inventoryMl:41});
 assert.match(b.lines.join(' '),/氯化钠粉末/);
 assert.match(rec.lines.join(' '),/蒸馏水/);
});
