import test from 'node:test';
import assert from 'node:assert/strict';
import {PinchHysteresis, LandmarkSmoother, normalizedToWorld, estimateFrameQuality, taskProgress, EQUIPMENT, pinchRatio} from '../app/static/interaction3d.js';

test('pinch uses hysteresis and three stable frames',()=>{
 const p=new PinchHysteresis();
 assert.equal(p.update(.2).change,null);assert.equal(p.update(.21).change,null);
 assert.equal(p.update(.20).change,'grab');
 assert.equal(p.update(.50).change,null); // below release threshold
 assert.equal(p.update(.7).change,null);assert.equal(p.update(.72).change,null);
 assert.equal(p.update(.72).change,'release');
});
test('untracked frame does not create intentional release',()=>{
 const p=new PinchHysteresis({frames:1});p.update(.2);assert.equal(p.update(null).pressed,true);assert.equal(p.update(null).change,null);
});
test('3d map mirror coordinate and clamp',()=>{
 assert.ok(normalizedToWorld(0,.5).x>0);assert.ok(normalizedToWorld(1,.5).x<0);
 assert.ok(normalizedToWorld(.5,0).y>normalizedToWorld(.5,1).y);
});
test('smoothing damps rapid noise',()=>{
 const f=new LandmarkSmoother(.25);f.update([{x:0,y:0,z:0}]);const x=f.update([{x:1,y:0,z:0}])[0].x;assert.equal(x,.25);
});
test('highlights check saturated frame',()=>{
 const rgba=new Uint8ClampedArray(12*12*4).fill(255);const q=estimateFrameQuality(rgba,12,12);assert.ok(q.overexposed>.99);assert.ok(q.warning);
});
test('guided completion requires all four checks',()=>{
 const base=taskProgress({goggles:true,volumeMl:4,onRack:true,lampRecapped:false});assert.equal(base.done,false);
 const yes=taskProgress({goggles:true,volumeMl:4,onRack:true,lampRecapped:true});assert.equal(yes.done,true);
});
test('equipment catalog has minimum required apparatus',()=>{
 for(const key of ['tube','beaker','flask','reagent','rack','lamp','burette','pipette'])assert.ok(EQUIPMENT[key]);
});
test('pinch geometry has normalization',()=>{
 const p=Array.from({length:21},()=>({x:.5,y:.5}));p[5]={x:.2,y:.5};p[17]={x:.8,y:.5};p[4]={x:.4,y:.5};p[8]={x:.45,y:.5};assert.ok(pinchRatio(p)<.12);
});
