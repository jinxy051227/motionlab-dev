import {test} from 'node:test';import assert from 'node:assert/strict';
import {SmoothPointer2D,rackSlotFor,easyPourTarget,dripRate} from '../app/static/ergonomics.js';
test('pointer has exactly 2 dimensions, never inferred depth',()=>{const s=new SmoothPointer2D();assert.deepEqual(s.update(.5,.5),{x:.5,y:.5});assert.equal('z' in s.update(.7,.5),false);});
test('micro jitter stays still; large movements track',()=>{const s=new SmoothPointer2D();s.update(.5,.5);assert.deepEqual(s.update(.504,.501),{x:.5,y:.5});assert.ok(s.update(.9,.6).x>.7);});
test('rack slot is a real position below the upper shelf',()=>{assert.deepEqual(rackSlotFor({x:0,y:1.1},{x:0,y:.5,z:0}),{x:0,y:.75,z:0,offset:0});assert.equal(rackSlotFor({x:2,y:1.1},{x:0,y:.5,z:0}),null);});
test('friendly pouring accepts alignment near container mouth',()=>{assert.equal(easyPourTarget({x:0,y:2},[{x:.3,y:.6},{x:2,y:.5}]).x,.3);});
test('flow stops upright and depends on fluid viscosity',()=>{assert.equal(dripRate({tilt:.2,remainingMl:30,dt:.1}),0);assert.ok(dripRate({tilt:1.2,remainingMl:30,dt:.1,viscosity:1})>dripRate({tilt:1.2,remainingMl:30,dt:.1,viscosity:4}));});
