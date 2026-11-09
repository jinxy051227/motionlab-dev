import test from 'node:test';
import assert from 'node:assert/strict';
import {localizeActivityEvent,unmappedLessonMessages} from '../app/static/activity-i18n.js';
import {setLanguage} from '../app/static/i18n.js';

const sample = [
 '自动实验步骤完成：观察微观离子。观看微观图与实时pH并生成学习记录',
 '自动实验步骤完成：接近理论等量点。理论等量点为10.00mL，酚酞终点并不完全相同',
 '已完成辅助倒液：实际加入7.00 mL。瓶子已安全放回台面。',
 '瓶口已自动对准。开始逐步倾倒，浓度/液量与反应同步更新。',
 '辅助对准：试剂瓶正在移动至烧杯上方，接下来会逐步倒入7.00mL。',
 '自动教学演示：模拟安全确认（不代表检测到真正佩戴护目镜）。',
 '实验切换：酸碱中和与pH。现在液体加入、加热、微观画面使用同一实验状态。',
 '3D实验台已重置。玻璃器材受重力和碰撞影响。',
 '自动演示完成。此结果不能用来评定独立实操能力。',
];

test('all guided lesson titles and outcomes have complete translations',()=>{
 assert.deepEqual(unmappedLessonMessages(),[]);
});

test('Chinese activity messages remain unchanged (scientific history data preserved)',()=>{
 for(const message of sample)assert.equal(localizeActivityEvent(message,'zh'),message);
});

test('Japanese and English use complete localized messages for recorded demo',()=>{
 for(const lang of ['ja','en']){
  setLanguage(lang);
  for(const message of sample){
   const translated=localizeActivityEvent(message);
   assert.notEqual(translated,message,`${lang}: ${message}`);
   if(lang==='en')assert.doesNotMatch(translated,/[\u3400-\u9fff]/,`${lang} retains Chinese: ${message}`);
  }
 }
});

test('switching language re-localizes the same original log entry',()=>{
 const original='已完成辅助倒液：实际加入3.00 mL。瓶子已安全放回台面。';
 setLanguage('en');
 assert.match(localizeActivityEvent(original),/3\.00 mL added/);
 setLanguage('ja');
 assert.match(localizeActivityEvent(original),/3\.00 mL/);
 setLanguage('zh');
 assert.equal(localizeActivityEvent(original),original);
});

test('Chinese/English mixing no longer occurs in auto-step templates',()=>{
 setLanguage('en');
 const message=localizeActivityEvent('自动实验步骤完成：第一次加入碱液。观察酸性溶液逐渐接近中性');
 assert.equal(message,'Auto step completed: Add base solution: first dose. Observe the solution approach neutrality');
 assert.equal(message.includes('自动Experiment steps'),false);
});
