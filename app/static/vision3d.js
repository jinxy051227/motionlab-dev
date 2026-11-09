import {pinchRatio, LandmarkSmoother, estimateFrameQuality} from './interaction3d.js';
import {classifyGripPose, GripTransition} from './grip-intent.js';

const MP_VERSION='1.2.2';
const CDNS=[
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`,
  `https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}`,
];
const MODEL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export function explainCameraError(error){
  const name=error?.name||'';
  if(name==='NotAllowedError'||name==='PermissionDeniedError')return '浏览器拒绝了摄像头权限。请点击地址栏左侧的权限图标，允许本网站使用摄像头，然后刷新。';
  if(name==='NotFoundError'||name==='DevicesNotFoundError')return '未找到摄像头。请检查Mac摄像头是否可用、外接摄像头是否连接。';
  if(name==='NotReadableError'||name==='TrackStartError')return '摄像头暂时被系统或其他程序占用。请关闭Zoom、FaceTime等程序，再试一次。';
  if(name==='OverconstrainedError')return '摄像头不支持所请求的视频参数，程序将改用默认参数。';
  if(name==='SecurityError'||name==='TypeError')return '当前页面不能请求摄像头。请通过 http://127.0.0.1:8000 或 HTTPS 打开，不要直接打开HTML文件。';
  return `${name?name+'：':''}${error?.message||'未知摄像头错误'}`;
}

function withTimeout(promise,ms,label){
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}超时（${Math.round(ms/1000)}秒）`)),ms);}),
  ]).finally(()=>clearTimeout(timer));
}

export class HandVision3D{
 constructor(video,{onHands,onStatus,onQuality}={}){
  this.video=video;this.onHands=onHands||(()=>{});this.onStatus=onStatus||(()=>{});this.onQuality=onQuality||(()=>{});
  this.running=false;this.stream=null;this.model=null;this.lastVideoTime=-1;this.lastProcess=0;this.raf=null;
  this.state=[{filter:new LandmarkSmoother(),grip:new GripTransition()},{filter:new LandmarkSmoother(),grip:new GripTransition()}];
  this.frame=document.createElement('canvas');this.frame.width=640;this.frame.height=480;
  this.ctx=this.frame.getContext('2d',{willReadFrequently:true});this.lastQuality=0;
 }

