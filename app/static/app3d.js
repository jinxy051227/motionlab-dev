import {Laboratory3D} from './lab3d.js';
import {HandVision3D} from './vision3d.js';
import {CHEM,calculateTitration} from './science.js';
import {LampProcedure,tubeGuidance} from './rules.js';
import {EQUIPMENT,taskProgress} from './interaction3d.js';
import {ExperimentEngine,REAGENTS,SCENARIOS} from './experiment-engine.js';
import {CURRICULUM,coverage} from './curriculum.js';
import {LessonDirector,lessonProgress} from './lesson-flow.js';
import {inspectContainer} from './container-inspection.js';
import {initI18n,tr,scenarioLabel,reagentLabel,getLanguage} from './i18n.js';
import {readSession,saveSession} from './lab-session.js';
import {localizeActivityEvent} from './activity-i18n.js';
const $=s=>document.getElementById(s);
const emojis={tube:'🧪',beaker:'⚗️',flask:'⚗️',reagent:'🧴',pipette:'💧',rod:'🥢',thermometer:'🌡️',rack:'▤',lamp:'🔥',burette:'📏'};
initI18n();
let lab,vision,mode='guided',cameraOn=false,microActive=true,volumeMl=0,baseMl=0,goggles=false,lamp=new LampProcedure(),selected=null;
const startupSession=readSession();let sessionRestored=false,lastSessionSave=0;
let activeScenario=startupSession?.scenario||'neutralization',models=new Map(),lastThermalNotice=20,microClock=0;
let director=null,microSeen=false,autoDemoUsed=false,autoHeatSeconds=0;
const reactor=()=>lab?.getReceiver();
const activeModel=()=>{const ent=reactor();return ent?(models.get(ent.id)??null):null;};
const events=[];
function log(text,kind='info'){
 const entry={at:new Date().toLocaleTimeString(getLanguage()==='ja'?'ja-JP':getLanguage()==='en'?'en-US':'zh-CN',{hour12:false}),text,kind};events.unshift(entry);if(events.length>80)events.pop();renderLog();
}
function renderLog(){const root=$('events');root.replaceChildren();for(const v of events.slice(0,22)){const div=document.createElement('div');div.className='event '+v.kind;const time=document.createElement('small');time.textContent=v.at;const tx=document.createElement('span');tx.textContent=localizeActivityEvent(v.text);div.append(time,tx);root.append(div);}if(!events.length)root.textContent='实验记录将在这里显示。';}
function check(){
 const value=lab?.getEnt([...lab.entities.values()].find(e=>e.type==='tube'&&!e.broken)?.id)?.volume??volumeMl;
 const data=activeModel()?.observe(),eng=activeModel();
 const progress=taskProgress({goggles,volumeMl:value,onRack:lab?.isTubeInRack(),lampRecapped:lamp.state==='recapped',broken:!lab?.entities || ![...lab.entities.values()].some(e=>e.type==='tube'&&!e.broken)});
 const scope=activeScenario;
 const checks=[{id:'goggles',label:'实验前确认模拟护目镜',ok:goggles}];
 const step={
  neutralization:{label:'混合稀盐酸和NaOH，尝试达到pH约7',ok:!!eng&&(eng.reagents.naoh||0)>0&&Math.abs(data?.ph-7)<1.5},
  precipitate:{label:'混合两种溶液并观察白色沉淀',ok:(data?.precipitateG||0)>.0002},
  gas:{label:'完成反应并观察CO₂气泡',ok:(data?.gasMmol||0)>.0002},
  dissolution:{label:'向水中加入食盐并观察离子分散',ok:!!eng&&(eng.reagents.salt||0)>0},
  heating:{label:'通过酒精灯或演示加热使水超过80°C',ok:(data?.temperatureC||20)>=80},
 }[scope];
 if(step)checks.push({id:'reaction',...step});
 if(scope==='heating')checks.push({id:'lamp',label:'完成酒精灯熄灭和复盖流程',ok:lamp.state==='recapped'});
 const task=mode==='guided'?{checks,done:checks.every(c=>c.ok)}:progress;
 const wrap=$('checklist');wrap.replaceChildren();for(const c of task.checks){const line=document.createElement('div');line.className='checkline '+(c.ok?'complete':'');const ico=document.createElement('i');ico.textContent=c.ok?'✓':'';const txt=document.createElement('span');txt.textContent=tr(c.label);line.append(ico,txt);wrap.append(line);}
 $('completeFlag').textContent=mode==='free'?'自由探索不设强制通关，结束后可生成操作记录。':task.done?'本次实验目标达成。可以生成实验报告。':'教学任务：请完成上面对应知识点的练习。';
 return task;
}
let hoveredEntity=null,hoveredPos={x:0,y:0};
const hoverPanel=document.createElement('div');
hoverPanel.className='container-hover-card hidden';hoverPanel.setAttribute('role','tooltip');
hoverPanel.setAttribute('aria-live','off');$('viewport').append(hoverPanel);
function onHover(ent,x=0,y=0){
 hoveredEntity=ent&&lab?.entities.has(ent.id)?ent:null;hoveredPos={x,y};
 const data=inspectContainer(hoveredEntity,hoveredEntity?models.get(hoveredEntity.id):null);
 if(!data){hoverPanel.classList.add('hidden');return;}
 hoverPanel.textContent=[data.title,...data.lines].map(tr).join('\n');
 hoverPanel.style.setProperty('--content-color',data.color);
 const w=$('viewport').clientWidth,h=$('viewport').clientHeight;
 hoverPanel.style.left=Math.min(Math.max(8,x+17),Math.max(8,w-292))+'px';
 hoverPanel.style.top=Math.min(Math.max(8,y+17),Math.max(8,h-210))+'px';
 hoverPanel.classList.remove('hidden');
}
function onSelect(ent){selected=ent;
 $('selectedName').textContent=ent?tr(ent.spec.name):tr('等待选择器材');
 renderSelected();
}
function renderSelected(){if(!selected||!lab?.entities.has(selected.id)){$('selectedDetails').textContent='选中或抓取器材后显示位置、状态、液量等信息。';$('objectState').textContent='待命';return;}
 const preview=inspectContainer(selected,models.get(selected.id));
 const p=selected.body.position,holder=selected.held?'握持中':selected.body.type===2?'固定在器材架':'受重力控制';
 $('selectedDetails').textContent=tr(`类型：${selected.type}\n坐标：(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) m\n${selected.type==='reagent'?`瓶内试剂：${REAGENTS[selected.reagentId]?.name||'未标记'}，剩余 ${(selected.inventoryMl??0).toFixed(2)}mL\n`:''}${['tube','beaker','flask'].includes(selected.type)?`液体体积：${(selected.volume??0).toFixed(2)}mL\n`:''}物理状态：${holder}${preview?'\n'+preview.lines.join('\n'):''}`);
 $('objectState').textContent=selected.broken?'器材破损':selected.held?'已抓住 · 正在跟随手部位置':holder;
}
function gestures(hands,missing){
 $('interactHud').textContent=hands.length?`已识别 ${hands.length} 只手 · 接近目标只提示，必须张手后主动握紧`:'未检测到手部 · 可用鼠标操作';
 for(let i=0;i<2;i++){
  const h=hands[i];if(!h){$(i?'handB':'handA').textContent='未检测';continue;}
  const gesture=h.kind==='power'?'握拳':h.kind==='pinch'?'捏合':h.pose==='open'?'手掌张开':'手势不确定';
  const c=h.candidate?` · ${h.candidate}`:'';
  $(i?'handB':'handA').textContent=h.holding?`${gesture} · 已抓住${h.candidate||'器材'}`:`${gesture}${c} · ${h.armed?'可抓取':'请先张开手'}`;
 }
 $('gripHud').textContent=hands.some(h=>h.holding)?`● ${hands.filter(h=>h.holding).map(h=>`手${h.id+1}抓取中`).join(' / ')}`:'○ 未抓取：靠近不会自动拿起，需主动做握紧手势';
}
function fill(add){
 if(!goggles)log('未确认护目镜就开始加液。','warn');
 const tube=[...lab.entities.values()].find(e=>e.type==='tube'&&!e.broken);
 if(!tube){log('找不到完整试管，请添加试管。','danger');return;}
 const engine=models.get(tube.id)??new ExperimentEngine(activeScenario,tube.capacityMl);
 models.set(tube.id,engine);const result=engine.add('water',add);
 const obs=engine.observe();lab.updateLiquid(tube,obs);volumeMl=obs.volumeMl;
 const guide=tubeGuidance(volumeMl);
 log(`试管加入蒸馏水 ${result.accepted.toFixed(1)}mL，试管液量 ${volumeMl.toFixed(1)}mL。${guide.text}`,guide.level==='danger'?'danger':'info');
 updateChem();check();renderSelected();
}
function lampAction(action){if(action==='light'){if(!goggles){log('请先模拟确认佩戴护目镜。','warn');return;}const ok=lamp.light();lab.setLampLit(ok);log(ok?'酒精灯已点燃。':'请先取下灯帽，并确认当前处于允许点火的状态。',ok?'good':'warn');}
 else{const result=action==='cap'?lamp.cap(performance.now()):lamp.uncap(performance.now());if(result.ok){if(action==='cap'){lab.setLampLit(false);lab.setLampCapState(true);}else if(action==='uncap')lab.setLampCapState(false,{placeSafely:true});}log(result.message,result.ok?'good':'warn');}
 check();}
