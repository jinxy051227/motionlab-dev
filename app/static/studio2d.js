import {ExperimentEngine,SCENARIOS,REAGENTS} from './experiment-engine.js';
import {AssistedPour,canTransfer,distanceToTarget,limit} from './assisted-transfer.js';
import {HandVision3D} from './vision3d.js';
import {SmoothPointer2D} from './ergonomics.js';
import {LessonDirector,lessonProgress} from './lesson-flow.js';
import {reagentAppearance} from './liquid-appearance.js';
import {inspect2D} from './container-inspection.js';
import {initI18n,tr,scenarioLabel,reagentLabel,getLanguage} from './i18n.js';
import {readSession,saveSession} from './lab-session.js';
initI18n();
const $=id=>document.getElementById(id);
const canvas=$('world'),ctx=canvas.getContext('2d'),micro=$('microCanvas'),mc=micro.getContext('2d');
const W=canvas.width,H=canvas.height,home={x:245,y:342},snap={x:635,y:158},vessel={x:635,y:350};
const initialSession=readSession();let initialRestored=false,lastSessionSave=0;
let scenario=initialSession?.scenario||'neutralization',model,selectedReagent,inventory=60,addedThisRun=0,aligned=false,heating=false,vision=null,cameraOn=false,mouseHeld=false,cameraHeld=false,handPointer=null;
let bottle={...home},pour=null,pourAnimation=new AssistedPour({rateMlPerSec:3}),lastTime=performance.now(),lastUI=0,events=[],lastObservation=null;
let director=null,microSeen=false,heatSimSeconds=0,autoplayFinished=false,handBottleOffset=null;
let hovered2D=null,hoverX=0,hoverY=0;
const tooltip2D=document.createElement('div');tooltip2D.className='vessel-tooltip hidden';tooltip2D.setAttribute('role','tooltip');canvas.parentElement.append(tooltip2D);
const cameraPointerFilter=new SmoothPointer2D({alpha:.28,deadZone:.012});
const s=()=>model.observe();
function say(msg){events.unshift({text:msg,time:new Date().toLocaleTimeString(getLanguage()==='ja'?'ja-JP':getLanguage()==='en'?'en-US':'zh-CN',{hour12:false})});events=events.slice(0,35);$('trace').replaceChildren();for(const e of events.slice(0,9)){const p=document.createElement('p');p.textContent=`${e.time}  ${tr(e.text)}`;$('trace').append(p)}}
function status(text){$('stageStatus').textContent=text;}
function format(n,d=2){return Number(n).toFixed(d);}
function reset(){director?.reset(scenario);microSeen=false;autoplayFinished=false;heatSimSeconds=0;pourAnimation.cancel();pour=null;aligned=false;mouseHeld=false;cameraHeld=false;handBottleOffset=null;heating=false;addedThisRun=0;inventory=60;bottle={...home};model=new ExperimentEngine(scenario,150);model.loadStarter();
 if(!initialRestored&&initialSession?.scenario===scenario){try{model=ExperimentEngine.fromSnapshot(initialSession.engine,150);}catch{}}
 initialRestored=true;lastObservation=s();$('lamp').textContent='♨ 开启加热';$('reportText').hidden=true;say('已准备新实验：'+SCENARIOS[scenario].title);refresh();renderGuide();}
function setup(){const sc=$('scenario');for(const [id,o] of Object.entries(SCENARIOS)){const op=document.createElement('option');op.value=id;op.textContent=`${tr(`中${o.grade}`)} · ${scenarioLabel(id)}`;sc.append(op);}sc.value=scenario;
 sc.onchange=()=>{scenario=sc.value;setupReagents();reset()};setupReagents();reset();}
