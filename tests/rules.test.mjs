import test from 'node:test';import assert from 'node:assert/strict';
import {tubeGuidance,LampProcedure,RULES} from '../app/static/rules.js';
test('heating SOP has scoped 1/4 max and explicit task target',()=>{
 assert.equal(tubeGuidance(4).level,'ok');assert.equal(tubeGuidance(1).level,'guide');assert.equal(tubeGuidance(6).level,'danger');assert.equal(tubeGuidance(21).level,'danger');assert.throws(()=>tubeGuidance(-1));
 assert.ok(RULES.find(r=>r.id==='tube_fill_target').applicability.includes('练习'));
});
test('alcohol lamp follows cap -> uncap -> simulated cool -> recap',()=>{
 const l=new LampProcedure();assert.equal(l.light(),false);assert.equal(l.uncap(0).ok,true);assert.equal(l.light(),true);assert.equal(l.cap(100).ok,true);assert.equal(l.state,'extinguished_first_cap');assert.equal(l.uncap(120).ok,true);assert.equal(l.cap(300).ok,false);assert.equal(l.cap(2320).ok,true);assert.equal(l.state,'recapped');
});
test('cannot recap without correct sequence',()=>{
 const l=new LampProcedure();assert.equal(l.cap(0).ok,false);assert.equal(l.uncap(0).ok,true);assert.equal(l.light(),true);
});
