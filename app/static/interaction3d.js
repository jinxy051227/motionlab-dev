/** Deterministic, testable bridge: camera landmarks -> physical interaction intent. */
export const clamp3=(x,min,max)=>Math.max(min,Math.min(max,x));
const D=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function pinchRatio(landmarks){
 if(!Array.isArray(landmarks)||landmarks.length<21) return null;
 const palm=Math.max(D(landmarks[5],landmarks[17]),.014);
 return D(landmarks[4],landmarks[8])/palm;
}
export function normalizedToWorld(x,y,z=.35){
 // Mirror-selfie horizontal mapping; hand size supplies approximate relative depth.
 return {x:clamp3((.5-x)*9,-4.5,4.5),y:clamp3(2.65-y*2.8,.34,2.38),z:clamp3(z,-1.8,1.8)};
}
// Apparent palm size changes as a hand moves toward or away from a single camera.
// This is relative motion only: NOT metric 3D reconstruction or calibrated depth.
export function palmScale(points){
 if(!Array.isArray(points)||points.length<21)return null;
 const width=D(points[5],points[17]);
 const height=D(points[0],points[9]);
 const measure=(width+height)*.5;
 return Number.isFinite(measure)&&measure>.02?measure:null;
}
export class RelativeHandDepth{
 constructor({baseZ=.35,gain=2.4,smoothing=.33}={}){this.baseZ=baseZ;this.gain=gain;this.smoothing=smoothing;this.reference=null;this.current=baseZ;}
 update(points){
  const span=palmScale(points);if(span===null)return this.current;
  if(this.reference===null){this.reference=span;this.current=this.baseZ;return this.current;}
  const target=clamp3(this.baseZ+Math.log(span/this.reference)*this.gain,-1.65,1.65);
  this.current=this.current*(1-this.smoothing)+target*this.smoothing;
  return this.current;
 }
 reset(){this.reference=null;this.current=this.baseZ;}
}

export class PinchHysteresis{
 constructor({grab=.38,release=.57,frames=3}={}){this.grab=grab;this.release=release;this.frames=frames;this.pressed=false;this.count=0;this.next=null;}
 update(ratio){
  if(ratio===null||!Number.isFinite(ratio))return {pressed:this.pressed,change:null};
  const proposed=this.pressed?ratio<=this.release:ratio<this.grab;
  if(proposed===this.pressed){this.count=0;this.next=null;return {pressed:this.pressed,change:null};}
  if(this.next!==proposed){this.next=proposed;this.count=1;}else this.count++;
  if(this.count>=this.frames){this.pressed=proposed;this.count=0;this.next=null;return {pressed:this.pressed,change:this.pressed?'grab':'release'};}
  return {pressed:this.pressed,change:null};
 }
 reset(){this.pressed=false;this.count=0;this.next=null;}
}
export class LandmarkSmoother{
 constructor(alpha=.48){this.alpha=alpha;this.prev=null;}
 update(points){
  if(!points){return this.prev;}
  if(!this.prev||this.prev.length!==points.length){this.prev=points.map(p=>({...p}));return this.prev;}
  this.prev=this.prev.map((p,i)=>({x:p.x*(1-this.alpha)+points[i].x*this.alpha,y:p.y*(1-this.alpha)+points[i].y*this.alpha,z:p.z*(1-this.alpha)+points[i].z*this.alpha}));
  return this.prev;
 }
 reset(){this.prev=null;}
}
export function estimateFrameQuality(rgba,w,h){
 let white=0,dark=0,brightness=0,count=0;
 for(let y=0;y<h;y+=Math.max(1,Math.floor(h/30)))for(let x=0;x<w;x+=Math.max(1,Math.floor(w/40))){
  const i=(y*w+x)*4;const l=(rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)/255;
  if(l>.965)white++;if(l<.08)dark++;brightness+=l;count++;
 }
 const overexposed=white/Math.max(1,count),underexposed=dark/Math.max(1,count),mean=brightness/Math.max(1,count);
 return {overexposed,underexposed,mean,warning:overexposed>.20?'高光过曝：部分手部细节可能丢失':underexposed>.62?'光线过暗：识别可能不稳定':null};
}
export const EQUIPMENT={
 tube:{name:'试管',fragile:true,shape:'tube',mass:.08},
 beaker:{name:'烧杯',fragile:true,shape:'beaker',mass:.24},
 flask:{name:'锥形瓶',fragile:true,shape:'flask',mass:.28},
 reagent:{name:'试剂瓶',fragile:true,shape:'bottle',mass:.38},
 pipette:{name:'滴管',fragile:true,shape:'pipette',mass:.07},
 rod:{name:'玻璃搅拌棒',fragile:true,shape:'rod',mass:.05},
 thermometer:{name:'温度计',fragile:true,shape:'thermo',mass:.06},
 rack:{name:'试管架',fragile:false,shape:'rack',mass:.6},
 lamp:{name:'酒精灯',fragile:true,shape:'lamp',mass:.35},
 burette:{name:'滴定架',fragile:false,shape:'burette',mass:1.3},
};
export function taskProgress({goggles=false,volumeMl=0,onRack=false,lampRecapped=false,broken=false}={}){
 const checks=[{id:'goggles',label:'佩戴护目镜（模拟确认）',ok:goggles},
 {id:'fill',label:'试管加液到本次练习目标 3—5mL',ok:volumeMl>=3&&volumeMl<=5},
 {id:'rack',label:'将试管安全放回试管架',ok:onRack&&!broken},
 {id:'lamp',label:'完成酒精灯熄灭与复盖流程',ok:lampRecapped}];
 return {checks,done:checks.every(c=>c.ok)};
}
