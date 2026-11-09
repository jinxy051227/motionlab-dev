/** Read-only, shared inspection formatting for 2D and 3D hover cards. */
import {REAGENTS} from './experiment-engine.js';
import {reagentAppearance,mixtureAppearance} from './liquid-appearance.js';
const n=(v)=>Number.isFinite(Number(v))?Number(v).toFixed(2):'—';
export function inspectContainer(ent,model){
 if(!ent)return null;
 const title=ent.spec?.name||ent.name||'容器';
 if(ent.type==='reagent'){
  const info=REAGENTS[ent.reagentId],look=reagentAppearance(ent.reagentId);
  return {title,lines:[`内容物：${info?.name||'未标记试剂'}`,`剩余量：${n(ent.inventoryMl)} ${info?.kind==='solid'?'模拟投料刻度':'mL'}`,`外观：${look.label}`,...(info?.molarity?[`标称浓度：${info.molarity} mol/L`]:[])],color:look.color};
 }
 if(['pipette','burette'].includes(ent.type))return {title,lines:['该器材的内部液量尚未建模','仅可模拟器材拿取，暂不能读取内容物'],color:CLEAR_COLOR};
 if(ent.type==='lamp')return {title,lines:[`燃料：酒精（教学模拟）`,`剩余量：${n(ent.inventoryMl)} mL`,`外观：${reagentAppearance('alcohol').label}`,`灯帽：${ent.capAttached?'已盖':'已取下'}`,`火焰：${ent.flame?.visible?'已点燃':'未点燃'}`],color:CLEAR_COLOR};
 if(['tube','beaker','flask'].includes(ent.type)){
  const obs=model?.observe?.();const volume=obs?.volumeMl??ent.volume??0;
  const parts=Object.entries(model?.reagents||{}).filter(([,v])=>Number(v)>0.001).map(([id,v])=>`${REAGENTS[id]?.name?.split('（')[0]?.split(' 0.')[0]||id} ${n(v)} ${REAGENTS[id]?.kind==='solid'?'单位(模拟)':'mL'}`);
  const look=obs?mixtureAppearance({scenario:obs.scenario,indicator:model?.indicator,ph:obs.ph,precipitateG:obs.precipitateG,undissolvedG:obs.undissolvedG}):reagentAppearance('water');
  const analytical=model?.composition?.().components.filter(x=>x.analyticalConcentrationMolL!==null&&x.analyticalConcentrationMolL!==undefined).map(x=>`${REAGENTS[x.id]?.name?.split(' 0.')[0]||x.id}: ${x.analyticalConcentrationMolL.toFixed(4)} mol/L`)||[];
  return {title,lines:[`液量：${n(volume)} / ${n(ent.capacityMl)} mL`,`内容物：${parts.length?parts.join(' + '):'空容器'}`,...(obs?[`温度：${n(obs.temperatureC)} °C`]:[]),...(obs?.scenario==='neutralization'?[`pH（教学模型）：${n(obs.ph)}`]:[]),`外观：${volume>0?look.label:'空容器'}`,...(analytical.length?[`来源物质的分析浓度：${analytical.join('；')}（不等于反应后游离离子浓度）`]:[]),...(obs?.precipitateG>.0002?[`白色沉淀：${n(obs.precipitateG)} g`]:[]),...(obs?.undissolvedG>.01?[`未溶食盐：${n(obs.undissolvedG)} g`]:[])],color:look.color};
 }
 return null;
}
const CLEAR_COLOR='#e8f8fa';
export function inspect2D(which,{scenario,model,reagentId,inventoryMl}){
 if(which==='bottle'){
  const info=REAGENTS[reagentId],look=reagentAppearance(reagentId);
  return {title:'试剂瓶',lines:[`内容物：${info?.name||'未知'}`,`剩余量：${n(inventoryMl)} ${info?.kind==='solid'?'模拟投料刻度':'mL'}`,`外观：${look.label}`,...(info?.molarity?[`浓度：${info.molarity} mol/L`]:[])],color:look.color};
 }
 if(which==='beaker'){
  const obs=model?.observe?.();if(!obs)return null;
  return inspectContainer({spec:{name:'实验容器'},type:'beaker',volume:obs.volumeMl,capacityMl:model.capacityMl},model);
 }
 if(which==='heater')return {title:'虚拟热源',lines:['热源不是盛液容器','该模式仅模拟加热；酒精灯燃料请在3D模式查看'],color:CLEAR_COLOR};
 return null;
}
