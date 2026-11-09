import {CHEM,calculateTitration,clamp} from './science.js';
const COL={cyan:'#5cddd2',teal:'#2dcdb8',water:'#59ceda',orange:'#ffbe77',red:'#ff6e7f',glass:'#b6ebf6'};
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function text(ctx,s,x,y,size=12,color='#91aebf',align='left',weight=400){ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.fillText(s,x,y);ctx.textAlign='left';}
function grad(ctx,x,y,w,h,c1,c2){const g=ctx.createLinearGradient(x,y,x,y+h);g.addColorStop(0,c1);g.addColorStop(1,c2);ctx.fillStyle=g;ctx.fillRect(x,y,w,h)}
function environment(ctx,time){
 const w=900,h=475;ctx.clearRect(0,0,w,h);grad(ctx,0,0,w,h,'#152f43','#071e2b');
 ctx.strokeStyle='#1a3b4d';ctx.lineWidth=1;for(let x=0;x<w;x+=38){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,410);ctx.stroke()}for(let y=0;y<390;y+=38){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 const glow=ctx.createRadialGradient(450,290,0,450,290,400);glow.addColorStop(0,'#25536744');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(0,0,900,400);
 grad(ctx,0,410,900,65,'#273943','#112633');ctx.fillStyle='#8baebb';ctx.fillRect(0,408,900,4);
 ctx.fillStyle='#152938';ctx.fillRect(0,430,900,45);text(ctx,'MOTIONLAB  /  VIRTUAL WORKBENCH',25,452,10,'#527c8d', 'left',600);
}
function glassTube(ctx,body){
 const {x,y,angle,volumeMl,broken}=body;if(broken){for(let i=0;i<5;i++){ctx.save();ctx.translate(x+(i-2)*19,405+(i%2)*7);ctx.rotate(i*1.2);rounded(ctx,-10,-4,20,8,2,'#66d4df66','#c0f3fd');ctx.restore()}return}
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.shadowColor='#66dfdf77';ctx.shadowBlur=13;
 ctx.fillStyle='#81e5ee13';ctx.strokeStyle='#aedee8e5';ctx.lineWidth=4;
 ctx.beginPath();ctx.moveTo(-20,-76);ctx.lineTo(-18,63);ctx.quadraticCurveTo(0,90,18,63);ctx.lineTo(20,-76);ctx.stroke();ctx.shadowBlur=0;
 const fill=clamp(volumeMl/20,0,1);if(fill>0){let ylevel=66-fill*130;ctx.beginPath();ctx.moveTo(-15,ylevel);ctx.lineTo(15,ylevel);ctx.lineTo(13,58);ctx.quadraticCurveTo(0,80,-13,58);ctx.closePath();ctx.fillStyle='#50cce587';ctx.fill();ctx.strokeStyle='#7ce6ec';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-15,ylevel);ctx.lineTo(15,ylevel);ctx.stroke()}
 ctx.beginPath();ctx.moveTo(-25,-76);ctx.lineTo(25,-76);ctx.strokeStyle='#c9f3fd';ctx.lineWidth=5;ctx.lineCap='round';ctx.stroke();ctx.restore();
}
function drawPuddle(ctx,amount,x=450){if(amount<.05)return;const radius=27+Math.min(90,amount*9);ctx.fillStyle='#42bed077';ctx.beginPath();ctx.ellipse(x,411,radius,7+amount*1.4,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#67edfb77';ctx.stroke();}
function lamp(ctx,lampState,time){
 ctx.save();ctx.translate(185,365);ctx.fillStyle='#193b48';ctx.beginPath();ctx.moveTo(-41,34);ctx.lineTo(-29,-14);ctx.lineTo(29,-14);ctx.lineTo(41,34);ctx.closePath();ctx.fill();ctx.strokeStyle='#91d6d4';ctx.lineWidth=2;ctx.stroke();rounded(ctx,-11,-31,22,18,4,'#4d6775','#98c6ce');rounded(ctx,-3,-49,6,22,2,'#beae98','#e9d2a9');if(lampState==='lit'){const sway=Math.sin(time/230)*5;const glow=ctx.createRadialGradient(0,-57,0,0,-57,55);glow.addColorStop(0,'#ffb64d55');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(-60,-116,120,115);ctx.fillStyle='#ffb74a';ctx.beginPath();ctx.moveTo(0,-90+sway);ctx.quadraticCurveTo(27,-61,0,-43);ctx.quadraticCurveTo(-24,-59,0,-90+sway);ctx.fill();ctx.fillStyle='#ffed94';ctx.beginPath();ctx.ellipse(0,-53,7,14,0,0,Math.PI*2);ctx.fill()}else{rounded(ctx,-18,-46,36,13,5,'#456b7b','#a0c9d2')}
 ctx.restore();text(ctx,'酒精灯',185,426,12,'#9cbcca','center');}
function stand(ctx){
 rounded(ctx,382,367,96,17,6,'#3e7784','#79aab6');ctx.strokeStyle='#53929c';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(399,369);ctx.lineTo(399,329);ctx.lineTo(466,329);ctx.lineTo(466,369);ctx.stroke();rounded(ctx,391,320,80,12,5,'#325a6b','#9bd5dc');ctx.fillStyle='#122b39';ctx.beginPath();ctx.ellipse(431,326,25,6,0,0,Math.PI*2);ctx.fill();}
export function drawSafety(ctx,sim,time=0){
 environment(ctx,time);text(ctx,'01   实验室安全与器具习惯',24,30,12,COL.cyan,'left',700);
 const legend=[['试管容量','20 mL'],['加热建议上限','5 mL'],['状态',sim.body.broken?'损坏':sim.body.held?'握持中':sim.body.inRack?'试管架':'自由下落']];legend.forEach((p,i)=>{rounded(ctx,640,43+i*43,235,36,8,'#0d2736','#2a5361');text(ctx,p[0],655,65+i*43,11,'#94b5c2');text(ctx,p[1],857,65+i*43,12,'#d7f3f7','right',700)});
 // workspace lamps and rack
 lamp(ctx,sim.lamp.state,time);stand(ctx);
 // lamp safety zone
 ctx.fillStyle='#ce8b3a20';ctx.beginPath();ctx.ellipse(185,403,104,16,0,0,2*Math.PI);ctx.fill();
 drawPuddle(ctx,sim.body.spilledMl,sim.body.x);glassTube(ctx,sim.body);
 text(ctx,'拖拽试管 → 松手 → 观察下落、碰撞与液体飞溅',24,61,13,'#a1c5d0');
 if(sim.body.broken){rounded(ctx,335,168,265,52,10,'#5b2834','#ab5969');text(ctx,'玻璃已破损 · 请重置',468,198,17,'#ffd2dc','center',700)}
 if(sim.body.held){rounded(ctx,300,85,240,35,9,'#1a555d','#39acb7');text(ctx,'已抓取：放开鼠标/手势将释放',420,107,11,'#bff5ed','center')}
}
function roundedChem(ctx,x,y,w,h,r,fill,stroke){rounded(ctx,x,y,w,h,r,fill,stroke)}
export function drawTitration(ctx,data,time=0){
 environment(ctx,time);text(ctx,'02   酸碱滴定  ·  0.100 M HCl / NaOH',24,30,12,COL.cyan,'left',700);
 // Burette
 ctx.save();ctx.strokeStyle='#aad6e5';ctx.lineWidth=3;ctx.fillStyle='#59d5e835';ctx.beginPath();ctx.moveTo(246,45);ctx.lineTo(246,258);ctx.lineTo(268,258);ctx.lineTo(268,45);ctx.stroke();const fillH=180-Math.min(1,data.volumeMl/20)*178;ctx.fillStyle='#57c9d68c';ctx.fillRect(250,50+180-fillH,14,fillH);ctx.strokeStyle='#7bdadf';ctx.beginPath();ctx.moveTo(245,49);ctx.lineTo(269,49);ctx.stroke();for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(267,57+i*17);ctx.lineTo(273,57+i*17);ctx.stroke();}rounded(ctx,245,265,24,8,2,'#577b89','#a4dae5');ctx.beginPath();ctx.moveTo(257,272);ctx.lineTo(257,302);ctx.stroke();if(data.running && data.flow>0){ctx.fillStyle='#6ddbe7';const t=(time/250)%1;ctx.beginPath();ctx.ellipse(257,303+t*80,4,7,0,0,6.3);ctx.fill()}ctx.restore();
 // conical flask
 ctx.fillStyle='#87dce91c';ctx.strokeStyle='#c4eef2';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(410,280);ctx.lineTo(410,319);ctx.lineTo(350,396);ctx.quadraticCurveTo(350,407,365,407);ctx.lineTo(526,407);ctx.quadraticCurveTo(540,404,535,391);ctx.lineTo(476,319);ctx.lineTo(476,280);ctx.stroke();ctx.beginPath();ctx.moveTo(407,280);ctx.lineTo(480,280);ctx.stroke();
 const liquid=calculateTitration(data.volumeMl);const level=392-Math.min(56,data.volumeMl*1.5);ctx.fillStyle=`rgba(${Math.floor(66+liquid.indicator*176)},${Math.floor(190-liquid.indicator*102)},${Math.floor(213-liquid.indicator*53)},0.55)`;ctx.beginPath();ctx.moveTo(366,392);ctx.lineTo(520,392);ctx.lineTo(520-(392-level)*.68,level);ctx.lineTo(366+(392-level)*.68,level);ctx.closePath();ctx.fill();text(ctx,'烧瓶：HCl 10mL',440,443,12,'#a1bdc8','center');text(ctx,'滴定管：NaOH',260,30,12,'#b0cbd5','center');
 roundedChem(ctx,615,63,260,115,12,'#102c3c','#315c69');text(ctx,'当前 pH',634,88,13,'#9fbfc9');text(ctx,liquid.ph.toFixed(2),635,129,40,'#bcefeb','left',700);text(ctx,`已加入 NaOH：${data.volumeMl.toFixed(3)} mL`,634,155,12,'#a2c5d0');
 text(ctx,'滴定曲线（宏观视图）',620,212,12,'#b3d1d9');ctx.lineWidth=1;ctx.strokeStyle='#577684';ctx.strokeRect(622,223,254,146);ctx.beginPath();for(let i=0;i<=180;i++){let m=i*20/180;const p=calculateTitration(m).ph;const xx=622+(m/20)*254,yy=369-p/14*146;if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}ctx.strokeStyle='#56d8c8';ctx.lineWidth=2;ctx.stroke();const cx=622+data.volumeMl/20*254,cy=369-liquid.ph/14*146;ctx.fillStyle='#ffbb74';ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fill();text(ctx,'0',620,383,10);text(ctx,'10mL',749,383,10,'#a5c4cf','center');text(ctx,'20mL',870,383,10,'#a5c4cf','right');
}
export function drawMicro(ctx,time,chem=null){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.clearRect(0,0,w,h);const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#061d2d');g.addColorStop(1,'#143b4b');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 const acid=chem?.excessAcidMol ?? .0005,base=chem?.excessBaseMol ?? 0;let acidCount=Math.round(clamp(acid*8000,1,16)),baseCount=Math.round(clamp(base*8000,0,16));const na=chem?9:6,cl=chem?9:6;
 for(let i=0;i<acidCount+baseCount+na+cl+12;i++){let species=i<acidCount?0:i<acidCount+baseCount?1:i<acidCount+baseCount+na?2:i<acidCount+baseCount+na+cl?3:4;const hue=['#fc929d','#70d4f0','#ffc778','#a1c4f5','#8dcfc6'][species];const xx=40+((i*107+Math.sin(time/920+i*3)*19)% (w-80)),yy=45+((i*83+Math.cos(time/840+i*2)*22)% (h-85));ctx.beginPath();ctx.fillStyle=hue;ctx.shadowBlur=16;ctx.shadowColor=hue;ctx.arc(xx,yy,species===4?10:7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(species!==4)text(ctx,['H₃O⁺','OH⁻','Na⁺','Cl⁻'][species],xx,yy-13,10,hue,'center')}
 rounded(ctx,15,13,315,28,8,'#0b2b39b8','#2a5563');text(ctx,'分子 / 离子示意（不是分子动力学）',29,32,12,'#c1e9ee');}