function refillTools(){const root=$('tools');root.replaceChildren();const allow=new Set(SCENARIOS[activeScenario]?.equipment??['tube','beaker','rack','lamp']);for(const [type,spec] of Object.entries(EQUIPMENT)){
  const b=document.createElement('button');b.className='tool';b.disabled=mode==='guided'&&!allow.has(type);b.title=b.disabled?'本教学任务不需要该器材；切换自由探索可以使用':`在实验台添加${spec.name}`;
  const icon=document.createElement('span');icon.textContent=emojis[type];const text=document.createTextNode(tr(spec.name));b.append(icon,text);b.addEventListener('click',()=>{const ent=lab.spawn(type);lab.select(ent);log(`从器材架取出：${spec.name}。`,'good');check();});root.append(b);
 }}
function makeModel(ent){let model=models.get(ent.id);if(!model){model=new ExperimentEngine(activeScenario,ent.capacityMl);models.set(ent.id,model);}return model;}
function setupExperiment(){
 models=new Map();lastThermalNotice=20;
 const scene=SCENARIOS[activeScenario],target=reactor();
 if(target){
  let model=makeModel(target);for(const starter of scene.starters)model.add(starter.reagent,starter.ml);
  if(!sessionRestored&&startupSession?.scenario===activeScenario){
   try{model=ExperimentEngine.fromSnapshot(startupSession.engine,target.capacityMl);models.set(target.id,model);}catch{}
  }
  lab.updateLiquid(target,model.observe());
 }
 let bottle=[...lab.entities.values()].find(e=>e.type==='reagent');
 if(!bottle)bottle=lab.spawn('reagent',2.1,.65);
 lab.setReagent(bottle,scene.bottles[0]);lab.updateLiquid(bottle,{});
 const sel=$('reagentSelect');sel.replaceChildren();
 for(const [key,r] of Object.entries(REAGENTS)){
  const item=document.createElement('option');item.value=key;item.textContent=reagentLabel(key);sel.append(item);
 }
 sel.value=scene.bottles[0];
 $('experimentSelect').value=activeScenario;
 $('experimentAbout').textContent=scenarioLabel(activeScenario,'summary');
 $('taskName').textContent=mode==='guided'?scenarioLabel(activeScenario):tr('自由探索记录');
 refillTools();
 $('experimentSteps').textContent='课程阶段：'+scene.year+'　｜　练习步骤：'+scene.steps.map((t,i)=>`${i+1}. ${t}`).join(' → ');
 sessionRestored=true;updateChem();director?.reset(activeScenario);microSeen=false;renderGuide();
 log(`实验切换：${scene.title}。现在液体加入、加热、微观画面使用同一实验状态。`,'good');
}
/** All vessels share the same material-accounting engine; transfer is not a visual-only animation. */
function onPour(source,target,requested){
 if(!source||!target||source.id===target.id||!['tube','beaker','flask'].includes(target.type))return {accepted:0};
 const engine=makeModel(target),before=engine.observe();let result;
 if(source.type==='reagent'){
  if(!source.reagentId)return {accepted:0};
  result=engine.add(source.reagentId,requested);
 }else if(['tube','beaker','flask'].includes(source.type)){
  const from=models.get(source.id);if(!from)return {accepted:0};
  const sample=from.drawLiquid(requested);
  result=engine.receiveSample(sample);
  lab.updateLiquid(source,from.observe());
 }else return {accepted:0};
 const after=engine.observe();lab.updateLiquid(target,after);
 if(target.id!==reactor()?.id)lab.setReceiver(target);
 if(result.overflow>.01){lab.makeSpill(target.body.position,result.overflow);log(`${target.spec.name}达到容量上限，超出部分洒出。`,'danger');}
 if(target.id===reactor()?.id)baseMl=engine.reagents.naoh||0;
 if((before.precipitateG<.0002&&after.precipitateG>=.0002)||(before.gasMmol<.0002&&after.gasMmol>=.0002))
   log(`发现新现象：${after.phenomenon}`,'good');
 updateChem();check();renderSelected();if(hoveredEntity)onHover(hoveredEntity,hoveredPos.x,hoveredPos.y);return result;
}
function onSpill(source,amount){
 const engine=models.get(source?.id);if(!engine)return;
 const taken=engine.drawLiquid(amount);lab.updateLiquid(source,engine.observe());
 if(taken.volumeMl>.01)updateChem();
}
function onHeat(ent,dt,heated){
 const model=models.get(ent.id);if(!model)return;
 const before=model.temperatureC;
 const after=model.tick(dt,heated);
 if(Math.floor(before/10)!==Math.floor(model.temperatureC/10))log(`${ent.spec.name}温度已达到约 ${model.temperatureC.toFixed(1)}°C。${after.phenomenon}`,heated?'good':'info');
 lab.updateLiquid(ent,after);if(ent.id===reactor()?.id)updateChem();
}
function demoPour(amount=3){const reagent=selected?.type==='reagent'&&selected.inventoryMl>0?selected.reagentId:$('reagentSelect').value;
 const out=lab.startAssistedPour(reagent,amount);
 if(!out?.ok)log('无法辅助倾倒：'+(out?.reason||'未知错误'),'warn');
 else log(`辅助倾倒已开始：${REAGENTS[reagent].name}，目标 ${out.accepted.toFixed(2)}mL。请观察3D液滴与化学状态的同步变化。`,'good');}
