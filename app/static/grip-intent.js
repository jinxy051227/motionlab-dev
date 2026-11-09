/**
 * Explicit, conservative grasp intent detection.
 * A near object is NEVER sufficient to grab it. A tracked open hand must
 * transition into a stable pinch or power grip while over a compatible grip zone.
 * All distances are ratios of landmarks, not real centimeters.
 */
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const GRIP_STYLE=Object.freeze({
  tube:'pinch', pipette:'pinch', rod:'pinch', thermometer:'pinch', burette:'pinch',
  beaker:'power', flask:'power', reagent:'power', lamp:'power', rack:'power'
});
export function fingerCurlScore(points){
 if(!points||points.length<21)return 0;
 let n=0;
 for(const [base,pip,tip] of [[5,6,8],[9,10,12],[13,14,16],[17,18,20]]){
  const denom=d(points[base],points[pip]);
  if(denom>.012 && d(points[tip],points[base])/denom<1.65)n++;
 }
 return n;
}
export function classifyGripPose(points){
 if(!points||points.length<21)return 'unknown';
 const palm=Math.max(d(points[5],points[17]),.014);
 const pinch=d(points[4],points[8])/palm;
 const folded=fingerCurlScore(points);
 if(folded>=3)return 'power';
 if(pinch<.36)return 'pinch';
 if(folded<=1&&pinch>.51)return 'open';
 return 'unknown';
}
export function compatibleGrip(type,pose){return GRIP_STYLE[type]===pose;}
export function gripZones(type){
 // Offset relative to the equipment center (side grips, bottle body / neck,
 // flask neck, tube rim). These are *educational* approximate hold locations.
 const zones={
  tube:[[.12,.25,0],[-.12,.25,0]],pipette:[[.07,.1,0],[-.07,.1,0]],
  rod:[[.07,0,0],[-.07,0,0]],thermometer:[[.06,.18,0],[-.06,.18,0]],
  burette:[[.20,.35,0],[-.20,.35,0]],
  beaker:[[.39,.06,0],[-.39,.06,0]],flask:[[.20,.34,0],[-.20,.34,0]],
  reagent:[[.35,.05,0],[-.35,.05,0]],lamp:[[.33,-.03,0],[-.33,-.03,0]],
  rack:[[.42,.2,0],[-.42,.2,0]]
 };
 return zones[type]||[[0,0,0]];
}
/** Return the closest compatible surface grip, not the nearest object center. */
export function pickGripTarget(entities,point,pose,{radius=.62}={}){
 if(!point||!['pinch','power'].includes(pose))return null;
 let best=null,score=radius;
 for(const entity of entities){
  if(entity.broken||entity.held||!compatibleGrip(entity.type,pose))continue;
  for(const zone of gripZones(entity.type)){
   const p=entity.body.position;
   const anchor={x:p.x+zone[0],y:p.y+zone[1],z:p.z+zone[2]};
   // Uncalibrated single-camera depth is deliberately down-weighted.
   const distance=Math.hypot(point.x-anchor.x,.86*(point.y-anchor.y));
   if(distance<score){score=distance;best={entity,anchor,score:distance,pose};}
  }
 }
 return best;
}
/** Requires an observed OPEN state before any grab. Smooths weak frame noise. */
export class GripTransition{
 constructor({frames=3}={}){this.frames=frames;this.stable='unknown';this.proposed=null;this.count=0;this.armed=false;this.holding=false;this.gripKind=null;}
 update(pose){
  if(!['open','pinch','power'].includes(pose)){this.count=0;this.proposed=null;return {grabbing:this.holding,change:null,kind:this.gripKind,armed:this.armed};}
  if(pose!==this.proposed){this.proposed=pose;this.count=1;}else this.count++;
  if(this.count<this.frames)return {grabbing:this.holding,change:null,kind:this.gripKind,armed:this.armed};
  if(this.stable===pose)return {grabbing:this.holding,change:null,kind:this.gripKind,armed:this.armed};
  this.stable=pose;this.count=0;
  if(pose==='open'){
   const was=this.holding;this.holding=false;this.gripKind=null;this.armed=true;
   return {grabbing:false,change:was?'release':null,kind:null,armed:true};
  }
  if(!this.holding&&this.armed){
   this.armed=false;this.holding=true;this.gripKind=pose;
   return {grabbing:true,change:'grab',kind:pose,armed:false};
  }
  if(this.holding)this.gripKind=pose;
  return {grabbing:this.holding,change:null,kind:this.gripKind,armed:this.armed};
 }
 reset(){this.stable='unknown';this.proposed=null;this.count=0;this.armed=false;this.holding=false;this.gripKind=null;}
}
