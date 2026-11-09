import test from 'node:test';
import assert from 'node:assert/strict';
import {setLanguage,tr,scenarioLabel,reagentLabel,getLanguage} from '../app/static/i18n.js';
import {ExperimentEngine} from '../app/static/experiment-engine.js';
import {readSession,saveSession,clearSession} from '../app/static/lab-session.js';

test('languages change instantly without modifying chemistry state',()=>{
 const e=new ExperimentEngine('neutralization');e.add('hcl',10);
 setLanguage('ja');assert.equal(getLanguage(),'ja');assert.equal(scenarioLabel('neutralization'),'酸塩基の中和とpH');
 assert.match(reagentLabel('hcl'),/希塩酸/);assert.equal(tr('教学任务'),'学習ミッション');
 setLanguage('en');assert.equal(scenarioLabel('neutralization'),'Acid–base neutralization and pH');
 assert.equal(reagentLabel('water'),'Distilled water');assert.equal(tr('教学任务'),'Guided lesson');
 assert.equal(e.observe().volumeMl,10);
 setLanguage('zh');assert.equal(tr('教学任务'),'教学任务');
});

test('independent vessels retain analytical components across multiple pours',()=>{
 const a=new ExperimentEngine('neutralization',100),b=new ExperimentEngine('neutralization',100);
 a.add('hcl',10);b.add('naoh',5);
 const before=a.volumeMl+b.volumeMl;
 const result=b.receiveSample(a.drawLiquid(4));
 assert.equal(result.accepted,4);
 assert.equal(a.observe().volumeMl,6);
 assert.equal(b.observe().volumeMl,9);
 assert.equal(a.volumeMl+b.volumeMl,before);
 const acid=b.composition().components.find(x=>x.id==='hcl');
 assert.ok(acid);assert.ok(Math.abs(acid.analyticalConcentrationMolL-0.1*4/9)<0.00002);
 assert.ok(b.composition().components.find(x=>x.id==='naoh'));
});

test('pouring brine does not automatically pour undissolved salt crystals',()=>{
 const a=new ExperimentEngine('dissolution',100),b=new ExperimentEngine('dissolution',100);
 a.add('water',20);a.add('salt',4); // 8g: some undissolved at room temperature
 const initial=a.observe();assert.ok(initial.undissolvedG>0);
 const sample=a.drawLiquid(10);assert.ok(sample.saltG>0);
 b.receiveSample(sample);
 assert.equal(a.volumeMl,10);assert.equal(b.volumeMl,10);
 const totalSalt=a.solidG+b.solidG;
 assert.ok(Math.abs(totalSalt-8)<1e-9);
 assert.ok(a.observe().undissolvedG>0.1);
 assert.ok(Math.abs(b.observe().undissolvedG)<1e-6);
});

test('experiment state can be handed off between 2D and 3D views',()=>{
 const backing=new Map();const store={getItem:k=>backing.get(k)??null,setItem:(k,v)=>backing.set(k,v),removeItem:k=>backing.delete(k)};
 const a=new ExperimentEngine('neutralization',150);a.add('hcl',10);a.add('naoh',3);
 assert.equal(saveSession('neutralization',a,store),true);
 const data=readSession(store);const b=ExperimentEngine.fromSnapshot(data.engine,150);
 assert.deepEqual(b.reagents,a.reagents);assert.equal(b.observe().ph,a.observe().ph);
 clearSession(store);assert.equal(readSession(store),null);
});
