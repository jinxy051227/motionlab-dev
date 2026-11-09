import {clamp} from './science.js';
/** Simplified educational 2D rigid-body dynamics; gravity + impact + liquid spill. */
export class TubeBody {
  constructor(){this.reset();}
  reset(){this.x=430;this.y=295;this.inRack=true;this.vx=0;this.vy=0;this.angle=0;this.omega=0;this.held=false;this.broken=false;this.volumeMl=0;this.spilledMl=0;this.wasDropped=false;this.resting=false;}
  grab(x,y){if(this.broken)return false;this.inRack=false;this.held=true;this.x=clamp(x,40,840);this.y=clamp(y,55,380);this.vx=this.vy=this.omega=0;this.resting=false;return true;}
  move(x,y,deltaSeconds=.016){if(!this.held||this.broken)return;const dt=Math.max(.01,deltaSeconds);this.vx=clamp((x-this.x)/dt,-850,850);this.vy=clamp((y-this.y)/dt,-850,850);this.x=clamp(x,40,840);this.y=clamp(y,40,395);this.angle=clamp((this.x-425)/750,-.48,.48);}
  release(){if(!this.held||this.broken)return;this.held=false;this.wasDropped=true;this.vx=clamp(this.vx*.35,-180,180);this.vy=clamp(this.vy*.3,-170,260);this.omega=this.vx/650;}
  setVolume(ml){const added=clamp(ml,0,20);this.volumeMl=added;return added;}
  step(dt){
    dt=Math.min(Math.max(dt,0),.035);
    if(this.broken||this.held||this.resting||this.inRack)return {impact:false,spill:0,shattered:false};
    this.vy+=980*dt;this.y+=this.vy*dt;this.x=clamp(this.x+this.vx*dt,30,850);
    this.angle+=this.omega*dt;
    this.omega+=.38*dt;
    let spilled=0;
    if(Math.abs(this.angle)>0.78 && this.volumeMl>0){spilled=Math.min(this.volumeMl,dt*7.5);this.volumeMl-=spilled;this.spilledMl+=spilled;}
    if(this.y>=385){
      const speed=Math.hypot(this.vx,this.vy);
      this.y=385;
      if(speed>230){this.broken=true;spilled+=this.volumeMl;this.spilledMl+=this.volumeMl;this.volumeMl=0;return {impact:true,spill:spilled,shattered:true};}
      this.vy=0;this.vx=0;this.omega=0;this.angle=Math.sign(this.angle||1)*Math.PI/2;this.resting=true;
      spilled+=this.volumeMl;this.spilledMl+=this.volumeMl;this.volumeMl=0;
      return {impact:true,spill:spilled,shattered:false};
    }
    return {impact:false,spill:spilled,shattered:false};
  }
}
