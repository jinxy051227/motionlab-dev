import {mapPinchToFlow} from './science.js';

// Official Google MediaPipe package loaded only if camera mode is requested.
const MP_VERSION='1.2.2';
const CDN=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function getGesture(landmarks) {
  if(!landmarks || landmarks.length<21) return null;
  const palm=Math.max(dist(landmarks[5],landmarks[17]),0.015);
  const ratio=dist(landmarks[4],landmarks[8])/palm;
  return {pinchRatio:ratio, flow:mapPinchToFlow(ratio), center:{x:(landmarks[0].x+landmarks[9].x)/2,y:(landmarks[0].y+landmarks[9].y)/2}};
}

export function swirlScore(path) {
  // A moving hand must trace a substantial loop, not merely shake sideways.
  if(path.length<8) return 0;
  const cx=path.reduce((sum,p)=>sum+p.x,0)/path.length;
  const cy=path.reduce((sum,p)=>sum+p.y,0)/path.length;
  const xs=path.map(p=>p.x), ys=path.map(p=>p.y);
  const extentX=Math.max(...xs)-Math.min(...xs), extentY=Math.max(...ys)-Math.min(...ys);
  if(extentX<0.028 || extentY<0.028) return 0;
  let turn=0;
  for(let i=1;i<path.length;i++) {
    const a=Math.atan2(path[i-1].y-cy,path[i-1].x-cx);
    const b=Math.atan2(path[i].y-cy,path[i].x-cx);
    let delta=b-a;
    while(delta>Math.PI) delta-=2*Math.PI;
    while(delta<-Math.PI) delta+=2*Math.PI;
    turn+=delta;
  }
  return Math.min(Math.abs(turn)/(Math.PI*1.35),1);
}

export class CameraController {
  constructor(video,overlay,onUpdate,onStatus) {
    this.video=video; this.overlay=overlay; this.onUpdate=onUpdate; this.onStatus=onStatus;
    this.stream=null; this.landmarker=null; this.raf=null; this.active=false;
    this.lastVideoTime=-1; this.frameTime=0; this.swirlHistory=[]; this.flowSmoothed=0;
  }
  async start() {
    if(this.active) return;
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('该浏览器不支持摄像头。请使用Chrome并通过localhost或HTTPS访问。');
    this.onStatus('正在加载MediaPipe模型（首次需要联网）…');
    const mp=await import(`${CDN}/vision_bundle.mjs`);
    const fileset=await mp.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    try {
      this.landmarker=await mp.HandLandmarker.createFromOptions(fileset,{
        baseOptions:{modelAssetPath:MODEL,delegate:'GPU'},runningMode:'VIDEO',numHands:2,
        minHandDetectionConfidence:0.55,minTrackingConfidence:0.5,
      });
    } catch(err) {
      // Some Mac graphics configurations don't support the GPU delegate.
      this.landmarker=await mp.HandLandmarker.createFromOptions(fileset,{
        baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},runningMode:'VIDEO',numHands:2,
      });
    }
    try {
      this.stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
      this.video.srcObject=this.stream;
      await this.video.play();
      this.active=true; this.lastVideoTime=-1; this.onStatus('摄像头已就绪；请将双手放入画面');
      this.loop();
    } catch(e) {
      this.landmarker?.close?.();this.landmarker=null;
      throw e;
    }
  }
  stop() {
    this.active=false;
    if(this.raf) cancelAnimationFrame(this.raf);
    this.raf=null;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    if(this.video) this.video.srcObject=null;
    this.landmarker?.close?.();this.landmarker=null;
    const ctx=this.overlay.getContext('2d');ctx.clearRect(0,0,this.overlay.width,this.overlay.height);
    this.onUpdate({flow:0,swirl:false,numHands:0,hands:[]});
  }
  loop() {
    if(!this.active) return;
    this.raf=requestAnimationFrame(()=>this.loop());
    if(this.video.readyState<2 || this.video.currentTime===this.lastVideoTime) return;
    if(performance.now()-this.frameTime<44) return; // ~22fps to keep UI responsive.
    this.frameTime=performance.now();this.lastVideoTime=this.video.currentTime;
    try {
      const result=this.landmarker.detectForVideo(this.video,performance.now());
      this.draw(result.landmarks||[]);
      const hands=(result.landmarks||[]).map(l=>({...getGesture(l),landmarks:l})).sort((a,b)=>a.center.x-b.center.x);
      // Screen is mirrored. x>0.5 appears on the left of the video as seen by the user.
      // If only one hand is present, it acts as the titration valve.
      const valve=hands.length>=2?hands[1]:hands[0];
      const mixingHand=hands.length>=2?hands[0]:null;
      const target=valve?valve.flow:0;
      this.flowSmoothed=this.flowSmoothed*0.62+target*0.38;
      const now=performance.now();
      if(mixingHand) {
        this.swirlHistory.push({...mixingHand.center,t:now});
        this.swirlHistory=this.swirlHistory.filter(p=>now-p.t<1700);
      } else this.swirlHistory=[];
      const score=swirlScore(this.swirlHistory);
      this.onUpdate({flow:this.flowSmoothed<0.012?0:this.flowSmoothed,swirl:score>0.74,numHands:hands.length,score,hands:hands.map(h=>({x:1-h.center.x,y:h.center.y,ratio:h.pinchRatio}))});
    } catch(e) {
      this.onStatus(`摄像头追踪出现问题：${e.message}`);
    }
  }
  draw(hands) {
    const canvas=this.overlay;const ctx=canvas.getContext('2d');
    const w=canvas.width=this.video.videoWidth||640,h=canvas.height=this.video.videoHeight||480;
    ctx.clearRect(0,0,w,h);
    for(const [i,hand] of hands.entries()) {
      const color=i===0?'#2dd4bf':'#fdba74';
      ctx.lineWidth=3;ctx.strokeStyle=color;ctx.fillStyle=color;
      for(const [a,b] of CONNECTIONS){ctx.beginPath();ctx.moveTo(hand[a].x*w,hand[a].y*h);ctx.lineTo(hand[b].x*w,hand[b].y*h);ctx.stroke();}
      for(const p of hand){ctx.beginPath();ctx.arc(p.x*w,p.y*h,3.4,0,Math.PI*2);ctx.fill();}
    }
  }
}
