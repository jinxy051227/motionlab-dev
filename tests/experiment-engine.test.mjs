import test from 'node:test';
import assert from 'node:assert/strict';
import {ExperimentEngine,SCENARIOS,REAGENTS} from '../app/static/experiment-engine.js';
import {CURRICULUM,coverage} from '../app/static/curriculum.js';

test('5 actually implemented experiments must be present',()=>{
 assert.equal(Object.keys(SCENARIOS).length,5);
 for(const v of Object.values(SCENARIOS)) assert.equal(v.status,'implemented');
});
test('acid + alkali share a single vessel state and move toward pH 7',()=>{
 const e=new ExperimentEngine('neutralization');e.add('hcl',10);assert.ok(e.observe().ph<1.1);
 e.add('naoh',5);assert.ok(e.observe().ph<2);
 e.add('naoh',5);assert.ok(Math.abs(e.observe().ph-7)<.01);
 assert.ok(Math.abs(e.observe().neutralizedMmol-1)<.001);
 e.add('naoh',1);assert.ok(e.observe().ph>10);
});
test('phenolphthalein only pink in basic solution and after indicator addition',()=>{
 const e=new ExperimentEngine('neutralization');e.add('hcl',10);e.add('naoh',12);assert.equal(e.observe().color,'#e8f8fa');
 e.add('indicator',.1);assert.ok(e.observe().color.startsWith('rgb('));
});
test('CaCO3 precipitates and micro chemical state changes',()=>{
 const e=new ExperimentEngine('precipitate');e.add('cacl2',10);assert.equal(e.observe().precipitateG,0);
 e.add('na2co3',10);assert.ok(Math.abs(e.observe().precipitateG-.1001)<.001);
 assert.ok(e.observe().micro.some(p=>p.label==='CaCO₃↓'));
});
test('gas occurs in equal molar acetate bicarbonate model, no gas before',()=>{
 const e=new ExperimentEngine('gas');e.add('vinegar',12);assert.equal(e.observe().gasMmol,0);
 e.add('nahco3',5);assert.ok(Math.abs(e.observe().gasMmol-2.5)<.001);
 assert.ok(e.observe().micro.some(p=>p.label==='CO₂↑'));
});
test('salt dissolution respects solvent-dependent saturation',()=>{
 const e=new ExperimentEngine('dissolution');e.add('water',20);e.add('salt',4);
 assert.ok(e.observe().undissolvedG>.7);assert.ok(e.observe().dissolvedG>6);
 const before=e.observe().dissolvedG;e.add('water',20);assert.ok(e.observe().dissolvedG>before);
});
test('heating changes temperature and evaporates near boiling',()=>{
 const e=new ExperimentEngine('heating');e.add('water',25);
 for(let i=0;i<200;i++)e.tick(.1,true);
 assert.equal(e.observe().temperatureC,100);
 assert.ok(e.observe().evaporationMl>0);
 assert.ok(e.observe().volumeMl<25);
});
test('heat works only when heat source proximity callback indicates heated',()=>{
 const e=new ExperimentEngine('heating');e.add('water',25);
 for(let i=0;i<20;i++)e.tick(.1,false);
 assert.equal(e.observe().temperatureC,20);
 e.tick(.1,true);assert.ok(e.observe().temperatureC>20);
});
test('fixed vessel capacity; no negative quantities; reject unknown materials',()=>{
 const e=new ExperimentEngine('dissolution',20);e.add('water',15);
 assert.equal(e.add('water',10).accepted,5);assert.equal(e.volumeMl,20);
 assert.throws(()=>e.add('water',-1),RangeError);
 assert.throws(()=>e.add('wrong',10));
});
test('curriculum clearly separates executable experiments from future outlines',()=>{
 const c=coverage();assert.ok(c.total>=25);assert.equal(c.implemented,5);
 assert.ok(c.catalog>c.implemented);
 assert.equal(new Set(CURRICULUM.map(x=>x.topic)).size,CURRICULUM.length);
});
test('all starters refer to registered reagents',()=>{
 for(const s of Object.values(SCENARIOS))for(const r of s.starters)assert.ok(REAGENTS[r.reagent]);
});
