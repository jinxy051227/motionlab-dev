import test from 'node:test';import assert from 'node:assert/strict';
import {GripTransition,compatibleGrip,pickGripTarget,gripZones,classifyGripPose} from '../app/static/grip-intent.js';
test('approaching a flask without grasp cannot grab',()=>{
 const t=new GripTransition({frames:2});t.update('open');t.update('open');
 for(let i=0;i<20;i++)assert.equal(t.update('open').change,null);
 assert.equal(t.holding,false);
});
test('closed hand initially never grabs until it first opens',()=>{
 const t=new GripTransition({frames:2});t.update('power');assert.equal(t.update('power').change,null);
 t.update('open');t.update('open');t.update('power');assert.equal(t.update('power').change,'grab');
});
test('gesture transition captures once and deliberate opening releases',()=>{
 const t=new GripTransition({frames:3});for(let i=0;i<3;i++)t.update('open');
 let r;for(let i=0;i<3;i++)r=t.update('pinch');assert.equal(r.change,'grab');
 for(let i=0;i<10;i++)assert.equal(t.update('pinch').change,null);
 for(let i=0;i<3;i++)r=t.update('open');assert.equal(r.change,'release');
});
test('proximity alone and wrong hand shape cannot grip',()=>{
 const flask={type:'flask',body:{position:{x:1,y:1,z:0}},held:false,broken:false};
 const p={x:1.2,y:1.34,z:0};
 assert.equal(pickGripTarget([flask],p,'open'),null);
 assert.equal(pickGripTarget([flask],p,'pinch'),null);
 assert.equal(pickGripTarget([flask],p,'power')?.entity,flask);
 assert.equal(compatibleGrip('tube','pinch'),true);
 assert.equal(compatibleGrip('reagent','power'),true);
});
test('grip is near vessel surface, not at center',()=>{
 const beaker={type:'beaker',body:{position:{x:0,y:1,z:0}},held:false,broken:false};
 const p={x:.39,y:1.06,z:0};
 assert.equal(pickGripTarget([beaker],p,'power',{radius:.23})?.entity,beaker);
 assert.equal(pickGripTarget([beaker],{x:0,y:1,z:0},'power',{radius:.23}),null);
 assert.equal(gripZones('beaker').length,2);
});
test('unknown landmarks cannot manufacture grip',()=>assert.equal(classifyGripPose([]),'unknown'));
function mockHand(){
 const p=Array.from({length:21},()=>({x:.5,y:.65}));
 p[5]={x:.37,y:.6};p[17]={x:.70,y:.6};p[9]={x:.49,y:.57};p[13]={x:.60,y:.58};
 for(const [m,pip,tip] of [[5,6,8],[9,10,12],[13,14,16],[17,18,20]]){
  p[pip]={x:p[m].x,y:p[m].y-.17};p[tip]={x:p[m].x,y:p[m].y-.42};
 }
 p[4]={x:.16,y:.45};return p;
}
test('stable open palm and precision pinch are recognized distinctly',()=>{
 const points=mockHand();assert.equal(classifyGripPose(points),'open');
 points[4]={x:points[8].x-.02,y:points[8].y+.02};
 assert.equal(classifyGripPose(points),'pinch');
});
test('four curled fingers produce a power grip',()=>{
 const p=mockHand();for(const [base,tip] of [[5,8],[9,12],[13,16],[17,20]])p[tip]={x:p[base].x+.04,y:p[base].y-.07};
 assert.equal(classifyGripPose(p),'power');
});