 // Camera access happens BEFORE downloading MediaPipe; otherwise a failed CDN load
 // can make an otherwise healthy camera appear broken with no permission prompt.
 async start(){
  if(this.running)return {trackingReady:!!this.model};
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('当前浏览器没有可用的 getUserMedia 接口。请使用Chrome打开localhost或HTTPS。');
  if(typeof window!=='undefined' && !window.isSecureContext)throw new Error('当前不是安全来源。请访问 http://127.0.0.1:8000 或HTTPS。');
  this.onStatus('第1步/2步：正在请求摄像头权限…');
  try{
   try{this.stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});}
   catch(e){
    if(e?.name!=='OverconstrainedError')throw e;
    this.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
   }
   this.video.srcObject=this.stream;this.video.muted=true;this.video.playsInline=true;
   await withTimeout(this.video.play(),9000,'摄像头画面启动');
   // Optional glare mitigation: only touch a control explicitly advertised by the device.
   // Ignore unsupported camera controls; they must never prevent camera startup.
   try{
    const track=this.stream.getVideoTracks()[0];
    const caps=track?.getCapabilities?.()||{};
    if(caps.exposureCompensation && caps.exposureCompensation.min<0){
     const target=Math.max(caps.exposureCompensation.min,Math.min(caps.exposureCompensation.max,-0.4));
     await withTimeout(track.applyConstraints({advanced:[{exposureCompensation:target}]}),1500,'曝光调整');
    }
   }catch{};
   this.running=true;this.lastVideoTime=-1;this.lastProcess=0;
  }catch(error){this.stop();throw new Error(explainCameraError(error));}
  this.loop();
  this.onStatus('第1步完成：摄像头已开启。第2步：正在加载手部识别模型…');
  const outcome=await this.loadModelSafely();
  return outcome;
 }

 async loadModelSafely(){
  if(!this.running)return {trackingReady:false,error:'摄像头已关闭'};
  try{
   await this.loadModel();
   if(!this.running){this.model?.close?.();this.model=null;return {trackingReady:false,error:'摄像头已关闭'};}
   this.state.forEach(s=>{s.filter.reset();s.grip.reset();});
   this.onStatus('摄像头已开启 · MediaPipe双手追踪已就绪');
   return {trackingReady:true};
  }catch(error){
   const message=error?.message||String(error);
   this.onStatus(`摄像头已开启，但手部模型加载失败：${message}`);
   return {trackingReady:false,error:message};
  }
 }

 async retryTracking(){
  if(!this.running)throw new Error('请先开启摄像头');
  if(this.model)return {trackingReady:true};
  this.onStatus('摄像头已开启，正在重新加载MediaPipe…');
  return this.loadModelSafely();
 }

 async loadModel(){
  let lastError;
  for(const base of CDNS){
   if(!this.running)throw new Error('摄像头已关闭');
   try{
    const mod=await withTimeout(import(`${base}/vision_bundle.mjs`),14000,'MediaPipe SDK加载');
    if(!mod.FilesetResolver?.forVisionTasks||!mod.HandLandmarker?.createFromOptions)throw new Error('MediaPipe SDK格式异常');
    const fileset=await withTimeout(mod.FilesetResolver.forVisionTasks(`${base}/wasm`),14000,'MediaPipe WASM初始化');
    const common={runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.52,minTrackingConfidence:.55};
    try{
     this.model=await withTimeout(mod.HandLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:MODEL,delegate:'GPU'},...common}),17000,'GPU手部模型初始化');
    }catch(gpuErr){
     if(!this.running)throw gpuErr;
     this.onStatus('摄像头已开启 · GPU手势模型失败，尝试CPU模式…');
     this.model=await withTimeout(mod.HandLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},...common}),17000,'CPU手部模型初始化');
    }
    return;
   }catch(error){lastError=error;this.onStatus(`摄像头已开启 · ${base.includes('jsdelivr')?'主要':'备用'}模型源失败，正在处理…`);}
  }
  throw new Error(`模型下载/初始化失败（${lastError?.message||'网络异常'}）。检查Google Storage、jsDelivr及网络连接；摄像头本身仍可预览。`);
 }

 stop(){
  this.running=false;
  if(this.raf!=null)cancelAnimationFrame(this.raf);
  this.raf=null;
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
  if(this.video){this.video.pause?.();this.video.srcObject=null;}
  this.model?.close?.();this.model=null;
  this.state.forEach(s=>{s.filter.reset();s.grip.reset();});this.onHands([],true);
 }

 loop(){
  if(!this.running)return;
  this.raf=requestAnimationFrame(()=>this.loop());
  // The camera is already usable while the model downloads; no fake errors.
  if(!this.model||this.video.readyState<2)return;
  const now=performance.now();if(this.lastVideoTime===this.video.currentTime||now-this.lastProcess<52)return;
  this.lastVideoTime=this.video.currentTime;this.lastProcess=now;
  try{
   const c=this.ctx,w=640,h=480;
   c.save();c.clearRect(0,0,w,h);
   // Only moderate contrast correction. Saturated glare cannot be recovered.
   c.filter='brightness(0.96) contrast(1.11)';c.drawImage(this.video,0,0,w,h);c.restore();
   if(now-this.lastQuality>1450){this.onQuality(estimateFrameQuality(c.getImageData(0,0,w,h).data,w,h));this.lastQuality=now;}
   const result=this.model.detectForVideo(this.frame,now);
   const raw=(result.landmarks||[]).map((p,i)=>({points:p,index:i,cx:(p[0].x+p[9].x)/2})).sort((a,b)=>a.cx-b.cx);
   const hands=[];
   for(let i=0;i<Math.min(raw.length,2);i++){
    const smooth=this.state[i].filter.update(raw[i].points.map(p=>({x:p.x,y:p.y,z:0}))); // consciously discard depth
    const ratio=pinchRatio(smooth),pose=classifyGripPose(smooth),state=this.state[i].grip.update(pose);
    const handIndex=raw[i].index;const handedness=result.handednesses?.[handIndex]?.[0]?.categoryName||'Unknown';
    hands.push({id:i,points:smooth,ratio,pose,gripKind:state.kind,grabbing:state.grabbing,armed:state.armed,
      pinching:state.grabbing,change:state.change,handedness,
      position:{x:(smooth[0].x+smooth[9].x)/2,y:(smooth[0].y+smooth[9].y)/2}});
   }
   this.onHands(hands,false);
  }catch(error){this.onStatus(`摄像头已开启，但识别帧失败：${error?.message||String(error)}`);}
 }
}
