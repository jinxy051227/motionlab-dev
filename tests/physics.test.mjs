import test from 'node:test';import assert from 'node:assert/strict';import {TubeBody} from '../app/static/physics.js';
test('test tube rests in rack and falls after release',()=>{
 const b=new TubeBody();assert.equal(b.inRack,true);b.grab(420,100);b.setVolume(4);b.move(420,115,.1);b.release();const y=b.y;for(let i=0;i<8;i++) b.step(.03);assert.ok(b.y>y);assert.equal(b.held,false)
});
test('test tube shatters on high drop, spills all liquid',()=>{
 const b=new TubeBody();b.grab(420,90);b.setVolume(5);b.release();for(let i=0;i<150&&!b.broken;i++)b.step(.02);assert.equal(b.broken,true);assert.equal(b.volumeMl,0);assert.ok(b.spilledMl>4.99)
});
test('test tube spills when tilted',()=>{
 const b=new TubeBody();b.grab(420,250);b.setVolume(3);b.release();b.angle=1.2;b.omega=0;const start=b.volumeMl;b.step(.02);assert.ok(b.volumeMl<start);assert.ok(b.spilledMl>0)
});