function setupReagents(){const sel=$('reagent');sel.replaceChildren();for(const id of SCENARIOS[scenario].bottles){const op=document.createElement('option');op.value=id;op.textContent=reagentLabel(id);sel.append(op);}selectedReagent=sel.value;sel.onchange=()=>{selectedReagent=sel.value;inventory=60;addedThisRun=0;aligned=false;bottle={...home};pourAnimation.cancel();pour=null;say('拿起 '+REAGENTS[selectedReagent].name+' 试剂瓶');refresh()};$('description').textContent=scenarioLabel(scenario,'summary');}
function refresh(){const obs=s();if(Date.now()-lastSessionSave>350){saveSession(scenario,model);lastSessionSave=Date.now();}$('liveTitle').textContent=scenarioLabel(scenario);$('volume').textContent=format(obs.volumeMl)+' mL';$('temperature').textContent=format(obs.temperatureC,1)+' °C';$('ph').textContent=scenario==='neutralization'?format(obs.ph):'—';$('inventory').textContent=format(inventory)+' mL';$('poured').textContent=format(addedThisRun)+' mL';$('phenomenon').textContent=tr(obs.phenomenon)+' · '+obs.notes.map(tr).join('；');$('microDescription').textContent=`微观视图依据当前容器状态更新：${obs.notes.map(tr).join('；')}（示意粒子，非真实分子动力学）`;renderGuide();}
function align(){if(pourAnimation.active){status('正在倾倒，请先停止或等待结束');return;}aligned=true;bottle={...snap};status('✔ 已对准！选择「滴入0.5mL」或「倒入3mL」；可以随时停止。');say('系统辅助将瓶口对准接收容器（对位辅助不计入实际操作成绩）');}
function beginPour(requested){if(pourAnimation.active){status('正在倾倒，完成后可继续');return false;}
 if(!$('goggles').checked){status('请先确认模拟佩戴护目镜再进行实验');say('安全提醒：没有确认护目镜');return false;}
 if(!aligned)align();
 const validated=canTransfer({inventoryMl:inventory,requestedMl:requested,capacityRemainingMl:model.capacityMl-model.volumeMl});
 if(!validated.ok){status(validated.reason);say(validated.reason);return false;}
 pourAnimation.start(validated.accepted);pour={reagent:selectedReagent,requested,started:performance.now()};
 status(`正在缓慢倒入 ${REAGENTS[selectedReagent].name}，实时观察液流和实验数据…`);
 return true;
}
function finishPour(){if(!pour)return;
 const added=pourAnimation.delivered,from=pour.reagent;
 say(`已向容器加入${REAGENTS[from].name} ${format(added)} mL；${s().phenomenon}`);
 pour=null;status('✔ 已完成本次倒液。可以继续加入，或者打开微观观察。');refresh();}
function step(dt){if(pourAnimation.active && !(director?.paused)){const amt=pourAnimation.step(dt);if(amt>0){const result=model.add(pour.reagent,amt);inventory-=result.accepted;addedThisRun+=result.accepted;}if(!pourAnimation.active)finishPour();}
 if(heating && !(director?.running && director.current?.type==='heat')){model.tick(Math.min(dt,.1),true);}
}
function stop(){const prior=pourAnimation.delivered;pourAnimation.cancel();if(pour){say(`手动停止倒液，已加入 ${format(prior)} mL`);pour=null;}status('倾倒已停止，可以继续或放回试剂瓶。');refresh();}
function drawFloor(){const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#0a202c');grad.addColorStop(1,'#123744');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#173f4d';ctx.fillRect(0,439,W,96);ctx.strokeStyle='#3b6670';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,439);ctx.lineTo(W,439);ctx.stroke();
 for(let x=0;x<W;x+=48){ctx.strokeStyle='#31596930';ctx.beginPath();ctx.moveTo(x,440);ctx.lineTo(x,H);ctx.stroke();}
 ctx.fillStyle='#a7dbdd';ctx.font='13px system-ui';ctx.fillText('真实实验需要教师监督 · 操作过程为教学级模拟',25,505);
}
function drawBottle(x,y,tilt=0){ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.shadowColor='#081c2b';ctx.shadowBlur=15;ctx.shadowOffsetY=7;
 ctx.fillStyle='#265560';ctx.strokeStyle='#95d5d5';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-39,-67,78,116,14);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 const fill=Math.max(0,inventory/60);const bottleLook=reagentAppearance(selectedReagent);ctx.fillStyle=bottleLook.color;ctx.globalAlpha=bottleLook.opacity;ctx.fillRect(-33,42-72*fill,66,72*fill);ctx.globalAlpha=1;
 ctx.fillStyle='#a8c9c7';ctx.fillRect(-15,-83,30,20);ctx.fillStyle='#d8e6db';ctx.fillRect(-36,-17,72,46);ctx.fillStyle='#153039';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(selectedReagent.toUpperCase(),0,0);ctx.font='11px system-ui';ctx.fillText(`${Math.round(inventory)} mL`,0,15);ctx.restore();}