function demoHeating(){
 if(!goggles){log('本演示请先确认佩戴护目镜。','warn');return;}
 const target=reactor();if(!target){log('请先选择接收器。','warn');return;}
 if(!activeModel()){log('目标容器没有实验液体。','warn');return;}
 const model=makeModel(target);
 for(let i=0;i<150;i++)model.tick(.1,true);lab.updateLiquid(target,model.observe());updateChem();
 log(`演示快进15秒：${model.observe().phenomenon}。这是加速学习模型，不能代表真实加热耗时。`,'good');
}
function renderCurriculum(){const root=$('curriculumList');root.replaceChildren();for(const item of CURRICULUM){
 const row=document.createElement('div');row.className='curriculum-item';const title=document.createElement('span');title.textContent=`${tr(`中${item.grade}`)} · ${tr(item.topic)}`;
 const flag=document.createElement('strong');flag.textContent=item.status==='implemented'?'已建模':'仅课程目录';row.append(title,flag);root.append(row);
 }const c=coverage();$('curriculumDetails').querySelector('summary').textContent=`初中课程目录：${c.total}项；实际可运行${c.implemented}项，其他${c.catalog}项仅资料`;
}
function switchMode(next){director?.reset(activeScenario);microSeen=false;autoDemoUsed=false;mode=next;cameraOn&&vision?.stop();cameraOn=false;$('cameraToggle').textContent='开启摄像头 · MediaPipe';$('cameraStage').textContent='📷 开启摄像头';$('trackingStatus').textContent='○ 摄像头未开启';displayCameraPreview(false);showTrackingRetry(false);
 lamp.reset();volumeMl=0;baseMl=0;goggles=false;$('goggles').checked=false;lab.reset(next);$('modeGuided').classList.toggle('active',next==='guided');$('modeFree').classList.toggle('active',next==='free');$('taskName').textContent=next==='guided'?'试管基础操作':'自由探索记录';$('toolsInfo').textContent=next==='guided'?'教学模式只开放本次任务有关的器材。':'自由探索可以添加所有已建模的实验器材。';refillTools();setupExperiment();check();updateChem();log(next==='guided'?'切换到教学任务。':'切换到自由探索。');}
