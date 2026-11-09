import {test} from 'node:test';import assert from 'node:assert/strict';
import {ExperimentEngine} from '../app/static/experiment-engine.js';
test('liquid from one vessel flows into another without creating liquid',()=>{
 const a=new ExperimentEngine('neutralization',50),b=new ExperimentEngine('neutralization',50);
 a.add('hcl',20);a.add('water',10);
 const sample=a.drawLiquid(8);const received=b.receiveSample(sample);
 assert.equal(received.accepted,8);assert.equal(a.observe().volumeMl,22);assert.equal(b.observe().volumeMl,8);
 assert.equal(a.observe().volumeMl+b.observe().volumeMl,30);
 assert.ok(b.reagents.hcl>0&&b.reagents.water>0);
});
test('drawing can never create negative volume',()=>{
 const a=new ExperimentEngine('heating',20);a.add('water',5);
 assert.equal(a.drawLiquid(100).volumeMl,5);assert.equal(a.observe().volumeMl,0);
});