function drawBeaker(){const {volumeMl,color,precipitateG,gasMmol,temperatureC}=s();ctx.save();ctx.translate(vessel.x,vessel.y);
 const fillH=volumeMl>0?limit(26+volumeMl*1.10,0,140):0;ctx.beginPath();ctx.moveTo(-82,-90);ctx.lineTo(-72,82);ctx.quadraticCurveTo(0,101,72,82);ctx.lineTo(82,-90);ctx.strokeStyle='#c9f1f0';ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.moveTo(-82,-90);ctx.lineTo(82,-90);ctx.stroke();
 ctx.save();ctx.beginPath();ctx.moveTo(-74,-84);ctx.lineTo(-65,80);ctx.lineTo(65,80);ctx.lineTo(74,-84);ctx.closePath();ctx.clip();ctx.fillStyle=color;ctx.globalAlpha=s().opacity??.23;ctx.fillRect(-78,93-fillH,156,fillH);ctx.globalAlpha=1;
 if(precipitateG>.0001){ctx.fillStyle='#f5f6f3';for(let i=0;i<36;i++){const xx=((i*43)%130)-64,yy=72-((i*17)%Math.max(12,fillH*.6));ctx.beginPath();ctx.arc(xx,yy,2.2,0,7);ctx.fill();}}
 if(gasMmol>.0002||temperatureC>=98){ctx.fillStyle='#d8faffaa';for(let i=0;i<19;i++){const x=Math.sin(i*2.7)*55,y=60-(performance.now()*.04+i*20)%Math.max(40,fillH);ctx.beginPath();ctx.arc(x,y,2+(i%3),0,7);ctx.fill();}}
 ctx.restore();ctx.fillStyle='#d7f1ef';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText(format(volumeMl)+' mL',0,119);ctx.restore();}
function drawHeat(time){ctx.save();ctx.translate(620,432);ctx.fillStyle='#4c8790';ctx.beginPath();ctx.roundRect(-30,-48,60,45,7);ctx.fill();ctx.fillStyle='#9bb7bf';ctx.fillRect(-6,-62,12,18);if(heating){const f=16+Math.sin(time*.02)*7;ctx.fillStyle='#ffbb5a';ctx.beginPath();ctx.moveTo(-13,-63);ctx.quadraticCurveTo(0,-67-f,13,-63);ctx.quadraticCurveTo(0,-43,-13,-63);ctx.fill();}ctx.restore();}
function drawStream(time){if(!pourAnimation.active)return;ctx.save();const x=snap.x+24,y=snap.y-25;
 ctx.strokeStyle=reagentAppearance(selectedReagent).color;ctx.lineWidth=5;ctx.globalAlpha=.75;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+36,160,635,245);ctx.stroke();
 for(let i=0;i<14;i++){const p=((time*.0013+i/14)%1);ctx.fillStyle=reagentAppearance(selectedReagent).color;const bx=x+(635-x)*p+Math.sin(p*Math.PI)*20,by=y+(245-y)*p+15*p*p;ctx.beginPath();ctx.arc(bx,by,4+(i%2),0,7);ctx.fill();}ctx.restore();}
