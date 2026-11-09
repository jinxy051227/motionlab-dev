import {CHEM,clamp,calculateTitration,evaluateSession} from './science.js';
import {RULES,TUBE_CAPACITY_ML,TUBE_MAX_HEAT_ML,tubeGuidance,LampProcedure} from './rules.js';
import {TubeBody} from './physics.js';
import {CameraController} from './hands.js';
import {drawSafety,drawTitration,drawMicro} from './draw.js';

const $=id=>document.getElementById(id);
const cvs=$('labCanvas'),ctx=cvs.getContext('2d');
const microctx=$('microCanvas').getContext('2d');
let mode='safety',micro=false,activeCamera=false;
const safety={body:new TubeBody(),lamp:new LampProcedure(),goggles:false,heatWarned:false,dropWarned:false,events:[]};
const titration={volumeMl:0,running:false,flow:0,swirling:false,activeSeconds:0,swirlSeconds:0,notes:[],quickStart:false,events:[],lastWarned:false,manualUsed:false};
let handState={flow:0,swirl:false,numHands:0,hands:[]};let hadPinch=false,lastHandSeen=0,dragged=false,lastX=0,lastY=0,lastT=0,lastFrame=performance.now(),lastUi=0;
let camera;
const nowStr=()=>new Date().toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
function log(message,kind='info'){
  const entry={time:nowStr(),text:message,kind};const events=mode==='safety'?safety.events:titration.events;
  events.unshift(entry);if(events.length>55)events.pop();renderLog();
}
function renderLog(){const events=mode==='safety'?safety.events:titration.events;const root=$('events');root.replaceChildren();
  if(!events.length){const el=document.createElement('div');el.className='empty';el.textContent='操作器材后，这里会记录发生了什么。';root.append(el);return;}
  for(const event of events.slice(0,25)){const item=document.createElement('div');item.className='event '+event.kind;const clock=document.createElement('span');clock.className='timestamp';clock.textContent=event.time;const content=document.createElement('span');content.textContent=event.text;item.append(clock,content);root.append(item)}
}
function setStatus(message,kind='ok'){$('statusPill').textContent=message;$('statusPill').className='status-pill '+(kind==='warn'?'warn':kind==='danger'?'danger':'');}
function resetSafety(){safety.body.reset();safety.lamp.reset();safety.heatWarned=false;safety.dropWarned=false;safety.events=[];safety.goggles=false;$('goggles').checked=false;hadPinch=false;log('安全练习已重置。请穿戴护目镜。');updateUi()}
function resetTitration(){Object.assign(titration,{volumeMl:0,running:false,flow:0,swirling:false,activeSeconds:0,swirlSeconds:0,notes:[],quickStart:false,events:[],lastWarned:false,manualUsed:false});log('新的一次酸碱滴定已准备就绪。');updateUi()}
function switchMode(next){if(next===mode)return;mode=next;micro=false;$('microOverlay').classList.add('hidden');$('navSafety').classList.toggle('active',mode==='safety');$('navTitration').classList.toggle('active',mode==='titration');
  $('safetyControls').classList.toggle('hidden',mode!=='safety');$('titrationControls').classList.toggle('hidden',mode!=='titration');
  $('sectionTag').textContent=mode==='safety'?'LAB SAFETY / 实验操作训练':'CHEMISTRY / 酸碱滴定';
  $('headline').innerHTML=mode==='safety'?'实验不只是<span>看见</span>，<br>更需要亲手掌握。':'通过双手操作，<br><span>理解化学变化。</span>';
  $('description').textContent=mode==='safety'?'通过摄像头或鼠标拿起试管、加液、放下器具。它们遵守重力，不会停在空中；错误操作会产生可见后果。':'用手势控制滴定管和摇匀，观察pH与微观粒子变化。化学结果由确定性计算引擎负责。';
  $('modebadge').textContent=mode==='safety'?'实验 01 / 02':'实验 02 / 02';$('stageTitle').textContent=mode==='safety'?'化学实验操作台':'酸碱滴定操作台';
  $('canvasHint').textContent=mode==='safety'?'拖动试管然后松手，观察物理后果':'打开摄像头双手操作，或通过按钮滴加';
  $('reportOutput').classList.add('hidden');$('goggles').disabled=mode==='titration';renderLog();renderRules();updateUi();}
