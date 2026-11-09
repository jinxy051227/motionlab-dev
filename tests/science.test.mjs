import test from 'node:test';import assert from 'node:assert/strict';import {calculateTitration,equivalenceMl,mapPinchToFlow,evaluateSession} from '../app/static/science.js';
test('strong acid/base equivalence calculations',()=>{
 assert.equal(equivalenceMl,10);assert.ok(Math.abs(calculateTitration(0).ph-1)<.01);assert.ok(Math.abs(calculateTitration(10).ph-7)<.01);assert.ok(calculateTitration(10.01).ph>9);assert.ok(calculateTitration(20).ph>12)
});
test('indicator after stoichiometric pH 7 equivalence',()=>{
 assert.equal(calculateTitration(10).indicator,0);assert.ok(calculateTitration(10.01).indicator>0);
});
test('camera motion maps continuously to flow',()=>{
 assert.equal(mapPinchToFlow(0),0);assert.ok(mapPinchToFlow(1.1)>mapPinchToFlow(.5));
});
test('session feedback flags excess titrant',()=>{
 const result=evaluateSession({volumeMl:11.5,swirlSeconds:0,activeSeconds:30,warnings:[]});assert.ok(result.errors.length>0);assert.ok(result.score<70);
});