function drawHand(){if(!handPointer)return;ctx.save();const p=handPointer;ctx.strokeStyle=p.held?'#4cf9b9':'#ffc980';ctx.fillStyle=p.held?'#4cf9b92a':'#ffc98025';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,p.held?33:23,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#f9ffec';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(p.held?'抓住试剂瓶':p.pinching?'捏合':'手部光标',p.x,p.y-36);ctx.restore();}
function drawScene(t){drawFloor();const moved=aligned||pourAnimation.active;ctx.fillStyle='#c6edec';ctx.font='bold 18px system-ui';ctx.fillText(scenarioLabel(scenario),28,65);ctx.font='13px system-ui';ctx.fillStyle='#a9ced1';ctx.fillText('虚拟试剂瓶',183,428);ctx.fillText('实验容器',592,495);
 ctx.save();ctx.strokeStyle=aligned?'#54f7b5':'#4d8b95';ctx.setLineDash([8,7]);ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(vessel.x,vessel.y-88,115,28,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
 drawBeaker();drawHeat(t);drawStream(t);drawBottle(bottle.x,bottle.y,pourAnimation.active?-.76:0);drawHand();
 if(aligned){ctx.fillStyle='#8af9d5';ctx.font='bold 14px system-ui';ctx.fillText('✓ 瓶口已对准',555,95);}else{ctx.fillStyle='#9ec9cd';ctx.font='14px system-ui';ctx.fillText('拖动试剂瓶至高亮区域',555,95);}if(pourAnimation.active){ctx.fillStyle='#a7fff0';ctx.fillText(`已倒入 ${format(pourAnimation.delivered)} mL`,510,130);}}
function drawMicro(){const obs=s(),w=micro.width,h=micro.height;mc.fillStyle='#081e28';mc.fillRect(0,0,w,h);mc.font='bold 12px system-ui';mc.fillStyle='#e3f5f3';mc.fillText(tr('当前容器')+': '+tr(obs.phenomenon).slice(0,28),12,23);
 let species=obs.micro.filter(p=>p.weight>1e-8),weights=species.map(p=>Math.sqrt(p.weight)),sum=weights.reduce((a,b)=>a+b,0)||1;let index=0;
 for(let j=0;j<species.length;j++){const p=species[j],count=Math.min(9,Math.max(1,Math.round(weights[j]/sum*30)));for(let k=0;k<count;k++){if(index>=30)break;const x=28+(index%5)*60+Math.sin(performance.now()*.0005+index)*3,y=57+Math.floor(index/5)*35+Math.cos(performance.now()*.0006+index)*4;if(y>h-25)continue;mc.fillStyle=p.color;mc.beginPath();mc.arc(x,y,13,0,7);mc.fill();mc.fillStyle='#05212b';mc.font=p.label.length>6?'7px system-ui':'9px system-ui';mc.textAlign='center';mc.fillText(p.label,x,y+3);index++;}}mc.textAlign='left';mc.font='11px system-ui';mc.fillStyle='#8aafb7';mc.fillText(tr('概念示意 · 非真实分子动力学或粒子尺度模拟').slice(0,45),12,h-9);}
function loop(t){const dt=limit((t-lastTime)/1000,0,.08);lastTime=t;director?.tick(dt);step(dt);drawScene(t);drawMicro();if(t-lastUI>130){refresh();if(hovered2D)updateHover2D();lastUI=t;}requestAnimationFrame(loop)}
function pointerPos(e){const b=canvas.getBoundingClientRect();return{x:(e.clientX-b.left)/b.width*W,y:(e.clientY-b.top)/b.height*H};}
function updateHover2D(){
 const data=inspect2D(hovered2D,{scenario,model,reagentId:selectedReagent,inventoryMl:inventory});
 if(!data){tooltip2D.classList.add('hidden');return;}
 tooltip2D.textContent=[data.title,...data.lines].map(tr).join('\n');
 tooltip2D.style.setProperty('--content-color',data.color);
 const width=canvas.parentElement.clientWidth,height=canvas.getBoundingClientRect().height;
 tooltip2D.style.left=Math.min(Math.max(8,hoverX+14),Math.max(8,width-282))+'px';
 tooltip2D.style.top=Math.min(Math.max(8,hoverY+14),Math.max(8,height-205))+'px';
 tooltip2D.classList.remove('hidden');
}
function onHover2D(e){
 if(mouseHeld){tooltip2D.classList.add('hidden');return;}
 const pos=pointerPos(e),rect=canvas.getBoundingClientRect(),stage=canvas.parentElement.getBoundingClientRect();
 hovered2D=distanceToTarget(pos.x,pos.y,bottle.x,bottle.y)<88?'bottle':Math.abs(pos.x-vessel.x)<91&&Math.abs(pos.y-vessel.y)<104?'beaker':Math.abs(pos.x-620)<32&&Math.abs(pos.y-432)<85?'heater':null;
 hoverX=e.clientX-stage.left;hoverY=e.clientY-stage.top;updateHover2D();
}
function pointerEnd(){if(!mouseHeld)return;mouseHeld=false;
 if(distanceToTarget(bottle.x,bottle.y,snap.x,snap.y)<165){align();}
 else{aligned=false;bottle.y=Math.min(bottle.y,365);say('已放下试剂瓶。尚未对准实验容器。');status('拖动靠近高亮口，或使用「自动对准」按钮。');}}
canvas.addEventListener('pointerdown',e=>{const p=pointerPos(e);if(distanceToTarget(p.x,p.y,bottle.x,bottle.y)<90){mouseHeld=true;canvas.setPointerCapture(e.pointerId);status('已抓取试剂瓶：移动至容器上方，松手会触发辅助对准。')} });
canvas.addEventListener('pointermove',e=>{if(!mouseHeld){onHover2D(e);return;}const p=pointerPos(e);bottle.x=limit(p.x,70,W-70);bottle.y=limit(p.y,105,365);aligned=false;});
canvas.addEventListener('pointerleave',()=>{hovered2D=null;tooltip2D.classList.add('hidden');});
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
function onHands(hands,missing){if(!hands.length){handPointer=null;/* lost tracking is not an intentional release */return;}
 const h=hands[0],smoothed=cameraPointerFilter.update(h.position.x,h.position.y),x=(1-smoothed.x)*W,y=smoothed.y*H;handPointer={x,y,pinching:h.pinching,held:cameraHeld};
 if(h.change==='grab'&&!cameraHeld){
  if(h.gripKind==='power'&&distanceToTarget(x,y,bottle.x,bottle.y)<95){cameraHeld=true;handBottleOffset={x:x-bottle.x,y:y-bottle.y};aligned=false;say('确认握拳动作：已从瓶身抓住试剂瓶');}
  else {status('请先张开手，把虚拟手移到试剂瓶附近，再握拳抓取。');}
 }
 if(cameraHeld){bottle.x=limit(x-(handBottleOffset?.x||0),70,W-70);bottle.y=limit(y-(handBottleOffset?.y||0),100,370);handPointer.held=true;}
 if(h.change==='release'&&cameraHeld){cameraHeld=false;handBottleOffset=null;handPointer.held=false;if(distanceToTarget(x,y,snap.x,snap.y)<180)align();else{aligned=false;say('摄像头明确松开试剂瓶');}}
 $('grip').textContent=cameraHeld?'● 虚拟手已抓住试剂瓶':h.gripKind==='power'?'握拳中':h.gripKind==='pinch'?'捏合中':'手掌张开／未确认';}
async function toggleCamera(){if(cameraOn){vision?.stop();cameraPointerFilter.reset();cameraOn=false;$('camera').textContent='📷 开启摄像头';$('cameraPanel').hidden=true;$('cameraStatus').textContent='摄像头已关闭';return;}
 $('camera').disabled=true;try{if(!vision)vision=new HandVision3D($('cameraVideo'),{onHands,onStatus:t=>$('cameraStatus').textContent=t,onQuality:q=>{if(q.warning)$('cameraStatus').textContent=q.warning;}});
 $('cameraPanel').hidden=false;const r=await vision.start();cameraOn=vision.running;$('camera').textContent='关闭摄像头';if(!r.trackingReady)$('cameraStatus').textContent='画面开启成功；手部模型加载失败：'+r.error;}
 catch(e){$('cameraPanel').hidden=true;$('cameraStatus').textContent=e.message;status('摄像头连接失败，仍可使用鼠标完整体验');}finally{$('camera').disabled=false;}}
$('align').onclick=align;$('pourSmall').onclick=()=>beginPour(.5);$('pourLarge').onclick=()=>beginPour(3);$('stop').onclick=stop;
$('micro').onclick=()=>{microSeen=true;renderGuide();$('microCanvas').closest('.live-micro-2d').classList.add('micro-pulse');say('放大观察：当前容器离子和分子示意随实验状态更新。')};
$('lamp').onclick=()=>{if(!$('goggles').checked){status('模拟实验安全：请先确认护目镜');return;}heating=!heating;$('lamp').textContent=heating?'♨ 停止加热':'♨ 开启加热';say(heating?'开始简化的加热模拟。':'停止加热。');};
$('heatFast').onclick=()=>{if(!$('goggles').checked){status('请先确认护目镜');return;}for(let i=0;i<150;i++)model.tick(.1,true);say('加热模拟快进15秒。');refresh();};
$('camera').onclick=toggleCamera;$('reset').onclick=reset;
function renderLearningReport(){
 const obs=s(),lang=getLanguage(),safe=$('goggles').checked;
 const common={title:scenarioLabel(scenario),reagent:reagentLabel(selectedReagent),added:format(addedThisRun),volume:obs.volumeMl,temp:obs.temperatureC,phenomenon:tr(obs.phenomenon),notes:obs.notes.map(tr).join('；')};
 let report;
 if(lang==='ja')report=`${common.title}\n今回の試薬：${common.reagent}\n合計添加量：${common.added}mL\n観察結果：${common.phenomenon}\n温度：${common.temp}°C／液量：${common.volume}mL\nミクロ観察：${common.notes}\n\n安全確認：${safe?'保護メガネ（模擬）を確認済み':'保護メガネ未確認'}\n補助位置合わせは操作を容易にするもので、実際の器具の手応えや精密な計量技能を保証しません。${autoplayFinished?'\n自動デモを含むため、実技評価には使用できません。':''}`;
 else if(lang==='en')report=`${common.title}\nReagent used: ${common.reagent}\nTotal added: ${common.added}mL\nObserved phenomenon: ${common.phenomenon}\nTemperature: ${common.temp}°C; Volume: ${common.volume}mL\nMicroscopic view: ${common.notes}\n\nSafety: ${safe?'Goggles confirmed (simulated)':'Goggles not confirmed'}\nAssisted alignment simplifies interaction; it does not reproduce real tactile skills or precise measurement.${autoplayFinished?'\nAn auto-demo was used and cannot count as independent practical assessment.':''}`;
 else report=`${common.title}\n本轮加入试剂：${common.reagent}\n累计加入：${common.added}mL\n反应现象：${common.phenomenon}\n温度：${common.temp}°C；液量：${common.volume}mL\n微观：${common.notes}\n\n操作提示：${safe?'已模拟确认护目镜。':'未确认护目镜。'}\n辅助对准仅降低操纵难度，不代表真实器具手感或精准计量技能。${autoplayFinished?'\n本轮包含自动演示或自动单步，不能作为独立实操考核。':''}`;
 const out=$('reportText');out.textContent=report;out.hidden=false;
}
$('report').onclick=renderLearningReport;
// Gemini tutor receives only the current simulated measurements; no webcam images.
$('aiFeedback2d').onclick=async()=>{
 const obs=s(),button=$('aiFeedback2d'),box=$('aiAnswer2d');button.disabled=true;
 box.textContent=tr('正在联系Gemini…');
 const acidBase=scenario==='neutralization',base=model.reagents?.naoh||0;
 try{
  const res=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   scenario,language:getLanguage(),volumeMl:acidBase?base:obs.volumeMl,ph:acidBase?obs.ph:7,
   score:0,mixingRatio:0,errorMl:acidBase?Math.min(10,Math.abs(base-10)):0,
   temperatureC:obs.temperatureC,phenomenon:obs.phenomenon,observations:obs.notes||[],
   notes:events.slice(0,8).map(x=>x.text),quickStart:autoplayFinished})});
  const result=await res.json();box.textContent=(result.source==='gemini'?'Gemini: ':'')+result.text;
 }catch{box.textContent=tr('AI暂时无法连接，请稍后再试。');}finally{button.disabled=false;}
};
$('aiAsk2d').onclick=async()=>{
 const question=$('aiQuestion2d').value.trim();if(question.length<2)return;
 const button=$('aiAsk2d'),box=$('aiAnswer2d');button.disabled=true;box.textContent=tr('正在联系Gemini…');
 const obs=s();try{
  const res=await fetch('/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   question,scenario,language:getLanguage(),volumeMl:obs.volumeMl,ph:obs.ph??7,
   temperatureC:obs.temperatureC,phenomenon:obs.phenomenon,observations:obs.notes||[]})});
  const body=await res.json();box.textContent=(body.source==='gemini'?'Gemini: ':'')+(body.text||tr('AI暂时无法连接，请稍后再试。'));
 }catch{box.textContent=tr('AI暂时无法连接，请稍后再试。');}finally{button.disabled=false;}
};
fetch('/api/ai/status').then(x=>x.json()).then(x=>{
 $('aiConnection2d').textContent=x.configured?`Gemini · ${x.provider} · ${x.model}`:tr('尚未连接Gemini；普通实验仍可使用。');
}).catch(()=>{$('aiConnection2d').textContent=tr('AI状态暂不可用');});