function renderRules(){const view=$('rulesView');view.replaceChildren();const selected=RULES.filter(r=>r.domain==='general'||r.domain===(mode==='safety'?'tube':'titration')||(mode==='safety'&&r.domain==='lamp'));
  $('ruleCount').textContent=`${selected.length} 条`;for(const rule of selected){const el=document.createElement('div');el.className='rule';const title=document.createElement('strong');title.textContent=(rule.severity==='critical'?'● ':'○ ')+rule.title;title.style.color=rule.severity==='critical'?'#f0d5b2':'#d1e6e9';const src=document.createElement('small');src.textContent=`适用：${rule.applicability} · ${rule.source}`;el.append(title,src);view.append(el)}
}
function updateUi(){if(mode==='safety'){let body=safety.body,guide=tubeGuidance(body.volumeMl);$('metricOneName').textContent='试管液量';$('metricOne').innerHTML=`${body.volumeMl.toFixed(2)} <em>mL</em>`;$('metricTwoName').textContent='器材状态';$('metricTwo').textContent=body.broken?'已破损':body.held?'握持中':body.inRack?'在试管架':body.resting?'倒地':'下落中';$('metricTwo').style.fontSize='18px';$('volumeBar').style.width=Math.min(100,body.volumeMl/TUBE_CAPACITY_ML*100)+'%';$('volumeBar').style.background=guide.level==='danger'?'#f88a83':'#40cfc0';$('metricInfo').textContent=guide.text;
  if(body.broken)setStatus('玻璃破损！请重置实验。','danger');else if(!safety.goggles)setStatus('请先佩戴护目镜。','warn');else if(body.spilledMl>.02)setStatus('液体已洒出，请按实验室SOP处理。','danger');else if(guide.level==='danger')setStatus('装液超出本次加热训练范围。','danger');else setStatus('已准备好安全训练');
 }else{const science=calculateTitration(titration.volumeMl);$('metricOneName').textContent='已滴加NaOH';$('metricOne').innerHTML=`${titration.volumeMl.toFixed(2)} <em>mL</em>`;$('metricTwoName').textContent='实时pH';$('metricTwo').textContent=science.ph.toFixed(2);$('metricTwo').style.fontSize='24px';$('volumeBar').style.width=titration.volumeMl/20*100+'%';$('volumeBar').style.background='#40cfc0';$('metricInfo').textContent='理论等量点10.00mL；酚酞变色终点与等量点不同。';setStatus(titration.volumeMl>10.2?'可能已超过终点':titration.volumeMl>9.5?'接近终点，请缓慢滴加':'观察pH变化与滴定速度',titration.volumeMl>10.2?'warn':'ok');$('startTitration').textContent=titration.running?'⏸ 暂停滴定':'▶ 开始 / 继续'}
}
function addTube(amount){if(safety.body.broken){log('玻璃已碎，不能继续向试管加液。','danger');return;}if(!safety.goggles)log('未模拟佩戴护目镜就进行加液。','danger');const prev=safety.body.volumeMl;const actual=Math.min(TUBE_CAPACITY_ML,prev+amount);safety.body.setVolume(actual);const overflow=Math.max(0,prev+amount-TUBE_CAPACITY_ML);if(overflow){safety.body.spilledMl+=overflow;log(`超过试管总容量，${overflow.toFixed(1)} mL 溢出。`,'danger')}log(`试管加入 ${amount} mL 液体，当前 ${actual.toFixed(1)} mL。`);const g=tubeGuidance(actual);if(g.level==='danger')log(g.text,'danger');updateUi()}
function lampAction(action){let p;if(action==='light'){if(!safety.goggles){log('未戴护目镜时不能点燃酒精灯。','danger');return;}let success=safety.lamp.light();log(success?'酒精灯已点燃。注意保持器具距离。':'酒精灯当前步骤不允许点燃。',success?'good':'danger')}else if(action==='cap'){p=safety.lamp.cap(performance.now());log(p.message,p.ok?'good':'danger')}else{p=safety.lamp.uncap(performance.now());log(p.message,p.ok?'good':'danger')}updateUi()}
function rackTube(){if(safety.body.broken){log('碎裂的玻璃不能放回试管架，请重置本次模拟。','danger');return;}safety.body.inRack=true;safety.body.held=false;safety.body.resting=true;safety.body.x=430;safety.body.y=295;safety.body.angle=0;safety.body.vx=0;safety.body.vy=0;safety.body.omega=0;log('试管已安全放回试管架。','good');updateUi()}
function addBase(amount){const prev=titration.volumeMl;titration.volumeMl=clamp(prev+amount,0,CHEM.maxBaseMl);if(titration.volumeMl===prev)return;titration.manualUsed=true;log(`加入 NaOH ${amount.toFixed(2)} mL，当前 ${titration.volumeMl.toFixed(2)} mL。`);if(prev<9.5 && titration.volumeMl>=9.5)log('接近等量点。应放慢滴加并保持充分混合。','good');if(titration.volumeMl>10.2&&!titration.lastWarned){titration.lastWarned=true;let e='超过理论等量点较多，请检查停止时机。';titration.notes.push({type:'overshoot',text:e});log(e,'danger')}updateUi();}
function coords(evt){const r=cvs.getBoundingClientRect();return {x:(evt.clientX-r.left)*cvs.width/r.width,y:(evt.clientY-r.top)*cvs.height/r.height};}
cvs.addEventListener('pointerdown',e=>{if(mode!=='safety')return;const p=coords(e),b=safety.body;if(b.broken)return;if(Math.abs(b.x-p.x)<56&&Math.abs(b.y-p.y)<100){cvs.setPointerCapture(e.pointerId);dragged=b.grab(p.x,p.y);lastX=p.x;lastY=p.y;lastT=performance.now();if(!safety.goggles)log('未穿戴护目镜时触碰实验器具。','danger');else log('拿起试管。');updateUi()}});
cvs.addEventListener('pointermove',e=>{if(!dragged)return;const p=coords(e);const now=performance.now();safety.body.move(p.x,p.y,(now-lastT)/1000);lastX=p.x;lastY=p.y;lastT=now});
function releasePointer(){if(!dragged)return;dragged=false;safety.body.release();log('试管已从手中松开，重力开始作用。','danger');updateUi()}
cvs.addEventListener('pointerup',releasePointer);cvs.addEventListener('pointercancel',releasePointer);
function processCamera(data){handState=data;const time=performance.now();if(mode==='safety'){
  const h=data.hands?.[0];if(h){lastHandSeen=time;const x=h.x*900,y=h.y*475;
    if(h.ratio<.37&&!hadPinch){hadPinch=true;if(Math.abs(safety.body.x-x)<90 && Math.abs(safety.body.y-y)<120){safety.body.grab(x,y);log('摄像头：手指捏合，已握住试管。','good')}}
    if(h.ratio<.43&&safety.body.held&&!dragged)safety.body.move(x,y,.05);
    if(h.ratio>.55){hadPinch=false;if(safety.body.held&&!dragged){safety.body.release();log('摄像头：松开手指，试管开始下落。','danger')}}
  }else if(data.numHands===0 && safety.body.held && time-lastHandSeen>300 && !dragged){safety.body.release();hadPinch=false;log('摄像头：失去手部握持，试管开始下落。','danger')}
 }else{titration.flow=data.flow||0;titration.swirling=!!data.swirl;}
}
async function toggleCamera(){if(!camera)camera=new CameraController($('cameraVideo'),$('handOverlay'),processCamera,s=>{$('cameraStatus').textContent=s});if(activeCamera){camera.stop();activeCamera=false;$('cameraOff').classList.remove('hidden');$('cameraBtn').textContent='开启摄像头 · MediaPipe';$('cameraDot').classList.remove('online');return;}
  $('cameraBtn').disabled=true;try{await camera.start();activeCamera=true;$('cameraOff').classList.add('hidden');$('cameraBtn').textContent='关闭摄像头';$('cameraDot').classList.add('online');log('摄像头已开启。原始视频只在本地处理。','good')}catch(err){$('cameraStatus').textContent=`摄像头失败：${err.message}。可继续用鼠标操作。`;log('摄像头启动失败，切换至鼠标备用模式。','danger')}finally{$('cameraBtn').disabled=false}}