function displayCameraPreview(show){
 $('showCam').checked=show;
 $('camPreview').classList.toggle('hidden',!show);
}
function showTrackingRetry(visible){$('retryTracking').classList.toggle('hidden',!visible);}
async function toggleCamera(){
 if(cameraOn){
  vision?.stop();lab.releaseCameraHands();cameraOn=false;displayCameraPreview(false);showTrackingRetry(false);
  $('cameraToggle').textContent='开启摄像头 · MediaPipe';$('cameraStage').textContent='📷 开启摄像头';$('trackingStatus').textContent='○ 摄像头已关闭';return;
 }
 $('cameraToggle').disabled=true;$('cameraStage').disabled=true;
 try{
  if(!vision)vision=new HandVision3D($('camVideo'),{
   onHands:(hands,missing)=>lab.updateHands(hands,missing),
   onStatus:t=>{$('trackingStatus').textContent=t;},
   onQuality:quality=>{const t=quality.warning;const q=$('quality');q.classList.toggle('warn',!!t);q.textContent=t?`${t}。建议调整光源或移除产生反光的贴膜。`:`光照情况：平均亮度 ${(quality.mean*100).toFixed(0)}%；过曝像素 ${(quality.overexposed*100).toFixed(1)}%。已启用数字对比度校正和手势平滑。`;},
  });
  // Make the live preview visible while obtaining permission and loading AI.
  displayCameraPreview(true);
  const result=await vision.start();
  cameraOn=vision.running;
  if(cameraOn){
   $('cameraToggle').textContent='关闭摄像头';$('cameraStage').textContent='📷 关闭摄像头';
   showTrackingRetry(!result.trackingReady);
   if(result.trackingReady)log('摄像头和手部识别模型已启动。画面仅在本机处理。','good');
   else{
    $('quality').textContent='摄像头权限与预览已成功，但手部识别模型加载失败：'+result.error+'。可以保持画面并点击「重试手势识别」。';
    log('摄像头已开启，但手部识别模型失败。请查看摄像头状态，并尝试重试。','warn');
   }
  }
 }catch(error){
  vision?.stop();lab.releaseCameraHands();cameraOn=false;displayCameraPreview(false);showTrackingRetry(false);
  $('cameraToggle').textContent='开启摄像头 · MediaPipe';$('cameraStage').textContent='📷 开启摄像头';
  $('trackingStatus').textContent='摄像头启动失败';
  $('quality').textContent='无法开启摄像头：'+error.message+'。也可以使用「摄像头自检」检查浏览器权限。';
  log('摄像头启动失败：'+error.message,'warn');
 }finally{$('cameraToggle').disabled=false;$('cameraStage').disabled=false;}
}
async function retryTracking(){
 if(!cameraOn||!vision?.running){log('请先开启摄像头','warn');return;}
 $('retryTracking').disabled=true;
 try{
  const result=await vision.retryTracking();
  showTrackingRetry(!result.trackingReady);
  if(result.trackingReady){$('quality').textContent='手部识别已就绪。请将双手移入镜头，虚拟手将出现在实验台中。';log('MediaPipe手部模型重新连接成功。','good');}
  else{$('quality').textContent='重试失败：'+result.error+'。摄像头预览仍然可用。';}
 }finally{$('retryTracking').disabled=false;}
}
function updateChem(){
 const model=activeModel(),obs=model?.observe();
 if(model&&Date.now()-lastSessionSave>350){saveSession(activeScenario,model);lastSessionSave=Date.now();}
 for(const id of ['addBase005','addBase05','resetBase'])$(id).disabled=activeScenario!=='neutralization';
 $('baseVol').textContent=model?(model.reagents.naoh||0).toFixed(2)+' mL':'—';
 $('phValue').textContent=model?.scenario==='neutralization'?obs.ph.toFixed(2):'—';
 $('scienceObservation').textContent=obs?`${tr(obs.phenomenon)}\n温度 ${obs.temperatureC.toFixed(1)}°C　·　液体 ${obs.volumeMl.toFixed(2)}mL\n${obs.notes.map(tr).join('\n')}`:'请先选择实验并放置接收容器。';
}
function addBase(d){
 const target=reactor();if(!target)return;
 let src=[...lab.entities.values()].find(e=>e.type==='reagent'&&e.reagentId==='naoh');
 if(!src){src=lab.spawn('reagent');lab.setReagent(src,'naoh');}
 if(src.inventoryMl<d){log('试剂瓶中液体不足。','warn');return;}
 src.inventoryMl-=d;lab.updateLiquid(src,{});onPour(src,target,d);lab.showPourStream(src,target,d);
 log(`通过滴定管快捷入口加入NaOH ${d}mL（与3D容器共用化学状态）。`,'info');
}
function drawMicro(t){
 if(!microActive)return;
 const canvas=$('microCanvas'),ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#071922';ctx.fillRect(0,0,w,h);
 const model=activeModel(),s=model?.observe();
 if(!s){ctx.fillStyle='#d2eae9';ctx.font='17px system-ui';ctx.fillText(tr('请先选择一个实验容器并加入试剂。'),25,45);requestAnimationFrame(drawMicro);return;}
 $('microPhenomenon').textContent=tr(s.phenomenon)+' · '+tr('微观图像随当前容器物质和温度同步变化；粒子数量按权重缩放，仅用于概念教学。');
 ctx.fillStyle='#e0fff8';ctx.font='bold 12px system-ui';ctx.fillText(scenarioLabel(s.scenario).slice(0,24),12,19);ctx.font='11px system-ui';ctx.fillText(s.temperatureC.toFixed(1)+'°C · '+s.volumeMl.toFixed(2)+'mL'+(s.scenario==='neutralization'?' · pH '+s.ph.toFixed(2):''),12,37);
 const parts=[];const weights=s.micro.map(p=>Math.sqrt(Math.max(0,p.weight)));const total=weights.reduce((a,b)=>a+b,0)||1;
 for(let j=0;j<s.micro.length;j++){
  const p=s.micro[j];const count=Math.min(8,Math.max(1,Math.round(weights[j]/total*28)));
  for(let k=0;k<count;k++)parts.push({label:p.label,color:p.color,id:j*50+k});
 }
 if(parts.length===0){ctx.fillStyle='#aac1c9';ctx.font='15px system-ui';ctx.fillText(tr('此阶段没有可视化的离子或分子。'),20,70);}
 for(let i=0;i<parts.length;i++){
  if(i>=30)break;const p=parts[i],cx=28+(i%5)*61+Math.sin(t*.0006+i*1.3)*4;
  const cy=62+Math.floor(i/5)*34+Math.cos(t*.0009+i*1.7)*4;
  if(cy>h-25)continue;
  ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(cx,cy,13,0,Math.PI*2);ctx.fill();
  ctx.font=p.label.length>6?'7px system-ui':'9px system-ui';ctx.fillStyle='#061b22';ctx.textAlign='center';ctx.fillText(p.label,cx,cy+3);
 }
 ctx.textAlign='left';ctx.font='12px system-ui';ctx.fillStyle='#a1bbc1';ctx.fillText(tr('概念示意 · 非真实分子动力学或粒子尺度模拟').slice(0,45),12,h-9);
 requestAnimationFrame(drawMicro);
}
function microOpen(){microSeen=true;renderGuide();const dock=$('microDock');dock.classList.add('micro-pulse');dock.scrollIntoView({behavior:'smooth',block:'nearest'});setTimeout(()=>dock.classList.remove('micro-pulse'),1300);}

