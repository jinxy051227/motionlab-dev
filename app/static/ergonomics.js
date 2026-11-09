/** Fixed-plane ergonomic input. No palm-size depth, no landmark.z dependency. */
export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export class SmoothPointer2D {
  constructor({alpha=.34,deadZone=.010,fastThreshold=.095}={}) {this.alpha=alpha;this.deadZone=deadZone;this.fastThreshold=fastThreshold;this.xy=null;}
  reset(){this.xy=null;}
  update(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y)) return this.xy?{...this.xy}:null;
    const p={x:clamp(x,0,1),y:clamp(y,0,1)};
    if(!this.xy){this.xy=p;return {...p};}
    const dist=Math.hypot(p.x-this.xy.x,p.y-this.xy.y);
    if(dist<this.deadZone)return {...this.xy};
    const alpha=dist>this.fastThreshold?Math.min(1,this.alpha*2.1):this.alpha;
    this.xy={x:this.xy.x+(p.x-this.xy.x)*alpha,y:this.xy.y+(p.y-this.xy.y)*alpha};
    return {...this.xy};
  }
}
export const RACK_SLOT_OFFSETS=Object.freeze([-.48,0,.48]);
export function rackSlotFor(tube,rack,{maxDx=.24,maxDy=1.2}={}){
  if(!tube||!rack)return null;
  if(Math.abs(tube.y-rack.y) > maxDy)return null;
  let best=null,dist=Infinity;
  for(const xOffset of RACK_SLOT_OFFSETS){const dx=Math.abs(tube.x-(rack.x+xOffset));if(dx<dist){dist=dx;best=xOffset;}}
  return dist<=maxDx?{x:rack.x+best,y:rack.y+.25,z:rack.z,offset:best}:null;
}
export function easyPourTarget(source,candidates,{horizontal=.75,verticalMin=.30,verticalMax=2.3}={}){
  if(!source)return null;let best=null,score=Infinity;
  for(const to of candidates){
    if(to===source||to.broken)continue;
    const dx=Math.abs(source.x-to.x),dy=source.y-to.y;
    if(dx>horizontal||dy<verticalMin||dy>verticalMax)continue;
    const d=dx+Math.abs(dy-1)*.15;
    if(d<score){score=d;best=to;}
  }
  return best;
}
export function dripRate({tilt=0,remainingMl=0,dt=0,viscosity=1,diameter=.2}={}){
  if(remainingMl<=0||dt<=0)return 0;
  const excess=Math.max(0,Math.abs(tilt)-.5);
  return Math.min(remainingMl,dt*3.2*excess*Math.max(.15,diameter/.2)/Math.max(.25,viscosity));
}
