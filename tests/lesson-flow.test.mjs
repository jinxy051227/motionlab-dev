import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSON_PLANS,getLesson,lessonProgress,LessonDirector} from '../app/static/lesson-flow.js';
import {ExperimentEngine} from '../app/static/experiment-engine.js';
test('all five supported labs contain safety, actual action and observation',()=>{
 assert.equal(Object.keys(LESSON_PLANS).length,5);
 for(const [name,steps] of Object.entries(LESSON_PLANS)){
  assert.equal(steps[0].type,'safety',name);
  assert.equal(steps.at(-1).type,'observe',name);
  assert.ok(steps.some(s=>s.type==='pour'||s.type==='heat'),name);
 }
});
test('manual plan uses real chemistry amounts and observations',()=>{
 const e=new ExperimentEngine('neutralization');e.loadStarter();
 let p=lessonProgress('neutralization',{goggles:true,reagents:e.reagents});
 assert.deepEqual(p.map(s=>s.done),[true,false,false,false]);
 e.add('naoh',3);p=lessonProgress('neutralization',{goggles:true,reagents:e.reagents});
 assert.deepEqual(p.map(s=>s.done),[true,true,false,false]);
 e.add('naoh',7);p=lessonProgress('neutralization',{goggles:true,reagents:e.reagents,observed:true});
 assert.ok(p.every(s=>s.done));assert.ok(Math.abs(e.observe().ph-7)<.01);
});
test('salt sequence reaches simulated saturation, heating requires temp',()=>{
 const e=new ExperimentEngine('dissolution');e.loadStarter();
 for(const s of getLesson('dissolution').filter(x=>x.type==='pour'))e.add(s.reagent,s.amount);
 assert.ok(e.observe().undissolvedG>0);
 assert.equal(lessonProgress('heating',{goggles:true,temperatureC:25})[1].done,false);
 assert.equal(lessonProgress('heating',{goggles:true,temperatureC:85})[1].done,true);
});
test('director: pause, resume, single action and completion',()=>{
 const actions=[];let completes=0;
 const d=new LessonDirector('precipitate',{
  start:s=>(actions.push('start:'+s.id),true),
  update:()=>true,
  finish:s=>actions.push('finish:'+s.id),
  onComplete:()=>completes++
 });
 assert.equal(d.next(),true);d.tick(.02);assert.equal(d.index,1);assert.equal(d.running,false);
 assert.equal(d.play(),true);assert.equal(d.pause(),true);d.tick(.1);assert.equal(d.index,1);
 d.play();for(let i=0;i<80;i++)d.tick(.1);
 assert.equal(d.completed,true);assert.equal(completes,1);
 assert.deepEqual(actions.filter(a=>a.startsWith('finish:')),['finish:safety','finish:first','finish:observe']);
});
test('director propagates failed operations instead of marking complete',()=>{
 const d=new LessonDirector('heating',{start:()=>({ok:false,reason:'missing apparatus'}),update:()=>true});
 d.play();d.tick(.05);assert.equal(d.index,0);assert.match(d.error,/missing apparatus/);assert.equal(d.paused,true);
});