async function finish(){const prog=check();const dangers=events.filter(e=>e.kind==='danger').length,warnings=events.filter(e=>e.kind==='warn').length;
 const summary=mode==='guided'?`教学任务：${prog.checks.filter(c=>c.ok).length}/${prog.checks.length} 步完成\n${prog.done?'本次教学任务已完成。':'尚有步骤未达成，不等于实验合格。'}`:'自由模式：未设定统一通关标准。';
 const state=activeModel()?.observe();
 const lang=getLanguage();
 const title=scenarioLabel(activeScenario),phenomenon=tr(state?.phenomenon??'未开始'),observations=state?.notes?.map(tr).join('；')??'';
 const summaryTranslated=lang==='ja'?`学習課題：${prog.checks.filter(c=>c.ok).length}/${prog.checks.length}項目完了。${prog.done?'目標達成。':'未完了の項目があります。'}`:
 lang==='en'?`Guided lesson: ${prog.checks.filter(c=>c.ok).length}/${prog.checks.length} objectives complete. ${prog.done?'Objective achieved.':'Some steps remain incomplete.'}`:summary;
 const local=lang==='ja'?`${summaryTranslated}\n\n実験：${title}\n受け容器：${state?.volumeMl??0}mL・${state?.temperatureC??20}°C\n観察結果：${phenomenon}\n${observations}\n危険な操作：${dangers}件、注意：${warnings}件\nアルコールランプ：${lamp.state==='recapped'?'終了手順完了':'未完了'}\n\nこれは教育用プロトタイプの記録であり、実際の実験技能を認証しません。`:
 lang==='en'?`${summaryTranslated}\n\nExperiment: ${title}\nReceiving vessel: ${state?.volumeMl??0}mL at ${state?.temperatureC??20}°C\nObservation: ${phenomenon}\n${observations}\nHazard events: ${dangers}; Warnings: ${warnings}\nAlcohol lamp procedure: ${lamp.state==='recapped'?'completed':'incomplete'}\n\nEducational prototype only; this is not a certification of practical laboratory ability.`:
 `${summary}\n\n当前实验：${title}\n当前容器：${state?.volumeMl??0} mL，${state?.temperatureC??20}°C\n实验现象：${phenomenon}\n${observations}\n已记录风险事件：${dangers} 项；提醒：${warnings} 项\n酒精灯流程：${lamp.state==='recapped'?'已完成':'未完成'}\n\n这是一份教育原型记录，不能认证真实实验操作能力。`;
 $('report').classList.remove('hidden');$('report').textContent=local;
 if(state){try{
  const acidBase=activeScenario==='neutralization',engine=activeModel();
  const base=engine?.reagents.naoh||0;
  const result=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   scenario:activeScenario,language:getLanguage(),volumeMl:acidBase?base:state.volumeMl,ph:acidBase?state.ph:7,
   score:Math.max(0,100-dangers*10),mixingRatio:0,errorMl:acidBase?Math.min(10,Math.abs(base-10)):0,
   temperatureC:state.temperatureC,phenomenon:state.phenomenon,observations:state.notes,
   quickStart:!!director?.status?.completed,notes:events.slice(0,8).map(x=>x.text)
  })});
  const body=await result.json();$('report').textContent+='\n\n'+tr(body.source==='gemini'?'Gemini教学反馈':'本地规则反馈')+':\n'+body.text;
 }catch{$('report').textContent+='\n\n远程教学反馈暂时不可用。';}}

}
// Context-aware Gemini tutor. Camera frames are never uploaded.
async function askGemini3D(){
 const question=$('aiQuestion3d').value.trim();if(question.length<2)return;
 const button=$('aiAsk3d'),box=$('aiAnswer3d');button.disabled=true;box.textContent=tr('正在联系Gemini…');
 const obs=activeModel()?.observe();
 try{
  const res=await fetch('/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   question,scenario:activeScenario,language:getLanguage(),volumeMl:obs?.volumeMl||0,
   ph:obs?.ph??7,temperatureC:obs?.temperatureC??20,phenomenon:obs?.phenomenon||'',observations:obs?.notes||[]})});
  const payload=await res.json();box.textContent=(payload.source==='gemini'?'Gemini: ':'')+(payload.text||tr('AI暂时无法连接，请稍后再试。'));
 }catch{box.textContent=tr('AI暂时无法连接，请稍后再试。');}finally{button.disabled=false;}
}
$('aiAsk3d').onclick=askGemini3D;
fetch('/api/ai/status').then(x=>x.json()).then(x=>{$('aiConnection3d').textContent=x.configured?`Gemini · ${x.provider} · ${x.model}`:tr('尚未连接Gemini；普通实验仍可使用。');}).catch(()=>{$('aiConnection3d').textContent=tr('AI状态暂不可用');});

