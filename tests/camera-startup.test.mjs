import test from 'node:test';
import assert from 'node:assert/strict';
import {HandVision3D, explainCameraError} from '../app/static/vision3d.js';

test('camera permission denied reports a useful message',()=>{
 assert.match(explainCameraError({name:'NotAllowedError'}),/摄像头权限/);
 assert.match(explainCameraError({name:'NotReadableError'}),/占用/);
});

test('camera opens and plays before loading the ML model; model failure preserves video',async()=>{
 const calls=[];
 const stream={getTracks:()=>[{stop:()=>calls.push('stop')}],getVideoTracks:()=>[{}]};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{isSecureContext:true}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{calls.push('getUserMedia');return stream;}}}});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({})})};
 globalThis.requestAnimationFrame=()=>1;
 globalThis.cancelAnimationFrame=()=>{};
 const video={readyState:0,srcObject:null,muted:false,playsInline:false,play:async()=>calls.push('play'),pause:()=>calls.push('pause')};
 const status=[];
 const vision=new HandVision3D(video,{onStatus:x=>status.push(x)});
 vision.loadModel=async()=>{calls.push('loadModel');throw new Error('TEST_NETWORK_UNAVAILABLE');};
 const result=await vision.start();
 assert.deepEqual(calls.slice(0,3),['getUserMedia','play','loadModel']);
 assert.equal(video.srcObject,stream);
 assert.equal(vision.running,true);
 assert.equal(result.trackingReady,false);
 assert.match(result.error,/TEST_NETWORK_UNAVAILABLE/);
 assert.ok(status.some(s=>s.includes('摄像头已开启')));
 vision.stop();
 assert.equal(video.srcObject,null);
 assert.ok(calls.includes('stop'));
});

test('a denied camera permission prevents any ML model download',async()=>{
 const calls=[];
 Object.defineProperty(globalThis,'window',{configurable:true,value:{isSecureContext:true}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{calls.push('getUserMedia');throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}}}});
 globalThis.document={createElement:()=>({getContext:()=>({})})};
 const vision=new HandVision3D({pause(){},srcObject:null});
 vision.loadModel=async()=>calls.push('loadModel');
 await assert.rejects(vision.start(),/摄像头权限/);
 assert.deepEqual(calls,['getUserMedia']);
});
