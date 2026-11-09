/** Deterministic, classroom-scale educational chemistry models.
 * These are scenario-scoped mass/charge/heat approximations, not general thermodynamics,
 * CFD, molecular dynamics or independently validated laboratory safety software.
 */
import {mixtureAppearance} from './liquid-appearance.js';
export const REAGENTS = Object.freeze({
 water:{name:'蒸馏水',kind:'liquid',color:'#e8f8fa',grade:'七年级',hazards:[]},
 hcl:{name:'稀盐酸 0.10 mol/L',kind:'liquid',color:'#e8f8fa',molarity:0.1,hazards:['刺激性；仅虚拟实验']},
 naoh:{name:'稀氢氧化钠 0.10 mol/L',kind:'liquid',color:'#e8f8fa',molarity:0.1,hazards:['腐蚀性；仅虚拟实验']},
 cacl2:{name:'氯化钙溶液 0.10 mol/L',kind:'liquid',color:'#e8f8fa',molarity:0.1,hazards:[]},
 na2co3:{name:'碳酸钠溶液 0.10 mol/L',kind:'liquid',color:'#e8f8fa',molarity:0.1,hazards:['碱性；避免接触眼睛']},
 vinegar:{name:'稀醋酸溶液 0.50 mol/L',kind:'liquid',color:'#e8f8fa',molarity:0.5,hazards:[]},
 nahco3:{name:'碳酸氢钠溶液 0.50 mol/L',kind:'liquid',color:'#e8f8fa',molarity:0.5,hazards:[]},
 brine:{name:'盐水（NaCl 10 g/L）',kind:'liquid',color:'#e8f8fa',gramsPerL:10,hazards:[]},
 indicator:{name:'酚酞指示剂（演示量）',kind:'liquid',color:'#e8f8fa',hazards:['仅供虚拟实验']},
 salt:{name:'氯化钠粉末',kind:'solid',color:'#f1f2f4',gramsPerMlEquivalent:2,hazards:[]},
});
export const VESSEL_CAPACITIES=Object.freeze({tube:20,beaker:50,flask:75});
export const SCENARIOS=Object.freeze({
 neutralization:{title:'酸碱中和与pH',grade:3,domain:'化学',year:'中3',status:'implemented',summary:'稀盐酸与氢氧化钠混合；观察pH、离子与指示剂变化。',source:'MEXT 中学校理科：中和と塩',starters:[{reagent:'hcl',ml:10}],bottles:['naoh','hcl','indicator'],steps:['向容器加入稀盐酸','缓慢加入碱液并混合','查看pH和中和后剩余离子'],equipment:['beaker','flask','tube','reagent','pipette','rod','rack','burette']},
 precipitate:{title:'沉淀生成与质量守恒',grade:2,domain:'化学',year:'中2',status:'implemented',summary:'氯化钙溶液与碳酸钠溶液形成碳酸钙白色沉淀。',source:'MEXT 中学校理科：化学変化と質量',starters:[{reagent:'cacl2',ml:10}],bottles:['na2co3','cacl2'],steps:['加入氯化钙溶液','倒入碳酸钠溶液','观察白色沉淀与离子比例'],equipment:['beaker','flask','tube','reagent','rod','rack']},
 gas:{title:'气体生成：醋酸与碳酸氢钠',grade:1,domain:'化学',year:'中1',status:'implemented',summary:'观察二氧化碳气泡，并理解反应前后物质的变化。',source:'MEXT 中学校理科：気体の発生と性質',starters:[{reagent:'vinegar',ml:12}],bottles:['nahco3','vinegar'],steps:['准备稀醋酸溶液','加入碳酸氢钠溶液','观察CO₂生成与微观示意'],equipment:['beaker','flask','tube','reagent','rod']},
 dissolution:{title:'溶解与饱和',grade:1,domain:'化学',year:'中1',status:'implemented',summary:'向水中加入食盐，查看溶解与过量固体的区别。',source:'MEXT 中学校理科：水溶液',starters:[{reagent:'water',ml:20}],bottles:['salt','water','brine'],steps:['加入水','加入食盐','观察溶质分散、饱和及未溶固体'],equipment:['beaker','flask','tube','reagent','rod','thermometer']},
 heating:{title:'水的加热、沸腾与蒸发',grade:1,domain:'化学/物理',year:'中1',status:'implemented',summary:'把水置于热源附近；观察温度变化、气泡、蒸发与粒子运动。',source:'MEXT 中学校理科：状態変化',starters:[{reagent:'water',ml:25}],bottles:['water'],steps:['准备有水的容器','点燃酒精灯（教学流程）','将容器移至热源附近观察温度和体积变化'],equipment:['beaker','flask','tube','lamp','thermometer','rack']},
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fixed=(x)=>Math.max(0,Number.isFinite(x)?x:0);
const amountOf=(m,k)=>fixed(m[k]||0);
const round=(x,n=3)=>Number(x.toFixed(n));

export class ExperimentEngine{
 constructor(scenario='neutralization',capacityMl=150){this.reset(scenario,capacityMl);}
 reset(scenario='neutralization',capacityMl=150){
  if(!SCENARIOS[scenario])throw Error('未知实验：'+scenario);
  this.scenario=scenario;this.capacityMl=capacityMl;this.reagents={};this.volumeMl=0;this.temperatureC=20;this.evaporationMl=0;this.solidG=0;this.gasMmol=0;this.heatExposure=0;this.history=[];this.indicator=false;return this;
 }
 add(reagent,ml){
  if(!REAGENTS[reagent])throw new Error('未知试剂');
  if(!Number.isFinite(ml)||ml<=0)throw new RangeError('加入量需要大于0');
  const applied=clamp(ml,0,this.capacityMl-this.volumeMl);
  if(applied<=0)return {accepted:0,overflow:ml};
  const beforeReaction=this.scenario==='neutralization'?Math.min(amountOf(this.reagents,'hcl')*.1,amountOf(this.reagents,'naoh')*.1):0;
  this.reagents[reagent]=amountOf(this.reagents,reagent)+applied;
  // Solid aliquots are represented by an equivalent dispenser scale, explicitly not fluid volume.
  if(REAGENTS[reagent].kind==='solid')this.solidG+=applied*(REAGENTS[reagent].gramsPerMlEquivalent||1);
  else this.volumeMl+=applied;
  if(reagent==='indicator')this.indicator=true;
  if(this.scenario==='neutralization'){
   const afterReaction=Math.min(amountOf(this.reagents,'hcl')*.1,amountOf(this.reagents,'naoh')*.1);
   const releaseJ=Math.max(0,afterReaction-beforeReaction)*57; // 57 kJ/mol, 0.1 mol/L input expressed in mmol
   if(this.volumeMl>0)this.temperatureC+=releaseJ/(this.volumeMl*4.18);
  }
  this.history.push({kind:'add',reagent,amount:round(applied)});
  return {accepted:round(applied),overflow:round(ml-applied),observation:this.observe()};
 }
 /** Remove a proportional sample of the liquid mixture. This is a simplified
  * well-mixed aliquot model; insoluble precipitate is NOT suspended automatically. */
 drawLiquid(ml){
  if(!Number.isFinite(ml)||ml<=0||this.volumeMl<=0)return {volumeMl:0,components:{},temperatureC:this.temperatureC};
  const take=Math.min(ml,this.volumeMl),fraction=take/this.volumeMl;
  const components={};
  // Insoluble salt crystals are NOT part of the decanted liquid aliquot.
  // Only dissolved salt is proportionally carried with the liquid sample.
  const dissolvedBefore=this.scenario==='dissolution'?this.observe().dissolvedG:0;
  const saltG=Math.min(this.solidG,dissolvedBefore*fraction);
  for(const [name,amount] of Object.entries(this.reagents)){
   if(REAGENTS[name]?.kind==='solid')continue;
   const portion=amount*fraction;this.reagents[name]=Math.max(0,amount-portion);components[name]=portion;
  }
  if(saltG>0){this.solidG=Math.max(0,this.solidG-saltG);this.reagents.salt=Math.max(0,amountOf(this.reagents,'salt')-saltG/2);}
  this.volumeMl=Math.max(0,this.volumeMl-take);
  this.indicator=amountOf(this.reagents,'indicator')>1e-6;
  this.history.push({kind:'draw',amount:round(take)});
  return {volumeMl:take,components,saltG,temperatureC:this.temperatureC};
 }
 /** Mix one precomputed liquid sample into a second vessel. */
 receiveSample(sample){
  if(!sample?.volumeMl||sample.volumeMl<=0)return {accepted:0,overflow:0};
  const allowed=Math.min(sample.volumeMl,Math.max(0,this.capacityMl-this.volumeMl)),ratio=allowed/sample.volumeMl;
  if(allowed<=0)return {accepted:0,overflow:sample.volumeMl};
  const beforeVol=this.volumeMl;
  for(const [name,amount] of Object.entries(sample.components||{})){
   this.reagents[name]=(this.reagents[name]||0)+amount*ratio;
   if(name==='indicator')this.indicator=true;
  }
  const saltG=Math.max(0,Number(sample.saltG)||0)*ratio;
  if(saltG>0){this.solidG+=saltG;this.reagents.salt=amountOf(this.reagents,'salt')+saltG/2;}
  this.volumeMl+=allowed;
  this.temperatureC=(this.temperatureC*beforeVol+(sample.temperatureC??20)*allowed)/(this.volumeMl);
  this.history.push({kind:'receive',amount:round(allowed)});
  return {accepted:round(allowed),overflow:round(sample.volumeMl-allowed),observation:this.observe()};
 }
 /** Human-readable analytical composition, scoped to the implemented reagents.
  * "Analytical concentration" means moles introduced per current volume, not
  * free-ion activity after reaction (which is reported separately via pH). */
 composition(){
  const volL=this.volumeMl/1000;
  const components=Object.entries(this.reagents).filter(([,v])=>v>1e-8).map(([id,amount])=>{
   const info=REAGENTS[id]||{};
   if(info.kind==='solid')return {id,kind:'solid',amountG:round(this.solidG,5),unit:'g',concentrationMolL:null};
   return {id,kind:'liquid',sourceVolumeMl:round(amount,5),unit:'mL',
    analyticalConcentrationMolL:info.molarity&&volL>0?round(info.molarity*(amount/1000)/volL,5):null};
  });
  return {volumeMl:round(this.volumeMl,5),temperatureC:round(this.temperatureC,2),components,
   ph:this.scenario==='neutralization'?this.observe().ph:null};
 }
 /** Serialisable chemical state for a guided 2D/3D view transition. */
 snapshot(){return {scenario:this.scenario,capacityMl:this.capacityMl,reagents:{...this.reagents},
  volumeMl:this.volumeMl,temperatureC:this.temperatureC,solidG:this.solidG,
  evaporationMl:this.evaporationMl,heatExposure:this.heatExposure};}
 static fromSnapshot(snapshot,capacityOverride=null){
  if(!snapshot||!SCENARIOS[snapshot.scenario])throw new TypeError('Invalid experiment snapshot');
  const cap=Math.max(1,Math.min(1000,Number(capacityOverride??snapshot.capacityMl)||150));
  const e=new ExperimentEngine(snapshot.scenario,cap);
  for(const [id,v] of Object.entries(snapshot.reagents||{}))if(REAGENTS[id]&&Number.isFinite(v)&&v>=0)e.reagents[id]=v;
  e.volumeMl=clamp(Number(snapshot.volumeMl)||0,0,cap);
  e.temperatureC=clamp(Number(snapshot.temperatureC)||20,0,110);
  e.solidG=clamp(Number(snapshot.solidG)||0,0,1000);
  e.evaporationMl=clamp(Number(snapshot.evaporationMl)||0,0,1000);
  e.heatExposure=clamp(Number(snapshot.heatExposure)||0,0,3600);
  e.indicator=amountOf(e.reagents,'indicator')>1e-6;return e;
 }
 loadStarter(){for(const r of SCENARIOS[this.scenario].starters)this.add(r.reagent,r.ml);return this.observe();}
 observe(){
  const a=this.reagents, vol=Math.max(this.volumeMl,.000001);
  const acid=amountOf(a,'hcl')*.1/1000,base=amountOf(a,'naoh')*.1/1000;
  const neutralized=Math.min(acid,base);const excessH=Math.max(0,acid-base);const excessOH=Math.max(0,base-acid);
  let ph=7;const net=(acid-base)/(vol/1000);const kw=1e-14;
  if(this.scenario==='neutralization'){
   const h=net>=0?(net+Math.sqrt(net*net+4*kw))/2:(2*kw)/(Math.sqrt(net*net+4*kw)-net);
   ph=clamp(-Math.log10(h),0,14);
  }
  const ca=amountOf(a,'cacl2')*.1/1000,co3=amountOf(a,'na2co3')*.1/1000;
  const pptMol=Math.min(ca,co3);
  const vinegar=amountOf(a,'vinegar')*.5/1000,bicarb=amountOf(a,'nahco3')*.5/1000;
  const gasMol=Math.min(vinegar,bicarb);
  this.gasMmol=gasMol*1000;
  const saltAdded=this.solidG+amountOf(a,'brine')*.01;
  // Qualitative classroom solubility model: about 35.9 g NaCl/100 g water near 20°C.
  const waterMass=amountOf(a,'water')+amountOf(a,'brine')*.99;
  const satG=waterMass*Math.min(39.2,35.9+(this.temperatureC-20)*.04)/100;
  const dissolvedG=Math.min(saltAdded,satG),unDissolvedG=Math.max(0,saltAdded-dissolvedG);
  let color='#73cee7';let phenomenon='观察溶液与器材的状态';let micro=[];let notes=[];
  if(this.scenario==='neutralization'){
   const ind=clamp((ph-8.3)/1.7,0,1);
   // Final liquid appearance comes from mixtureAppearance below.
   phenomenon=this.indicator?(ind>.12?'指示剂开始呈粉红色':'溶液接近无色'):'离子与pH发生变化（未加入指示剂）';
   micro=[{label:'H₃O⁺',weight:excessH*1e3,color:'#ff9078'},{label:'OH⁻',weight:excessOH*1e3,color:'#81e6ad'},{label:'Na⁺',weight:base*1e3,color:'#72c9f3'},{label:'Cl⁻',weight:acid*1e3,color:'#eecb93'},{label:'H₂O',weight:4+neutralized*1500,color:'#9bdcf1'}];
   notes=[`pH ${ph.toFixed(2)}`,`已中和 ${round(neutralized*1000)} mmol`,`理论等量点需酸碱物质的量相等`];
  }else if(this.scenario==='precipitate'){
   color=pptMol>1e-7?'#dce8e9':'#91d4ec';phenomenon=pptMol>1e-7?'产生白色CaCO₃沉淀':'尚未产生可见沉淀';
   micro=[{label:'Ca²⁺',weight:(ca-pptMol)*1000,color:'#92adf1'},{label:'CO₃²⁻',weight:(co3-pptMol)*1000,color:'#d9b9f4'},{label:'CaCO₃↓',weight:pptMol*1000,color:'#f1f3f5'},{label:'Na⁺',weight:co3*2000,color:'#72c9f3'},{label:'Cl⁻',weight:ca*2000,color:'#eecb93'}];
   notes=[`碳酸钙沉淀 ${(pptMol*100.0869).toFixed(3)} g`,`Ca²⁺ + CO₃²⁻ → CaCO₃(s)`];
  }else if(this.scenario==='gas'){
   color='#dfd1a5';phenomenon=gasMol>1e-7?'观察到模拟CO₂气泡':'还没有生成明显气体';
   micro=[{label:'CH₃COOH',weight:Math.max(0,vinegar-gasMol)*1000,color:'#ffcf8e'},{label:'HCO₃⁻',weight:Math.max(0,bicarb-gasMol)*1000,color:'#a7bdf8'},{label:'CO₂↑',weight:gasMol*1000,color:'#fbedd7'},{label:'H₂O',weight:3+gasMol*500,color:'#9bdcf1'}];
   notes=[`CO₂生成量 ${round(gasMol*1000)} mmol`,`这是简化的净反应教学模型`];
  }else if(this.scenario==='dissolution'){
   color=unDissolvedG>0?'#b5d0e2':'#77c9e9';phenomenon=unDissolvedG>.01?'达到模拟溶解上限，仍有未溶固体':'食盐作为离子分散在水中';
   micro=[{label:'Na⁺(aq)',weight:dissolvedG*1.2,color:'#72c9f3'},{label:'Cl⁻(aq)',weight:dissolvedG*1.2,color:'#eecb93'},{label:'NaCl(s)',weight:unDissolvedG*1.2,color:'#efefed'},{label:'H₂O',weight:5,color:'#9bdcf1'}];
   notes=[`溶解 ${(dissolvedG).toFixed(2)} g`,`未溶 ${(unDissolvedG).toFixed(2)} g`,`溶解量受水量和温度影响`];
  }else if(this.scenario==='heating'){
   color=this.temperatureC>90?'#b1dce6':'#75cce8';phenomenon=this.temperatureC>=98?'模拟沸腾/蒸气产生':this.temperatureC>=45?'水正在升温':'水温接近室温';
   micro=[{label:'H₂O(l)',weight:Math.max(1,this.volumeMl*.35),color:'#82d4f2'},{label:'H₂O(g)',weight:Math.max(0,this.evaporationMl)*5,color:'#e6faff'}];
   notes=[`温度 ${this.temperatureC.toFixed(1)}°C`,`累计蒸发 ${this.evaporationMl.toFixed(2)} mL`,`能量输入会加快粒子运动（教学示意）`];
  }
  const appearance=mixtureAppearance({scenario:this.scenario,indicator:this.indicator,ph,precipitateG:pptMol*100.0869,undissolvedG:unDissolvedG});
  color=appearance.color;
  return {scenario:this.scenario,volumeMl:round(this.volumeMl),temperatureC:round(this.temperatureC,1),ph:round(ph,2),neutralizedMmol:round(neutralized*1000),precipitateG:round(pptMol*100.0869,4),gasMmol:round(gasMol*1000),dissolvedG:round(dissolvedG),undissolvedG:round(unDissolvedG),evaporationMl:round(this.evaporationMl),color,opacity:appearance.opacity,appearance:appearance.label,phenomenon,micro:micro.filter(p=>p.weight>1e-8),notes};
 }
 tick(dt,heated=false){
  if(!Number.isFinite(dt)||dt<=0)return this.observe();dt=Math.min(dt,.1);
  const init=this.temperatureC;
  if(heated){this.heatExposure+=dt;this.temperatureC=clamp(this.temperatureC+dt*10.5,20,100);}
  else this.temperatureC=Math.max(20,this.temperatureC-dt*0.28);
  if(this.temperatureC>=99&&heated&&this.volumeMl>0){
   const loss=Math.min(this.volumeMl,dt*.22);
   this.volumeMl-=loss;this.evaporationMl+=loss;
   this.reagents.water=Math.max(0,amountOf(this.reagents,'water')-loss);
  }
  if(Math.floor(init/5)!==Math.floor(this.temperatureC/5))this.history.push({kind:'temperature',c:round(this.temperatureC,1)});
  return this.observe();
 }
}