function openMicro(){micro=true;$('microOverlay').classList.remove('hidden');$('microText').textContent=mode==='safety'?'玻璃、液体和重力属于宏观物理效果。安全练习不模拟未知化学物质的分子反应。':'示意：水合氢离子 H₃O⁺ 与 OH⁻ 中和生成水；Na⁺ 与 Cl⁻ 主要为旁观离子。粒子数量与位置并非实际分子动力学结果。'}
function closeMicro(){micro=false;$('microOverlay').classList.add('hidden')}
async function report(){const output=$('reportOutput');output.classList.remove('hidden');output.textContent='正在整理实验记录…';
  if(mode==='safety'){const events=safety.events;const dangerous=events.filter(e=>e.kind==='danger');const state=safety.body;const points=Math.max(0,100-(dangerous.length*12)-(state.broken?20:0)-(!safety.goggles?15:0));output.textContent=`安全训练反馈（规则评分，非认证）\n练习分：${points}/100\n护目镜：${safety.goggles?'已穿戴':'未穿戴'}\n试管状态：${state.broken?'破损':state.inRack?'已放回试管架':'尚未规范归位'}\n洒液总量：${state.spilledMl.toFixed(2)} mL\n当前加液：${state.volumeMl.toFixed(2)} mL\n酒精灯流程：${safety.lamp.state==='recapped'?'已完成复盖流程':'未完成复盖流程'}\n需要改进的操作：${dangerous.length}项记录。\n\n提示：本项目只覆盖当前列出的SOP规则，不能用于实际操作安全认证。`;return;}
  const evalResult=evaluateSession({volumeMl:titration.volumeMl,swirlSeconds:titration.swirlSeconds,activeSeconds:titration.activeSeconds,warnings:titration.notes,quickStart:titration.quickStart});
  const local=`实验结果：${evalResult.volumeMl.toFixed(3)} mL；误差 ${evalResult.errorMl.toFixed(3)} mL；教学评分 ${evalResult.score}/100。\n${evalResult.errors.join('\n')||'未发现明显的已记录程序错误。'}\n${evalResult.takeaways.join('\n')}`;
  try{const res=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({volumeMl:titration.volumeMl,ph:calculateTitration(titration.volumeMl).ph,score:evalResult.score,mixingRatio:evalResult.mixingRatio,errorMl:evalResult.errorMl,notes:evalResult.errors,quickStart:titration.quickStart})});if(!res.ok)throw new Error('服务器不可用');const data=await res.json();output.textContent=`${local}\n\n${data.source==='gemini'?'Gemini教学反馈':'规则教学反馈'}：\n${data.text}`}catch(e){output.textContent=`${local}\n\n在线反馈不可用，已切换至本地计算报告。`}}