function renderGuide(){
 if(!model)return;
 const obs=s(),progress=lessonProgress(scenario,{goggles:$('goggles').checked,reagents:model.reagents,temperatureC:obs.temperatureC,observed:microSeen});
 const root=$('lessonSteps');root.replaceChildren();
 const candidate=progress.findIndex(step=>!step.done);
 for(let i=0;i<progress.length;i++){
  const step=progress[i],row=document.createElement('div');
  row.className='lesson-step '+(step.done?'done':i===candidate?'current':'');
  const marker=document.createElement('span');marker.className='marker';marker.textContent=step.done?'✓':String(i+1);
  const details=document.createElement('div'),title=document.createElement('strong'),help=document.createElement('small');
  title.textContent=tr(step.title);help.textContent=tr(step.instruction);details.append(title,help);row.append(marker,details);root.append(row);
 }
 const state=director?.status;
 const advice=candidate===-1?'所有模拟教学目标已完成，可以生成报告。':`下一步：${progress[candidate].instruction}`;
 $('lessonStatus').textContent=state?.error?'演示中断：'+state.error:state?.running?`自动操作中 (${state.index+1}/${state.count})：${state.current?.title||'收尾'}。${state.current?.what||''}`:state?.paused?'自动演示已暂停。'+advice:state?.completed?'✔ 自动演示完成！请查看实验记录及微观结果。':advice;
 $('lessonPause').disabled=!state?.running;
 $('lessonNext').disabled=!!state?.running||!!state?.completed;
 $('lessonAuto').textContent=state?.paused?'▶ 继续自动播放':'▶ 一键开始实验 · 自动观察';
}
function setLessonReagent(id){
 if(selectedReagent===id)return;
 $('reagent').value=id;$('reagent').onchange();
}
const adapter={
 start(step){
  if(step.type==='safety'){$('goggles').checked=true;say('自动演示：模拟确认护目镜（未检测真实护目镜）。');return true;}
  if(step.type==='pour'){setLessonReagent(step.reagent);align();return beginPour(step.amount);}
  if(step.type==='heat'){heating=true;heatSimSeconds=0;$('lamp').textContent='♨ 停止加热';say('自动演示：开始加速加热。');return true;}
  if(step.type==='observe'){microSeen=true;$('microCanvas').closest('.live-micro-2d').classList.add('micro-pulse');say('自动演示：正在观察实时微观示意。');return true;}
  return false;
 },
 update(step,dt,elapsed){
  if(step.type==='pour')return !pourAnimation.active&&!pour&&elapsed>.1;
  if(step.type==='heat'){
   const ticks=Math.min(12,Math.floor((15/5*elapsed-heatSimSeconds)/.1));
   for(let i=0;i<ticks;i++){model.tick(.1,true);heatSimSeconds+=.1;}
   return heatSimSeconds>=14.9;
  }
  if(step.type==='observe')return elapsed>=2.3;
  return elapsed>=.7;
 },
 finish(step){if(step.type==='heat'){heating=false;$('lamp').textContent='♨ 开启加热';}say(`教学演示：${step.title}完成。${step.what}`);refresh();},
 onComplete(){autoplayFinished=true;$('report').click();say('自动演示已结束，生成了学习记录。');},
 setPaused(p){if(p&&director?.current?.type==='heat')heating=false;else if(!p&&director?.current?.type==='heat'&&director.started)heating=true;}
};
director=new LessonDirector(scenario,adapter,()=>{});
$('lessonAuto').onclick=()=>{if(director.paused){director.play();renderGuide();return;}reset();director.play();renderGuide();};
$('lessonPause').onclick=()=>{director.pause();renderGuide();};
$('lessonNext').onclick=()=>{if(director.completed){reset();}director.next();renderGuide();};
$('goggles').addEventListener('change',renderGuide);
window.addEventListener('motionlab:languagechange',()=>{
 for(const o of $('scenario').options)o.textContent=tr(`中${SCENARIOS[o.value].grade}`)+' · '+scenarioLabel(o.value);
 for(const o of $('reagent').options)o.textContent=reagentLabel(o.value);
 $('description').textContent=scenarioLabel(scenario,'summary');
 refresh();renderGuide();$('trace').replaceChildren();for(const e of events.slice(0,9)){const p=document.createElement('p');p.textContent=`${e.time}  ${tr(e.text)}`;$('trace').append(p);} if(hovered2D)updateHover2D();if(!$('reportText').hidden)renderLearningReport();
});
window.addEventListener('pagehide',()=>saveSession(scenario,model));
setup();requestAnimationFrame(loop);
