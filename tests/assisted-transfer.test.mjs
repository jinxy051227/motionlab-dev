import test from 'node:test';
import assert from 'node:assert/strict';
import {AssistedPour,canTransfer,distanceToTarget} from '../app/static/assisted-transfer.js';
test('assisted pouring respects volume and source/capacity limits',()=>{
 assert.deepEqual(canTransfer({inventoryMl:6,requestedMl:5,capacityRemainingMl:2,targetType:'flask'}),{ok:true,accepted:2,shortfall:3});
 assert.equal(canTransfer({inventoryMl:6,requestedMl:5,capacityRemainingMl:0}).ok,false);
 assert.equal(canTransfer({inventoryMl:6,requestedMl:5,targetType:'lamp',capacityRemainingMl:10}).ok,false);
});
test('assisted pouring delivers continuous incremental volumes without overshoot',()=>{
 const p=new AssistedPour({rateMlPerSec:2});p.start(1);
 let total=0;for(let i=0;i<20;i++)total+=p.step(.1);
 assert.ok(Math.abs(total-1)<1e-8);assert.equal(p.active,false);assert.equal(p.step(.1),0);
});
test('assisted pouring stops on cancellation',()=>{const p=new AssistedPour();p.start(2);p.step(.1);p.cancel();assert.equal(p.step(.1),0);});
test('target snap distance is geometric and predictable',()=>{assert.equal(distanceToTarget(0,0,3,4),5);});
import {ExperimentEngine} from '../app/static/experiment-engine.js';
test('assisted pour streams increments into the SAME chemistry state',()=>{
 const model=new ExperimentEngine('precipitate');model.loadStarter();
 const session=new AssistedPour({rateMlPerSec:3});session.start(3);
 let inventory=60,accepted=0;
 while(session.active){const dose=session.step(.1);inventory-=dose;accepted+=model.add('na2co3',dose).accepted;}
 assert.ok(Math.abs(accepted-3)<1e-6);
 assert.ok(Math.abs(inventory-57)<1e-6);
 assert.ok(model.observe().precipitateG>0);
 assert.ok(model.observe().micro.some(e=>e.label==='CaCO₃↓'));
});