function loop(t){const dt=clamp((t-lastFrame)/1000,0,.04);lastFrame=t;
 if(mode==='safety'){
   const res=safety.body.step(dt);if(res.shattered)log('试管坠落并碎裂，液体洒在桌面！玻璃破损需按SOP处理。','danger');else if(res.impact)log('试管落到桌面并倾倒，内部液体流出。','danger');
   if(safety.lamp.state==='lit'&&!safety.heatWarned && Math.hypot(safety.body.x-185,safety.body.y-293)<105){safety.heatWarned=true;if(safety.body.volumeMl>TUBE_MAX_HEAT_ML)log('试管靠近火焰，液量超过本加热练习建议上限！','danger');else log('试管靠近火焰。请确认开口方向、沸腾石及小幅移动，当前不模拟真实加热。','warn')}
   drawSafety(ctx,safety,t);
 }else{
   if(titration.running){titration.activeSeconds+=dt;if(titration.swirling)titration.swirlSeconds+=dt;
     if(activeCamera&&titration.flow>0){let current=titration.volumeMl;if(current>9.5 && titration.flow>.48 && !titration.lastWarned){let e='接近等量点仍快速滴加。';titration.notes.push({type:'too_fast_near_end',text:e});titration.lastWarned=true;log(e,'danger')}
       titration.volumeMl=clamp(current+titration.flow*dt,0,20);if(titration.volumeMl>=20){titration.running=false;log('达到模拟最大滴定量20 mL，自动停止。','danger')}}
   }drawTitration(ctx,titration,t)
 }
 if(micro)drawMicro(microctx,t,mode==='titration'?calculateTitration(titration.volumeMl):null);
 if(t-lastUi>200){lastUi=t;updateUi()}
 requestAnimationFrame(loop)
}
$('navSafety').addEventListener('click',()=>switchMode('safety'));
$('navTitration').addEventListener('click',()=>switchMode('titration'));
$('goggles').addEventListener('change',e=>{safety.goggles=e.target.checked;log(safety.goggles?'已穿戴护目镜（模拟确认）。':'取下护目镜。',safety.goggles?'good':'danger');updateUi()});
$('addSmall').onclick=()=>addTube(1);$('addLarge').onclick=()=>addTube(3);
$('lampLight').onclick=()=>lampAction('light');$('lampCap').onclick=()=>lampAction('cap');$('lampUncap').onclick=()=>lampAction('uncap');$('tubeRack').onclick=rackTube;
$('resetBtn').onclick=()=>{mode==='safety'?resetSafety():resetTitration();closeMicro();$('reportOutput').classList.add('hidden')};
$('smallDrop').onclick=()=>addBase(.05);$('normalDrop').onclick=()=>addBase(.5);$('fastTitration').onclick=()=>{titration.quickStart=true;addBase(1)};
$('startTitration').onclick=()=>{titration.running=!titration.running;log(titration.running?'开始滴定。':'暂停滴定。',titration.running?'good':'info');updateUi()};$('finishTitration').onclick=()=>{titration.running=false;report()};
$('cameraBtn').onclick=toggleCamera;$('microBtn').onclick=openMicro;$('closeMicro').onclick=closeMicro;$('reportBtn').onclick=report;$('clearLog').onclick=()=>{if(mode==='safety')safety.events=[];else titration.events=[];renderLog()};
$('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
resetSafety();renderRules();requestAnimationFrame(loop);