try{
 lab=new Laboratory3D($('viewport'),{onEvent:log,onSelect,onGesture:gestures,onTransfer:onPour,onSpill,onHeat,onHover});
 $('renderStatus').textContent='● 3D刚体实验室已就绪';$('stageLoading').classList.add('hidden');window.motionLab3DReady=true;
}catch(e){$('stageLoading').innerHTML=`<strong>3D初始化失败：${String(e.message).replaceAll('<','&lt;')}</strong><p>请确认已连接网络；也可以使用顶部经典2D版。</p>`;$('renderStatus').textContent='3D载入失败';throw e;}
// The left guide uses *observed experiment state*; automated steps invoke
// the same chemical engine / animated pouring as manual controls.
function renderGuide(){
 if(!$('lessonSteps')||!lab)return;
 const model=activeModel(),obs=model?.observe();
 const steps=lessonProgress(activeScenario,{goggles,reagents:model?.reagents||{},temperatureC:obs?.temperatureC||20,observed:microSeen});
 const root=$('lessonSteps');root.replaceChildren();const next=steps.findIndex(s=>!s.done);
 steps.forEach((step,i)=>{
  const row=document.createElement('div');row.className='lesson-step '+(step.done?'done':i===next?'current':'');
  const m=document.createElement('span');m.className='marker';m.textContent=step.done?'✓':String(i+1);
  const texts=document.createElement('div'),name=document.createElement('strong'),hint=document.createElement('small');
  name.textContent=tr(step.title);hint.textContent=tr(step.instruction);texts.append(name,hint);row.append(m,texts);root.append(row);
 });
 const state=director?.status;
 $('lessonStatus').textContent=state?.error?'演示中断：'+state.error:state?.running?`正在执行${state.index+1}/${state.count}：${state.current?.title||'收尾'}`:
  state?.paused?'演示暂停。点击继续；手动操作不会被记录为自动完成。':state?.completed?'自动演示完成，可以观察结果或重新开始。':
  next<0?'所有步骤已完成，可以生成实验报告。':'下一步：'+steps[next].instruction;
 $('lessonAuto').textContent=state?.paused?'▶ 继续自动演示':'▶ 一键开始实验 · 自动观察';
 $('lessonPause').disabled=!state?.running;$('lessonNext').disabled=!!state?.running||!!state?.completed;
}
const lessonAdapter={
 start(step){
  autoDemoUsed=true;
  if(step.type==='safety'){
   goggles=true;$('goggles').checked=true;log('自动教学演示：模拟安全确认（不代表检测到真正佩戴护目镜）。','good');check();return true;
  }
  if(step.type==='pour'){
   $('reagentSelect').value=step.reagent;
   const r=lab.startAssistedPour(step.reagent,step.amount);
   if(!r?.ok)return {ok:false,reason:r?.reason||'辅助倒液启动失败'};
   return true;
  }
  if(step.type==='heat'){
   if(activeScenario!=='heating')return {ok:false,reason:'加热只用于加热任务'};
   autoHeatSeconds=0;log('自动演示正在缓慢推进简化加热模型，请观察温度与水量。','good');return true;
  }
  if(step.type==='observe'){
   microOpen();log('自动观察微观视角：粒子来自当前化学状态。','good');return true;
  }
  return false;
 },
 update(step,dt,elapsed){
  if(step.type==='pour')return !lab.assisted && elapsed>.20;
  if(step.type==='heat'){
   const target=reactor(),engine=activeModel();if(!engine||!target)return false;
   const desired=Math.min(15,elapsed*3.8),delta=Math.max(0,desired-autoHeatSeconds);
   if(delta>.0001){engine.tick(delta,true);autoHeatSeconds=desired;lab.updateLiquid(target,engine.observe());updateChem();}
   return autoHeatSeconds>=14.9;
  }
  if(step.type==='observe')return elapsed>=2.0;
  return elapsed>=.75;
 },
 finish(step){log(`自动实验步骤完成：${step.title}。${step.what||''}`,'good');renderGuide();},
 setPaused(p){lab.assistedPaused=!!p;},
 onComplete(){log('自动演示完成。此结果不能用来评定独立实操能力。','good');finish();}
};
director=new LessonDirector(activeScenario,lessonAdapter);
$('lessonAuto').onclick=()=>{if(director.paused){director.play();renderGuide();return;}switchMode('guided');director.play();renderGuide();};
$('lessonPause').onclick=()=>{director.pause();renderGuide();};
$('lessonNext').onclick=()=>{if(director.completed)switchMode('guided');director.next();renderGuide();};
function guideFrame(t){const dt=Math.min(.1,Math.max(0,(t-(guideFrame.last||t))/1000));guideFrame.last=t;director?.tick(dt);requestAnimationFrame(guideFrame);}requestAnimationFrame(guideFrame);
function changePresentation(to){lab.setPresentation(to);for(const [k,id] of Object.entries({desk:'viewDesk',explore:'viewExplore'}))$(id).classList.toggle('active-ctrl',to===k);
 if(to==='desk'){selectTool('grab');$('advancedControls').open=false;}
 else $('advancedControls').open=true;
}
$('viewDesk').onclick=()=>changePresentation('desk');$('viewExplore').onclick=()=>changePresentation('explore');

