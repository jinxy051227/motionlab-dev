/** MotionLab's explicitly scoped SOP rules. Educational model, not a replacement for real supervision.
 * Rule sources and applicability are documented in README.md.
 */
export const RULES = Object.freeze([
  {id:'ppe', domain:'general', title:'进入实验前穿戴护目镜', severity:'critical', applicability:'本模拟所有实验', source:'实验室通用防护概念'},
  {id:'tube_fill_max', domain:'tube', title:'加热前液体不超过试管容量约四分之一', severity:'critical', applicability:'本模块的试管液体加热', source:'文部科学省：理科編集資料（1年）p.124'},
  {id:'tube_fill_target', domain:'tube', title:'按本次练习目标加到15%—25%', severity:'guidance', applicability:'本练习的目标区间；15%并非通用安全下限', source:'演示任务设计'},
  {id:'tube_grip', domain:'tube', title:'取起试管后持续握持，放下时使用试管架', severity:'critical', applicability:'易碎玻璃器具', source:'本模拟的重力/碰撞反馈'},
  {id:'tube_point', domain:'tube', title:'加热时试管口不能朝向人', severity:'critical', applicability:'试管加热', source:'文部科学省：理科編集資料（1年）p.124'},
  {id:'tube_heat', domain:'tube', title:'加热时适量装液、使用沸腾石并小幅移动试管', severity:'critical', applicability:'试管液体加热', source:'文部科学省：理科編集資料（1年）p.124'},
  {id:'lamp_extinguish',domain:'lamp',title:'用灯帽熄灭酒精灯，不吹灭',severity:'critical',applicability:'教学用酒精灯',source:'北海道立理科教育センター'},
  {id:'lamp_recap',domain:'lamp',title:'熄灭后取下一次灯帽，待冷却后重新盖好',severity:'guidance',applicability:'教学用酒精灯',source:'北海道立理科教育センター'},
  {id:'titration_swirl',domain:'titration',title:'滴定时保持轻缓、连续的摇匀',severity:'guidance',applicability:'本酸碱滴定练习',source:'基础滴定操作'},
  {id:'titration_slow',domain:'titration',title:'接近终点时降低滴加流速',severity:'guidance',applicability:'本酸碱滴定练习',source:'基础滴定操作'},
]);
export const TUBE_CAPACITY_ML = 20;
export const TUBE_MAX_HEAT_ML = 5;
export const TUBE_TASK_MIN_ML = 3;
export function tubeGuidance(ml){
  if(!Number.isFinite(ml)||ml<0) throw new RangeError('invalid tube volume');
  if(ml>TUBE_CAPACITY_ML) return {level:'danger',text:'试管已超过最大容量！虚拟液体会溢出。'};
  if(ml>TUBE_MAX_HEAT_ML+1e-8) return {level:'danger',text:'本试管加热练习液量超过约1/4，存在喷溅风险。'};
  if(ml<TUBE_TASK_MIN_ML-1e-8) return {level:'guide',text:'当前少于本次演示目标3mL；这是练习目标，并非通用安全下限。'};
  return {level:'ok',text:'装液量符合本次练习目标（3—5mL）。'};
}
/** Alcohol lamp teaching sequence. Simulated cooling interval is NOT a real-world safety time. */
export class LampProcedure {
  constructor(){this.state='capped';this.cooldownUntil=0;}
  light(){if(this.state!=='unlit')return false;this.state='lit';return true;}
  cap(now){
    if(this.state==='lit'){this.state='extinguished_first_cap';return {ok:true,message:'灯帽第一次盖上，火已熄灭。下一步：取下灯帽。'};}
    if(this.state==='cooling' && now>=this.cooldownUntil){this.state='recapped';return {ok:true,message:'已待模拟冷却后再次盖好灯帽。完成正确流程。'};}
    if(this.state==='cooling')return {ok:false,message:'请等待模拟冷却结束，再盖上灯帽。'};
    return {ok:false,message:'当前步骤不允许盖帽。先点燃或先取下第一次盖的帽。'};
  }
  uncap(now){
    if(this.state==='capped'||this.state==='recapped'){this.state='unlit';return {ok:true,message:'已安全取下灯帽并放在台面上，可以在做好防护后点燃。'};}
    if(this.state==='extinguished_first_cap') {this.state='cooling';this.cooldownUntil=now+2200;return {ok:true,message:'第一次盖帽后已取下。待模拟冷却再盖第二次（非真实冷却时间）。'};}
    return {ok:false,message:'当前无需取下灯帽。'};
  }
  reset(){this.state='capped';this.cooldownUntil=0;}
}
