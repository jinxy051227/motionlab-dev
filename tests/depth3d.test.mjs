import test from 'node:test';
import assert from 'node:assert/strict';
import {RelativeHandDepth, palmScale, normalizedToWorld} from '../app/static/interaction3d.js';

function hand(scale=1){
 const p=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
 p[5]={x:.5-.06*scale,y:.5,z:0};
 p[17]={x:.5+.06*scale,y:.5,z:0};
 p[0]={x:.5,y:.5+.06*scale,z:0};
 p[9]={x:.5,y:.5-.06*scale,z:0};
 return p;
}

test('palm size is valid and scales as hand approaches camera',()=>{
 assert.ok(palmScale(hand(1))>0);
 assert.ok(palmScale(hand(1.8))>palmScale(hand(1)));
 assert.equal(palmScale([]),null);
});
test('relative hand depth grows toward camera and shrinks away',()=>{
 const d=new RelativeHandDepth({smoothing:1});
 const neutral=d.update(hand(1));
 const closer=d.update(hand(1.65));
 const farther=d.update(hand(.7));
 assert.ok(closer>neutral);
 assert.ok(farther<neutral);
});
test('relative depth calibration can be reset and returns to neutral',()=>{
 const d=new RelativeHandDepth({smoothing:1});d.update(hand(1));d.update(hand(1.6));
 d.reset();assert.equal(d.update(hand(1.6)),.35);
});
test('3D mapped coordinates clamp unsafe extremes',()=>{
 assert.equal(normalizedToWorld(.5,.5,500).z,1.8);
 assert.equal(normalizedToWorld(.5,.5,-500).z,-1.8);
});