for(const key of Object.keys(EQUIPMENT)){} // all equipment populated by refillTools
refillTools();renderCurriculum();setupExperiment();check();updateChem();
const exSel=$('experimentSelect');for(const [id,ex] of Object.entries(SCENARIOS)){const opt=document.createElement('option');opt.value=id;opt.textContent=`${tr(ex.year)} · ${scenarioLabel(id)}`;exSel.append(opt);}
exSel.value=activeScenario;exSel.onchange=e=>{activeScenario=e.target.value;switchMode(mode);};
$('demoPour').onclick=()=>demoPour(3);$('demoPourSmall').onclick=()=>demoPour(.5);$('stopPour').onclick=()=>{if(!lab.stopAssistedPour())log('当前没有进行中的辅助倒液。','info');};$('demoHeat').onclick=demoHeating;
$('loadBottle').onclick=()=>{const reagent=$('reagentSelect').value,ent=lab.spawn('reagent');lab.setReagent(ent,reagent);lab.select(ent);log(`取出新试剂瓶：${REAGENTS[reagent].name}。抓住后在接收器上方倾倒。`,'good');};
$('setReceiver').onclick=()=>{if(lab.setReceiver(selected)){makeModel(selected);updateChem();log(`已将${selected.spec.name}设为实验接收容器。`,'good');}else log('请先选中试管、烧杯或锥形瓶。','warn');};
$('modeGuided').onclick=()=>switchMode('guided');$('modeFree').onclick=()=>switchMode('free');
$('cameraToggle').onclick=toggleCamera;$('cameraStage').onclick=toggleCamera;
const dragControls={free:'dragFree',xz:'dragXZ',y:'dragY',z:'dragZ'};
for(const [key,id] of Object.entries(dragControls))$(id).onclick=()=>{
 lab.setDragMode(key);for(const b of Object.values(dragControls))$(b).classList.remove('active-ctrl');$(id).classList.add('active-ctrl');
};
function selectTool(key){
 lab.setTool(key);
 if(lab.presentation==='explore'){$('viewDesk').classList.remove('active-ctrl');$('viewExplore').classList.add('active-ctrl');$('advancedControls').open=true;}
 for(const [k,id] of Object.entries({grab:'toolGrab',view:'toolView',walk:'toolWalk'}))$(id).classList.toggle('active-ctrl',key===k);
 $('walkHint').classList.toggle('hidden',key!=='walk');
}
for(const [key,id] of Object.entries({grab:'toolGrab',view:'toolView',walk:'toolWalk'}))$(id).onclick=()=>selectTool(key);
for(const [key,id] of Object.entries({iso:'viewIso',front:'viewFront',top:'viewTop',side:'viewSide'}))$(id).onclick=()=>{if(lab.tool==='walk')selectTool('view');lab.setView(key);};
$('viewFocus').onclick=()=>{if(!lab.focusSelected())log('请先在器材模式中选中一个器材，再聚焦视角。','warn');};$('retryTracking').onclick=retryTracking;$('showCam').onchange=e=>$('camPreview').classList.toggle('hidden',!e.target.checked);
$('handStability').oninput=e=>{$('handStabilityValue').textContent=lab.setHandStability(e.target.value)+' / 5';};lab.setHandStability(4);
$('calibrate').onclick=()=>{lab.resetHandDepth();if(!cameraOn){log('请先开启摄像头。','warn');return;}vision.state.forEach(v=>{v.filter.reset();v.grip.reset();});log('已清除手部二维平滑和握持状态；不需要调整手与摄像头之间的深度。','good');};
$('fill1').onclick=()=>fill(1);$('fill3').onclick=()=>fill(3);$('lampLight').onclick=()=>lampAction('light');$('lampCap').onclick=()=>lampAction('cap');$('lampUncap').onclick=()=>lampAction('uncap');
$('rack').onclick=()=>{if(!lab.rackTube())log('找不到完整试管与试管架，无法完成归位。','warn');check();};
$('goggles').onchange=e=>{goggles=e.target.checked;log(goggles?'已确认佩戴护目镜（模拟）。':'取消了护目镜确认。',goggles?'good':'warn');check();};
$('addBase005').onclick=()=>addBase(.05);$('addBase05').onclick=()=>addBase(.5);$('resetBase').onclick=()=>{const r=reactor();if(r){models.set(r.id,new ExperimentEngine(activeScenario,r.capacityMl));if(activeScenario==='neutralization')models.get(r.id).add('hcl',10);lab.updateLiquid(r,models.get(r.id).observe());}baseMl=0;updateChem();log('已重置当前容器实验状态。')};
$('microscope').onclick=microOpen;$('help').onclick=()=>$('helpModal').classList.remove('hidden');$('helpClose').onclick=()=>$('helpModal').classList.add('hidden');
$('clearEvents').onclick=()=>{events.length=0;renderLog();};$('resetScene').onclick=()=>switchMode(mode);$('end').onclick=finish;
window.addEventListener('pagehide',()=>saveSession(activeScenario,activeModel()));
requestAnimationFrame(drawMicro); // Permanently visible, never gated behind a modal.
window.addEventListener('motionlab:languagechange',()=>{
 for(const o of $('reagentSelect').options)o.textContent=reagentLabel(o.value);
 for(const o of $('experimentSelect').options)o.textContent=tr(SCENARIOS[o.value].year)+' · '+scenarioLabel(o.value);
 $('experimentAbout').textContent=scenarioLabel(activeScenario,'summary');
 $('taskName').textContent=mode==='guided'?scenarioLabel(activeScenario):tr('自由探索记录');
 $('experimentSteps').textContent=tr('课程阶段：')+tr(SCENARIOS[activeScenario].year)+' | '+SCENARIOS[activeScenario].steps.map((x,i)=>`${i+1}. ${tr(x)}`).join(' → ');
 refillTools();updateChem();renderSelected();check();renderGuide();renderCurriculum();renderLog();if(hoveredEntity)onHover(hoveredEntity,hoveredPos.x,hoveredPos.y);if(!$('report').classList.contains('hidden'))finish();
});
setInterval(()=>{renderSelected();check();renderGuide();},450);
