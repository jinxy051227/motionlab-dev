/** Assisted control for novice learners. Geometry is a UI aid; chemical truth is
 * provided by the deterministic ExperimentEngine. No video or chemistry sent here. */
export const limit=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function canTransfer({sourceType='reagent',targetType='beaker',inventoryMl=0,requestedMl=0,capacityRemainingMl=0}={}){
  if(sourceType!=='reagent')return {ok:false,reason:'请先选择试剂瓶。'};
  if(!['tube','beaker','flask'].includes(targetType))return {ok:false,reason:'目标必须是试管、烧杯或锥形瓶。'};
  if(!Number.isFinite(requestedMl)||requestedMl<=0)return {ok:false,reason:'加入体积必须大于0。'};
  if(inventoryMl<=0)return {ok:false,reason:'试剂瓶已空。'};
  if(capacityRemainingMl<=0)return {ok:false,reason:'目标容器已满。'};
  const accepted=Math.min(requestedMl,inventoryMl,capacityRemainingMl);
  return {ok:true,accepted,shortfall:requestedMl-accepted};
}
export class AssistedPour {
  constructor({rateMlPerSec=2.5}={}){this.rate=rateMlPerSec;this.active=false;this.remaining=0;this.delivered=0;}
  start(amount){if(!Number.isFinite(amount)||amount<=0)throw new RangeError('amount must be positive');
    this.remaining=amount;this.delivered=0;this.active=true;return this;}
  step(dt){if(!this.active)return 0;
    const applied=limit(Number.isFinite(dt)?dt:0,0,.12)*this.rate;
    const dose=Math.min(this.remaining,Math.max(0,applied));
    this.remaining=Math.max(0,this.remaining-dose);this.delivered+=dose;
    if(this.remaining<1e-7){this.remaining=0;this.active=false;}
    return dose;
  }
  cancel(){this.active=false;this.remaining=0;}
}
export function distanceToTarget(x,y,tx,ty){return Math.hypot(x-tx,y-ty);}
