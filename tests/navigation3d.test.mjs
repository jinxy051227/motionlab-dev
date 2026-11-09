import test from 'node:test';
import assert from 'node:assert/strict';
import {walkDelta,WALK_CODES} from '../app/static/navigation3d.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('W/Up advances -Z, S returns +Z, A/D strafe',()=>{
  close(walkDelta({keys:['KeyW'],dt:.05}).z,-.125);
  close(walkDelta({keys:['ArrowUp'],dt:.05}).z,-.125);
  close(walkDelta({keys:['KeyS'],dt:.05}).z,.125);
  close(walkDelta({keys:['KeyA'],dt:.05}).x,-.125);
  close(walkDelta({keys:['ArrowRight'],dt:.05}).x,.125);
});
test('movement follows yaw, not global axes',()=>{
  const v=walkDelta({yaw:-Math.PI/2,keys:['KeyW'],dt:.05});
  close(v.x,.125);close(v.z,0);
});
test('diagonals normalized and vertical control available',()=>{
  const a=walkDelta({keys:['KeyW'],dt:.05});const b=walkDelta({keys:['KeyW','KeyD'],dt:.05});
  close(Math.hypot(b.x,b.y,b.z),Math.hypot(a.x,a.y,a.z));
  assert.ok(walkDelta({keys:['KeyE'],dt:.05}).y>0);
  assert.ok(walkDelta({keys:['KeyQ'],dt:.05}).y<0);
});
test('sprint faster and dt clamp protects frame hiccup',()=>{
  const a=walkDelta({keys:['KeyW'],dt:.05});
  const b=walkDelta({keys:['KeyW','ShiftLeft'],dt:.05});
  assert.ok(Math.abs(b.z)>Math.abs(a.z));
  close(walkDelta({keys:['KeyW'],dt:30}).z,a.z);
  assert.ok(WALK_CODES.has('ArrowLeft'));
});
