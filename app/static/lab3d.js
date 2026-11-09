import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import {EQUIPMENT,clamp3} from './interaction3d.js';
import {SmoothPointer2D,rackSlotFor,easyPourTarget,dripRate} from './ergonomics.js';
import {WALK_CODES,walkDelta} from './navigation3d.js';
import {AssistedPour,canTransfer} from './assisted-transfer.js';
import {pickGripTarget} from './grip-intent.js';
import {reagentAppearance} from './liquid-appearance.js';
const CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const colors=[0x55e4d5,0xffcb84];
const mat=(color,options={})=>new THREE.MeshStandardMaterial({color,metalness:.12,roughness:.47,...options});
const glass=()=>new THREE.MeshPhysicalMaterial({color:0x98e2ee,transparent:true,opacity:.30,metalness:.08,roughness:.16,side:THREE.DoubleSide,depthWrite:false});
const metal=()=>mat(0x9eb9c2,{metalness:.74,roughness:.22});
const wood=()=>mat(0x816449,{roughness:.82});
function mesh(geom,m,x=0,y=0,z=0){const v=new THREE.Mesh(geom,m);v.position.set(x,y,z);v.castShadow=true;v.receiveShadow=true;return v;}
function cylinder(r1,r2,h,m,x=0,y=0,z=0){return mesh(new THREE.CylinderGeometry(r1,r2,h,18),m,x,y,z);}
function box(w,h,d,m,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);}
function sphere(r,m,x=0,y=0,z=0){return mesh(new THREE.SphereGeometry(r,12,10),m,x,y,z);}
export class Laboratory3D {
 constructor(root,{onEvent=()=>{},onSelect=()=>{},onGesture=()=>{},onTransfer=()=>{},onSpill=()=>{},onHeat=()=>{},onHover=()=>{}}={}){
  this.root=root;this.onEvent=onEvent;this.onSelect=onSelect;this.onGesture=onGesture;this.onTransfer=onTransfer;this.onSpill=onSpill;this.onHeat=onHeat;this.onHover=onHover;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#0b1a23');this.scene.fog=new THREE.Fog(0x0b1a23,12,25);
  // 2.5D by default: real 3D meshes, lighting, collisions and liquid effects,
  // but a stable front-facing orthographic camera. Exploration remains optional.
  this.presentation='desk';this.orthoHeight=6.5;
  this.deskCamera=new THREE.OrthographicCamera(-6,6,3.25,-3.25,.07,70);
  this.deskCamera.position.set(0,2.7,13);this.deskCamera.lookAt(0,.95,0);
  this.exploreCamera=new THREE.PerspectiveCamera(42,1,.07,60);
  this.exploreCamera.position.set(6,5.6,9.7);this.exploreCamera.lookAt(0,.8,.45);
  this.camera=this.deskCamera;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  this.root.appendChild(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,.7,.35);this.controls.minDistance=3.0;this.controls.maxDistance=19;this.controls.minPolarAngle=.12;this.controls.maxPolarAngle=Math.PI*.71;this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.enableRotate=false;this.controls.update();
  const hemi=new THREE.HemisphereLight(0xc7f3fa,0x34404c,2);this.scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff0d8,2.5);sun.position.set(-3,9,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;this.scene.add(sun);
  const rim=new THREE.PointLight(0x23bad1,26,13);rim.position.set(4,3,-3);this.scene.add(rim);
  const floor=box(12,.24,6,mat(0x3a5360,{roughness:.5}),0,-.17,.1);this.scene.add(floor);
  const back=box(13,5,.15,mat(0x17313b,{roughness:.94}),0,2.0,-3.15);this.scene.add(back);
  const tabletop=box(9.6,.22,4.5,mat(0x627987,{metalness:.24,roughness:.35}),0,-.03,0);this.scene.add(tabletop);
  const edge=box(9.65,.09,4.56,mat(0x234858,{metalness:.56}),0,-.17,0);this.scene.add(edge);
  for(let i=0;i<4;i++)this.scene.add(box(.20,2.2,.2,metal(),(i%2?1:-1)*4.2,-1.35,(i>1?1:-1)*1.8));
  const grid=new THREE.GridHelper(9.2,18,0x50919a,0x2c6670);grid.position.y=.084;grid.scale.z=.46;grid.material.opacity=.16;grid.material.transparent=true;this.scene.add(grid);
  this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});this.world.allowSleep=true;this.world.solver.iterations=12;
  const contact=new CANNON.Material('lab');this.world.defaultContactMaterial.friction=.5;this.world.defaultContactMaterial.restitution=.13;
  const ground=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(4.8,.11,2.25)),position:new CANNON.Vec3(0,-.03,0),material:contact});this.world.addBody(ground);
  this.entities=new Map();this.nextId=1;this.heatElapsed=0;this.flowElapsed=0;this.flowParticles=[];this.activeFlows=new Set();this.manualPourUntil=0;this.mode='guided';this.lastSelected=null;this.held=new Map();this.heldOffsets=new Map();this.cameraHands=[];this.lostSince=null;this.pendingBreaks=new Set();this.lastPourWarn=0;
  this.handModels=[this.makeHand(0),this.makeHand(1)];this.handFilters=[new SmoothPointer2D(),new SmoothPointer2D()];this.fallenParts=[];this.spillPools=[];this.lastSpillEvent=0;
  this.lastPointer=null;this.tool='grab';this.dragMode='free';this.mouseHeld=null;
  this.walkKeys=new Set();this.walkLooking=false;this.walkLast=null;this.walkYaw=0;this.walkPitch=0;
  this.assisted=null;this.assistedPaused=false;this.assistedStreamClock=0;this.selectionAxes=new THREE.AxesHelper(.72);this.selectionAxes.visible=false;this.scene.add(this.selectionAxes);
  this.renderer.domElement.style.cursor='grab';
  this.highlight=mesh(new THREE.TorusGeometry(.36,.025,7,36),new THREE.MeshBasicMaterial({color:0x56ffbd,transparent:true,opacity:.95}));this.highlight.rotation.x=0;this.highlight.visible=false;this.scene.add(this.highlight);
  this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.mouseHeld=null;
  this.renderer.domElement.addEventListener('pointerdown',e=>this.down(e));
  this.renderer.domElement.addEventListener('pointermove',e=>this.move(e));
  this.renderer.domElement.addEventListener('pointerleave',()=>this.onHover(null));
  this.renderer.domElement.addEventListener('wheel',e=>this.wheel(e),{passive:false});
  window.addEventListener('pointerup',e=>this.up(e));
  window.addEventListener('keydown',e=>this.nudge(e));
  window.addEventListener('keyup',e=>{this.walkKeys.delete(e.code);});
  window.addEventListener('blur',()=>{this.walkKeys.clear();this.walkLooking=false;});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.root);this.resize();
  this.lastTime=performance.now();this.active=true;this.reset('guided');this.draw();
 }
 resize(){const w=this.root.clientWidth,h=Math.max(1,this.root.clientHeight);const aspect=w/h;
  if(this.camera.isOrthographicCamera){const half=this.orthoHeight/2;this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;}
  else this.camera.aspect=aspect;
  this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
 }
 setPresentation(style){
  if(!['desk','explore'].includes(style))return false;
  if(this.presentation===style)return true;
  if(this.mouseHeld)this.releaseMouse();
  this.controls.dispose();this.presentation=style;
  this.camera=style==='desk'?this.deskCamera:this.exploreCamera;
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);
  this.controls.target.set(0,.85,0);this.controls.minDistance=3;this.controls.maxDistance=19;
  this.controls.enableDamping=true;this.controls.enablePan=style==='explore';this.controls.enableRotate=style==='explore';
  this.tool='grab';this.walkKeys.clear();this.resize();this.controls.update();
  this.onEvent(style==='desk'?'已进入固定平视：3D器材不会变成2D贴图，镜头不再乱转。':'已进入自由3D：可以旋转视角及WASD漫游。','good');return true;
 }
 // Fixed frontal interaction plane: only normalized X and Y coordinates.
 // Palm size, MediaPipe z and worldLandmarks are intentionally NEVER used.
 handWorld(hand,i){
  const xy=this.handFilters[i].update(hand.position.x,hand.position.y);
  if(!xy)return {x:0,y:1,z:0};
  const aspect=Math.max(.6,this.root.clientWidth/Math.max(1,this.root.clientHeight));
  const span=this.orthoHeight*aspect;
  return {x:clamp3((.5-xy.x)*span,-4.2,4.2),
    y:clamp3(1.15+(.5-xy.y)*this.orthoHeight,.17,3.35),z:0};
 }
 makeHand(i){
  const root=new THREE.Group();root.visible=false;const c=colors[i];const geo=new THREE.SphereGeometry(.045,8,7);
  const joints=Array.from({length:21},(_,k)=>{const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:k===4||k===8?1:.78}));root.add(m);return m;});
  const linePositions=new Float32Array(CONNECTIONS.length*6);
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(linePositions,3));
  const lines=new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:c,linewidth:2,transparent:true,opacity:.86}));root.add(lines);
  const halo=mesh(new THREE.TorusGeometry(.27,.024,8,30),new THREE.MeshBasicMaterial({color:c}));halo.rotation.x=Math.PI/2;root.add(halo);
  const grip=sphere(.105,new THREE.MeshBasicMaterial({color:0x52ffb0}));root.add(grip);grip.visible=false;
  this.scene.add(root);return {root,joints,lines,halo,grip};
 }
 reset(mode=this.mode){
  this.mode=mode;this.assisted=null;this.assistedPaused=false;for(const ent of [...this.entities.values()])this.remove(ent);
  this.entities.clear();this.held.clear();this.heldOffsets.clear();for(const part of this.fallenParts){this.scene.remove(part.mesh);this.world.removeBody(part.body);}this.fallenParts=[];
  for(const pool of this.spillPools){this.scene.remove(pool.mesh);pool.mesh.geometry.dispose();pool.mesh.material.dispose();}this.spillPools=[];this.nextId=1;this.receiverId=null;for(const d of this.flowParticles)this.scene.remove(d.mesh);this.flowParticles=[];this.lastSelected=null;this.selectionAxes.visible=false;
  this.spawn('tube',-2.25,0);this.spawn('rack',-1.15,0);this.spawn('lamp',2.7,0);this.spawn('beaker',.55,0);this.receiverId=[...this.entities.values()].find(e=>e.type==='beaker')?.id;
  if(mode==='free'){this.spawn('flask',-3.65,0);this.spawn('reagent',3.65,0);this.spawn('rod',1.6,0);}
  this.onSelect(null);this.onEvent('3D实验台已重置。玻璃器材受重力和碰撞影响。','good');
 }
 makeObject(type){
  const grp=new THREE.Group();const g=glass();const metallic=metal();const mint=new THREE.MeshPhysicalMaterial({color:0xe8f8fa,metalness:0,roughness:.12,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide});let liquid=null,flame=null;
  switch(type){
   case 'tube':{
    grp.add(cylinder(.12,.095,1.13,g));grp.add(mesh(new THREE.TorusGeometry(.125,.021,8,24),g,0,.56,0));
    grp.add(sphere(.095,g,0,-.54,0));liquid=cylinder(.083,.07,.15,mint,0,-.44,0);grp.add(liquid);break;}
   case 'beaker':{
    grp.add(cylinder(.36,.34,.75,g));grp.add(mesh(new THREE.TorusGeometry(.36,.025,8,30),g,0,.38,0));liquid=cylinder(.30,.29,.22,mint,0,-.23,0);grp.add(liquid);break;}
   case 'flask':{
    grp.add(cylinder(.18,.41,.72,g,0,-.2,0));grp.add(cylinder(.18,.18,.42,g,0,.38,0));grp.add(mesh(new THREE.TorusGeometry(.18,.018,8,24),g,0,.59,0));liquid=cylinder(.26,.35,.20,mint,0,-.44,0);grp.add(liquid);break;}
   case 'reagent':{
    grp.add(cylinder(.34,.34,.85,glass(),0,-.1,0));liquid=cylinder(.27,.27,.45,mint,0,-.24,0);grp.add(liquid);grp.add(cylinder(.18,.18,.26,glass(),0,.45,0));grp.add(cylinder(.20,.20,.12,mat(0x254f5c),0,.63,0));grp.add(box(.52,.28,.04,mat(0xe7e4ce),0,.03,.32));break;}
   case 'pipette':{grp.add(cylinder(.035,.045,1.45,g));grp.add(sphere(.12,mat(0xffab96),0,.66,0));grp.add(cylinder(.012,.018,.19,mint,0,-.81,0));break;}
   case 'rod':{grp.add(cylinder(.027,.027,1.75,g));break;}
   case 'thermometer':{grp.add(cylinder(.043,.043,1.45,g));grp.add(sphere(.095,mat(0xea7a6f),0,-.75,0));grp.add(cylinder(.012,.012,.9,mat(0xea7a6f),0,-.22,.046));break;}
   case 'rack':{
    // Three genuinely OPEN circular holes; not dark discs drawn on a solid cuboid.
    const shape=new THREE.Shape();shape.moveTo(-.82,-.30);shape.lineTo(.82,-.30);shape.lineTo(.82,.30);shape.lineTo(-.82,.30);shape.closePath();
    for(const x of [-.48,0,.48]){const hole=new THREE.Path();hole.absarc(x,0,.165,0,Math.PI*2,true);shape.holes.push(hole);}
    const top=mesh(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false}),wood());
    top.rotation.x=-Math.PI/2;top.position.y=.24;grp.add(top);
    grp.add(box(1.65,.11,.70,wood(),0,-.40,0));
    for(const x of [-.73,.73])for(const z of [-.23,.23])grp.add(box(.065,.61,.065,metal(),x,-.05,z));
    break;}
   case 'lamp':{
    grp.add(cylinder(.32,.38,.43,mat(0xe7c393,{metalness:.44,transparent:true,opacity:.75}),0,-.13,0));grp.add(cylinder(.30,.34,.22,mat(0xf4b768,{transparent:true,opacity:.62}),0,-.23,0));grp.add(cylinder(.065,.065,.19,metal(),0,.20,0));grp.add(cylinder(.18,.18,.075,mat(0x344750),0,.27,0));
    const cap=cylinder(.11,.13,.28,mat(0x4b6270,{metalness:.54}),0,.47,0);cap.name='removableAlcoholLampCap';grp.add(cap);grp.userData.cap=cap;
    flame=mesh(new THREE.ConeGeometry(.11,.34,12),new THREE.MeshBasicMaterial({color:0xffba59,transparent:true,opacity:.93}),0,.51,0);flame.visible=false;grp.add(flame);break;}
   case 'burette':{
    grp.add(cylinder(.11,.12,1.4,metal(),0,-.06,0));grp.add(box(.8,.08,.6,metal(),0,-.76,0));grp.add(cylinder(.047,.047,1.85,g,.27,.1,0));grp.add(box(.58,.06,.08,metal(),.2,.45,0));break;}
  }
  grp.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
  return {group:grp,liquid,flame};
 }
 spawn(type,x=null,z=null){
  if(!EQUIPMENT[type])throw new Error(`unknown equipment: ${type}`);
  if(x===null){const n=this.entities.size;x=clamp3(-3.7+(n%6)*1.34,-4,4);z=0;}else z=0;
  const spec=EQUIPMENT[type];const visual=this.makeObject(type);const id=this.nextId++;const height=['tube','pipette','rod','thermometer','burette'].includes(type)?1.2:type==='rack'?.7:.85;
  const dims=type==='rack'?[.82,.34,.35]:type==='burette'?[.42,.9,.33]:type==='rod'||type==='pipette'||type==='thermometer'?[.075,.79,.08]:type==='tube'?[.14,.58,.14]:[.35,height/2,.35];
  const body=new CANNON.Body({mass:spec.mass,linearDamping:.13,angularDamping:.23,position:new CANNON.Vec3(x,height/2+.11,z)});
  if(type==='rack'){
    // Compound rails + bottom shelf leave the central tubes' space empty.
    const add=(size,offset)=>body.addShape(new CANNON.Box(new CANNON.Vec3(...size)),new CANNON.Vec3(...offset));
    add([.82,.055,.35],[0,-.40,0]);
    for(const bx of [-.73,.73])for(const bz of [-.23,.23])add([.035,.30,.035],[bx,-.05,bz]);
    // Two longitudinal top rails + thin transverse dividers around each slot.
    for(const bz of [-.25,.25])add([.82,.04,.05],[0,.27,bz]);
    for(const bx of [-.72,-.24,.24,.72])add([.035,.04,.20],[bx,.27,0]);
  } else body.addShape(new CANNON.Box(new CANNON.Vec3(...dims)));
  body.allowSleep=true;body.sleepSpeedLimit=.16;body.sleepTimeLimit=.5;this.world.addBody(body);
  body.addEventListener('collide',e=>{const ent=this.entities.get(id);if(!ent||ent.broken||ent.held)return;let impact=0;try{impact=Math.abs(e.contact.getImpactVelocityAlongNormal());}catch{impact=body.velocity.length();}if(impact>3.7&&spec.fragile&&ent.collidable){this.pendingBreaks.add(id);}});
  visual.group.traverse(v=>{v.userData.equipmentId=id;});this.scene.add(visual.group);
  const ent={id,type,spec,body,...visual,volume:['tube','beaker','flask'].includes(type)?0:null,inventoryMl:type==='reagent'?60:type==='lamp'?25:0,reagentId:type==='reagent'?'water':type==='lamp'?'alcohol':null,capacityMl:type==='tube'?20:type==='beaker'?150:type==='flask'?125:60,broken:false,held:false,hover:false,collidable:true,height,spawnY:body.position.y,spilled:0,tilt:0,capAttached:type==='lamp',capMesh:visual.group.userData.cap??null};
  if(['tube','beaker','flask'].includes(type)){
    const fx=new THREE.Group();ent.effect=fx;visual.group.add(fx);
    for(let i=0;i<14;i++){const m=sphere(.024,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.80}),(Math.random()-.5)*.36,-.30+Math.random()*.34,(Math.random()-.5)*.30);fx.add(m);}
    fx.visible=false;
    ent.steam=mesh(new THREE.SphereGeometry(.15,9,7),new THREE.MeshBasicMaterial({color:0xe2f6fa,transparent:true,opacity:.24,depthWrite:false}),0,.74,0);ent.steam.visible=false;visual.group.add(ent.steam);
  }
  this.entities.set(id,ent);return ent;
 }
 remove(ent){this.held.forEach((id,i)=>{if(id===ent.id)this.held.delete(i)});this.scene.remove(ent.group);ent.group.traverse(o=>{if(o.geometry)o.geometry.dispose?.();});this.world.removeBody(ent.body);this.entities.delete(ent.id);}
 shatter(ent){
  if(ent.broken)return;ent.broken=true;const p=ent.body.position.clone();const name=ent.spec.name;const liquid=ent.volume||0;
  this.remove(ent);if(this.lastSelected===ent.id){this.lastSelected=null;this.selectionAxes.visible=false;this.onSelect(null)};
  this.makeShards(p);if(liquid)this.makeSpill(p,liquid);
  this.onEvent(`${name}受到较大碰撞：玻璃破裂${liquid?'，液体洒出':''}。这是简化的破碎判定。`,'danger');
 }
 makeShards(pos){
  for(let i=0;i<11;i++){
   const p=new THREE.Mesh(new THREE.TetrahedronGeometry(.045+Math.random()*.09),new THREE.MeshStandardMaterial({color:0x9ddde4,transparent:true,opacity:.62,metalness:.25}));p.position.set(pos.x+(Math.random()-.5)*.6,.12,pos.z+(Math.random()-.5)*.6);p.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);this.scene.add(p);
  }
 }
 makeSpill(pos,ml,color=0x4fd8d0){
  if(!(ml>0))return;
  // Accumulate drops into existing visible puddles, instead of creating a new
  // GPU mesh every animation frame (which caused stuttering and memory growth).
  let pool=this.spillPools.find(p=>Math.hypot(p.x-pos.x,p.z-pos.z)<.50);
  if(!pool){
   const disc=mesh(new THREE.CircleGeometry(1,30),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.38,depthWrite:false}),pos.x,.102,pos.z);
   disc.rotation.x=-Math.PI/2;this.scene.add(disc);
   pool={x:pos.x,z:pos.z,ml:0,mesh:disc};this.spillPools.push(pool);
   if(this.spillPools.length>30){const old=this.spillPools.shift();this.scene.remove(old.mesh);old.mesh.geometry.dispose();old.mesh.material.dispose();}
  }
  pool.ml+=ml;const r=.12+Math.min(.72,Math.sqrt(pool.ml)*.082);pool.mesh.scale.set(r,r,1);
 }
 select(ent){this.lastSelected=ent?.id??null;this.selectionAxes.visible=!!ent;this.onSelect(ent||null);}
 resetHandDepth(){for(const f of this.handFilters)f.reset();}
 setHandStability(level){
  const n=clamp3(Number(level)||3,1,5),speed=[.70,.54,.39,.28,.20][n-1];
  for(const f of this.handFilters){f.alpha=speed;f.deadZone=.006+n*.0018;f.reset();}
  return n;
 }
 setTool(value){
  if(!['grab','view','walk'].includes(value))return;
  if(this.mouseHeld)this.releaseMouse();
  const leavingWalk=this.tool==='walk' && value!=='walk';
  if((value==='walk'||value==='view')&&this.presentation==='desk')this.setPresentation('explore');
  this.tool=value;this.walkKeys.clear();this.walkLooking=false;this.walkLast=null;
  if(value==='walk'){
   // Start close to the tabletop, not from the distant orbit-camera position.
   this.camera.position.set(0,2.35,6.3);
   this.camera.lookAt(0,.8,0);
   const forward=this.camera.getWorldDirection(new THREE.Vector3());
   this.walkYaw=Math.atan2(-forward.x,-forward.z);
   this.walkPitch=Math.asin(THREE.MathUtils.clamp(forward.y,-1,1));
   this.camera.rotation.order='YXZ';this.camera.rotation.set(this.walkPitch,this.walkYaw,0,'YXZ');
   this.controls.enabled=false;this.renderer.domElement.style.cursor='grab';
   this.onEvent('WASD漫游已开启：WASD/方向键平移、Q/E升降、Shift加速、左键拖动转头。','good');
   return;
  }
  if(leavingWalk){
   const forward=this.camera.getWorldDirection(new THREE.Vector3());
   this.controls.target.copy(this.camera.position).addScaledVector(forward,5);
  }
  this.controls.enabled=true;this.controls.enableRotate=this.presentation==='explore';this.controls.enablePan=this.presentation==='explore';this.controls.update();
  this.renderer.domElement.style.cursor=value==='view'?'grab':'crosshair';
  this.onEvent(value==='view'?'镜头模式：左键旋转、右键平移、滚轮缩放。':'器材模式：拖拽器材；在空白处仍可旋转镜头。','info');
 }
 updateWalk(dt){
  if(this.tool!=='walk')return;
  const delta=walkDelta({yaw:this.walkYaw,keys:this.walkKeys,dt});
  if(!delta.x&&!delta.y&&!delta.z)return;
  this.camera.position.set(
   clamp3(this.camera.position.x+delta.x,-7,7),
   clamp3(this.camera.position.y+delta.y,.45,6.5),
   clamp3(this.camera.position.z+delta.z,-7,12));
 }
 setDragMode(value){if(!['free','xz','y','z'].includes(value))return;
  this.dragMode=value;
  if(this.lastPointer)this.lastPointer.mode=value;
 }
 setView(name){
  if(name==='front'&&this.presentation==='desk')return true;
  if(this.presentation==='desk')this.setPresentation('explore');
  const views={iso:{position:[6,5.6,9.7],target:[0,.8,.45]},front:{position:[0,3.5,10.4],target:[0,.7,0]},top:{position:[.01,11,.01],target:[0,0,0]},side:{position:[10,3.5,.01],target:[0,.7,0]}};
  const v=views[name];if(!v)return false;
  this.controls.target.set(...v.target);this.camera.position.set(...v.position);
  this.camera.lookAt(this.controls.target);this.controls.update();return true;
 }
 focusSelected(){
  const ent=this.entities.get(this.lastSelected);if(!ent)return false;
  const target=new THREE.Vector3(ent.body.position.x,ent.body.position.y,ent.body.position.z);
  const offset=this.camera.position.clone().sub(this.controls.target);
  this.controls.target.copy(target);this.camera.position.copy(target.clone().add(offset));this.controls.update();return true;
 }

 nearest(worldPos,max=.74){let best=null,dist=max;for(const ent of this.entities.values()){
  if(ent.broken||ent.held)continue;
  const p=ent.body.position;const d=Math.hypot((p.x-worldPos.x)*.95,(p.y-worldPos.y)*.85,(p.z-worldPos.z)*.67);
  if(d<dist){best=ent;dist=d;}
 }return best;}
 setHeld(ent,owner,p,hit=null){if(!ent||ent.broken||ent.held||this.held.has(owner))return false;
  // The equipment does not jump to palm center. The fingertip holds a surface
  // anchor of the model, preserving object/hand offset as the hand moves.
  const q=ent.body.position;
  this.heldOffsets.set(owner,{x:p.x-q.x,y:p.y-q.y,z:p.z-q.z,kind:hit?.pose||'pinch',anchor:hit?.anchor||null});
  ent.seatedIn=null;ent.held=true;ent.body.type=CANNON.Body.KINEMATIC;ent.body.mass=0;ent.body.updateMassProperties();ent.body.velocity.set(0,0,0);ent.body.angularVelocity.set(0,0,0);ent.body.wakeUp();
  this.held.set(owner,ent.id);this.select(ent);
  this.onEvent(`已确认${hit?.pose==='power'?'握拳式':'捏合式'}抓取 ${ent.spec.name}；松开手才会释放。`,'good');return true;
 }
 moveHeld(owner,p){const ent=this.entities.get(this.held.get(owner));if(!ent)return;const q=ent.body.position;const off=this.heldOffsets.get(owner)||{x:0,y:0,z:0};
  const x=clamp3(p.x-off.x,-4.25,4.25),y=clamp3(p.y-off.y,.20,3.4),z=typeof owner==='number'?0:clamp3(p.z-off.z,-1.8,1.8);
  ent.body.velocity.set((x-q.x)*7,(y-q.y)*7,(z-q.z)*7);ent.body.position.set(x,y,z);ent.body.wakeUp();}
 release(owner){const ent=this.entities.get(this.held.get(owner));if(!ent)return false;
  if(ent.type==='tube' && this.trySeatTube(ent,owner))return true;
  this.held.delete(owner);this.heldOffsets.delete(owner);ent.held=false;
  // No floating bottle on release. Smart assistance acts only while held;
  // explicit release always returns control to rigid-body gravity.
  ent.body.type=CANNON.Body.DYNAMIC;ent.body.mass=ent.spec.mass;ent.body.updateMassProperties();ent.body.velocity.scale(.12,ent.body.velocity);ent.body.angularVelocity.set(.3,.07,.28);ent.body.wakeUp();this.onEvent(`松开${ent.spec.name}：器材进入实时3D重力与碰撞计算。`,'warn');return true;}
 trySeatTube(tube,owner){
  const rack=[...this.entities.values()].find(e=>e.type==='rack'&&!e.broken);
  if(!rack||!tube||tube.broken)return false;
  const seat=rackSlotFor(tube.body.position,rack.body.position);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion(tube.body.quaternion.x,tube.body.quaternion.y,tube.body.quaternion.z,tube.body.quaternion.w));
  if(!seat||up.y<.75)return false;
  this.held.delete(owner);this.heldOffsets.delete(owner);tube.held=false;
  tube.body.type=CANNON.Body.STATIC;tube.body.mass=0;tube.body.updateMassProperties();tube.body.velocity.setZero();tube.body.angularVelocity.setZero();
  tube.body.position.set(seat.x,seat.y,seat.z);tube.body.quaternion.set(0,0,0,1);tube.seatedIn=rack.id;
  this.select(tube);this.onEvent('试管对准孔位并插入试管架，底部已进入架内，而非悬浮在表面。','good');return true;
 }
 setLampCapState(attached,{placeSafely=false}={}){
  let changed=0;
  for(const ent of this.entities.values())if(ent.type==='lamp'&&!ent.broken){
   if(attached){
    if(ent.capMesh){
     const old=this.fallenParts.findIndex(part=>part.sourceId===ent.id);
     if(old>=0){this.world.removeBody(this.fallenParts[old].body);this.fallenParts.splice(old,1);}
     ent.capMesh.visible=true;ent.capMesh.position.set(0,.47,0);if(ent.capMesh.parent!==ent.group)ent.group.add(ent.capMesh);
    }
    ent.capAttached=true;changed++;
   }else if(ent.capAttached){this.dropLampCap(ent,{placeSafely});changed++;}
  }
  return changed>0;
 }
 dropLampCap(ent,{placeSafely=false}={}){
  if(!ent?.capAttached||!ent.capMesh)return false;
  ent.capAttached=false;
  ent.group.updateMatrixWorld(true);
  const worldPos=new THREE.Vector3();ent.capMesh.getWorldPosition(worldPos);
  ent.group.remove(ent.capMesh);this.scene.add(ent.capMesh);
  if(placeSafely){worldPos.set(ent.body.position.x+.55,.31,ent.body.position.z);}
  ent.capMesh.position.copy(worldPos);
  const body=new CANNON.Body({mass:.03,shape:new CANNON.Cylinder(.13,.11,.28,10),position:new CANNON.Vec3(worldPos.x,worldPos.y,worldPos.z)});
  body.velocity.set(placeSafely?0:.12,0,placeSafely?0:.03);this.world.addBody(body);this.fallenParts.push({mesh:ent.capMesh,body,sourceId:ent.id});
  this.onEvent(placeSafely?'已取下酒精灯灯帽并轻放在桌面。':'酒精灯倾倒：灯帽脱离灯口，受重力掉落。',placeSafely?'good':'warn');return true;
 }
 setReagent(ent,reagentId){
  if(!ent||ent.type!=='reagent')return false;ent.reagentId=reagentId;ent.inventoryMl=60;
  const appearance=reagentAppearance(reagentId);
  if(ent.liquid){ent.liquid.material.color.set(appearance.color);ent.liquid.material.opacity=appearance.opacity;ent.liquid.material.needsUpdate=true;}
  return true;
 }
 updateLiquid(ent,state){
  if(!ent||!this.entities.has(ent.id))return;
  if(ent.type==='reagent'){
    if(ent.liquid){ent.liquid.visible=ent.inventoryMl>.02;ent.liquid.scale.y=Math.max(.015,ent.inventoryMl/60);ent.liquid.position.y=-.36+ent.inventoryMl/60*.12;}
    return;
  }
  if(!['tube','beaker','flask'].includes(ent.type))return;
  ent.volume=state.volumeMl;
  const fill=Math.min(1,(ent.volume||0)/ent.capacityMl);
  if(ent.liquid){ent.liquid.visible=fill>.001;ent.liquid.scale.y=Math.max(.02,fill*2.8);ent.liquid.position.y=ent.type==='tube'?- .46+fill*.28:ent.type==='flask'?-.43+fill*.28:-.26+fill*.18;ent.liquid.material.color.set(state.color||'#e8f8fa');ent.liquid.material.opacity=state.opacity??.23;}
  if(state.gasMmol>.0002&&state.gasMmol>(ent.lastGasMmol||0)+.0001)ent.gasUntil=performance.now()+4000;
  ent.lastGasMmol=state.gasMmol;ent.lastPrecipitateG=state.precipitateG;
  if(ent.effect)ent.effect.visible=state.precipitateG>.0002||(state.gasMmol>.0002&&performance.now()<(ent.gasUntil||0));
  if(ent.effect)for(const dot of ent.effect.children)dot.material.color.set(state.precipitateG>.0002?0xf5f9fb:0xdcf5fd);
  if(ent.steam)ent.steam.visible=state.temperatureC>=85&&ent.volume>.1;
 }
 /** Unity-style assist: player chooses material and target; positional aim is eased.
  * Dose, mixing and microscopic visuals are still driven by ExperimentEngine.
  */
 startAssistedPour(reagentId,amountMl=3){
  if(this.assisted?.session.active)return {ok:false,reason:'上一轮倾倒还在进行，请先停止。'};
  const target=this.getReceiver();if(!target)return {ok:false,reason:'找不到可接收液体的试管/烧杯/锥形瓶。'};
  let source=this.entities.get(this.lastSelected);
  if(source?.type!=='reagent'||source.reagentId!==reagentId)source=[...this.entities.values()].find(e=>e.type==='reagent'&&e.reagentId===reagentId&&e.inventoryMl>0);
  if(!source){source=this.spawn('reagent',2.6,.6);this.setReagent(source,reagentId);}
  const plan=canTransfer({sourceType:source.type,targetType:target.type,inventoryMl:source.inventoryMl,requestedMl:amountMl,capacityRemainingMl:target.capacityMl-(target.volume||0)});
  if(!plan.ok)return plan;
  if(source.held){for(const [k,id] of this.held)if(id===source.id)this.held.delete(k);source.held=false;this.mouseHeld=null;this.lastPointer=null;this.controls.enabled=true;}
  source.body.type=CANNON.Body.KINEMATIC;source.body.mass=0;source.body.updateMassProperties();source.body.velocity.setZero();source.body.angularVelocity.setZero();source.held=true;
  const session=new AssistedPour({rateMlPerSec:2.3});session.start(plan.accepted);
  this.assisted={source,target,session,phase:'align',elapsed:0,requested:amountMl};this.assistedStreamClock=0;
  this.select(source);this.onEvent(`辅助对准：${source.spec.name}正在移动至${target.spec.name}上方，接下来会逐步倒入${plan.accepted.toFixed(2)}mL。`,'good');
  return {ok:true,accepted:plan.accepted,shortfall:plan.shortfall};
 }
 stopAssistedPour(){
  if(!this.assisted)return false;this.assisted.session.cancel();this.finishAssistedPour(true);return true;
 }
 finishAssistedPour(interrupted=false){
  const task=this.assisted;if(!task)return;
  const {source,target,session}=task;
  source.held=false;source.tilt=0;source.body.type=CANNON.Body.STATIC;source.body.mass=0;source.body.updateMassProperties();
  source.body.velocity.setZero();source.body.angularVelocity.setZero();
  source.body.position.set(Math.min(4.05,target.body.position.x+1.2),.54,Math.min(1.65,target.body.position.z+.5));
  source.body.quaternion.set(0,0,0,1);
  this.assisted=null;
  this.onEvent(`${interrupted?'已停止':'已完成'}辅助倒液：实际加入${session.delivered.toFixed(2)} mL。瓶子已安全放回台面。`,'good');
 }
 updateAssisted(dt){
  if(this.assistedPaused)return;
  const job=this.assisted;if(!job)return;
  if(!this.entities.has(job.source.id)||!this.entities.has(job.target.id)){this.assisted=null;return;}
  const {source,target,session}=job;
  job.elapsed+=dt;
  const dest=new THREE.Vector3(target.body.position.x+.20,target.body.position.y+1.35,target.body.position.z+.13);
  const at=source.body.position;const blend=Math.min(1,dt*6.5);
  at.x+=(dest.x-at.x)*blend;at.y+=(dest.y-at.y)*blend;at.z+=(dest.z-at.z)*blend;
  if(job.phase==='align'&&Math.hypot(at.x-dest.x,at.y-dest.y,at.z-dest.z)<.09){job.phase='pour';this.onEvent('瓶口已自动对准。开始逐步倾倒，浓度/液量与反应同步更新。','good');}
  const roll=job.phase==='pour'?-1.05:-.15;
  source.body.quaternion.setFromEuler(0,0,roll);
  if(job.phase!=='pour')return;
  const dose=Math.min(session.step(dt),source.inventoryMl);
  if(dose>0){source.inventoryMl=Math.max(0,source.inventoryMl-dose);this.onTransfer(source,target,dose);this.updateLiquid(source,{});}
  this.assistedStreamClock+=dt;
  if(this.assistedStreamClock>.17){this.showPourStream(source,target,.36);this.assistedStreamClock=0;}
  if(!session.active)this.finishAssistedPour();
 }
 demoPour(reagentId,amountMl=3){return this.startAssistedPour(reagentId,amountMl);}
 getReceiver(){return this.entities.get(this.receiverId)||[...this.entities.values()].find(e=>e.type==='beaker'&&!e.broken)||[...this.entities.values()].find(e=>['tube','flask'].includes(e.type)&&!e.broken)||null;}
 setReceiver(ent){if(ent&&['tube','beaker','flask'].includes(ent.type)){this.receiverId=ent.id;this.select(ent);return true;}return false;}
 showPourStream(source,target,amount){
  const from=new THREE.Vector3(source.body.position.x,source.body.position.y+.38,source.body.position.z);
  const to=new THREE.Vector3(target.body.position.x,target.body.position.y+.24,target.body.position.z);
  if(from.distanceTo(to)<.2)from.y+=1.2;
  if(from.y<to.y+.3)from.y=to.y+1.4;
  const duration=Math.max(.6,Math.min(3,amount*.22));
  const dropletColor=source.reagentId?reagentAppearance(source.reagentId).color:source.liquid?.material?.color?.getHex?.()??0xe8f8fa;
  for(let i=0;i<Math.min(65,Math.max(14,Math.round(amount*7)));i++){
   const bead=sphere(.025+Math.random()*.012,new THREE.MeshBasicMaterial({color:dropletColor,transparent:true,opacity:.55}));
   const p=i/Math.max(1,Math.round(amount*7));bead.position.copy(from);this.scene.add(bead);
   this.flowParticles.push({mesh:bead,from:from.clone(),to:to.clone(),p:-i*.024,rate:1/duration,life:performance.now()+duration*1600});
  }
 }
 setVolume(ml){const ent=[...this.entities.values()].find(e=>e.type==='tube'&&!e.broken);if(!ent)return null;
  const previous=ent.volume||0;ent.volume=clamp3(ml,0,20);if(ent.liquid){ent.liquid.scale.y=Math.max(.015,ent.volume/6);ent.liquid.position.y=-.49+ent.volume/20*.38;}
  this.select(ent);if(ml>20){this.onEvent('试管容量20mL：超过部分会溢出。','danger');this.makeSpill(ent.body.position,ml-20);}return ent.volume;
 }
 setLampLit(lit){for(const e of this.entities.values())if(e.type==='lamp'&&e.flame){if(lit&&e.capAttached)this.dropLampCap(e);e.flame.visible=lit;}}
 rackTube(){const t=[...this.entities.values()].find(e=>e.type==='tube'&&!e.broken),rack=[...this.entities.values()].find(e=>e.type==='rack'&&!e.broken);if(!t||!rack)return false;
  for(const [owner,id] of this.held)if(id===t.id){this.held.delete(owner);this.heldOffsets.delete(owner);}
  t.body.position.set(rack.body.position.x,rack.body.position.y+.7,rack.body.position.z);t.body.quaternion.set(0,0,0,1);t.held=true;
  return this.trySeatTube(t,'rack-button');
 }
 isTubeInRack(){const t=[...this.entities.values()].find(e=>e.type==='tube'&&!e.broken),r=[...this.entities.values()].find(e=>e.type==='rack'&&!e.broken);return !!(t&&r&&t.seatedIn===r.id&&t.body.type===CANNON.Body.STATIC);}
 updateHands(hands,missing=false){
  const tracked=hands.length>0;if(tracked)this.lostSince=null;
  else if(this.lostSince===null)this.lostSince=performance.now();
  const overlay=[];this.highlight.visible=false;
  for(let i=0;i<2;i++){
   const hand=hands[i],hm=this.handModels[i];hm.root.visible=!!hand;
   if(!hand)continue;
   const w=this.handWorld(hand,i),coords=[];
   for(let k=0;k<21;k++){
    const l=hand.points[k],x=w.x+(hand.position.x-l.x)*3.1,y=w.y+(hand.position.y-l.y)*2.1,z=.09;
    hm.joints[k].position.set(x,y,z);coords.push(new THREE.Vector3(x,y,z));
   }
   const arr=hm.lines.geometry.attributes.position.array;
   for(let j=0;j<CONNECTIONS.length;j++){const [a,b]=CONNECTIONS[j];arr.set(coords[a].toArray(),j*6);arr.set(coords[b].toArray(),j*6+3);}
   hm.lines.geometry.attributes.position.needsUpdate=true;
   const fingertip=coords[4].clone().add(coords[8]).multiplyScalar(.5);
   const palm=coords[0].clone().add(coords[9]).multiplyScalar(.5);
   const gripPoint=hand.gripKind==='power'||hand.pose==='power'?palm:fingertip;
   hm.halo.position.copy(gripPoint);hm.halo.rotation.x=0;
   hm.grip.position.copy(gripPoint);hm.grip.visible=this.held.has(i);
   const cursor={x:gripPoint.x,y:gripPoint.y,z:0};
   // Contact only highlights a candidate; acquisition ONLY on a fresh,
   // stable open->closed gesture event. Already-closed hands cannot auto-grab.
   const hit=pickGripTarget(this.entities.values(),cursor,hand.gripKind||hand.pose,{radius:.58});
   if(hand.change==='release')this.release(i);
   if(this.held.has(i)){
    this.moveHeld(i,cursor);
    const ent=this.entities.get(this.held.get(i));
    if(ent){const wrist=hand.points[0],knuckle=hand.points[9];const roll=clamp3(Math.atan2(knuckle.x-wrist.x,wrist.y-knuckle.y)*.65,-1.25,1.25);ent.body.quaternion.setFromEuler(0,0,roll);}
   }else if(hand.change==='grab'){
    if(hit)this.setHeld(hit.entity,i,cursor,hit);
    else this.onEvent(`手${i+1}已做抓握动作，但没有碰到适合这种抓法的器材抓取点；请先张开手再尝试。`,'info');
   }
   const target=this.held.has(i)?this.entities.get(this.held.get(i)):hit?.entity;
   if(i===0&&!this.held.has(i)&&hit){this.highlight.visible=true;this.highlight.position.set(hit.anchor.x,hit.anchor.y,hit.anchor.z);}
   overlay.push({id:i,press:!!hand.grabbing,pose:hand.pose,kind:hand.gripKind,holding:this.held.has(i),candidate:target?.spec.name||null,armed:hand.armed,handedness:hand.handedness,planeOnly:true});
  }
  // If the hand disappears due to glare, don't interpret that as a voluntary release.
  this.cameraHands=overlay;this.onGesture(overlay,missing);
 }
 releaseCameraHands(){
  for(const owner of [...this.held.keys()])if(typeof owner==='number')this.release(owner);
  this.cameraHands=[];this.highlight.visible=false;
 }
 getEnt(id){return this.entities.get(id)||null;}
 // Mouse input deliberately separates object manipulation from OrbitControls.
 // Ray/plane projection ensures perspective-correct X/Z tabletop movement.
 down(e){
  if(this.tool==='walk'){
   if(e.button!==0)return;this.walkLooking=true;this.walkLast={x:e.clientX,y:e.clientY};
   try{this.renderer.domElement.setPointerCapture(e.pointerId);}catch{}
   this.renderer.domElement.style.cursor='grabbing';e.preventDefault();return;
  }
  if(e.button!==0||this.mouseHeld||this.tool==='view')return;
  this.onHover(null);
  if(!this.raycast(e))return;
  const hits=this.raycaster.intersectObjects([...this.entities.values()].map(en=>en.group),true);
  if(!hits.length)return;const ent=this.entities.get(hits[0].object.userData.equipmentId);if(!ent)return;
  const at=new THREE.Vector3(ent.body.position.x,ent.body.position.y,ent.body.position.z);
  const normal=this.camera.getWorldDirection(new THREE.Vector3());
  const camPlane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,at);
  const tablePlane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),at);
  const screenHit=this.raycaster.ray.intersectPlane(camPlane,new THREE.Vector3())?.clone()||at.clone();
  const tableHit=this.raycaster.ray.intersectPlane(tablePlane,new THREE.Vector3())?.clone()||at.clone();
  this.lastPointer={x:e.clientX,y:e.clientY,world:at,screenHit,tableHit,camPlane,tablePlane,depthOffset:0,manualOffset:new THREE.Vector3()};
  this.mouseHeld=ent.id;this.controls.enabled=false;
  try{this.renderer.domElement.setPointerCapture(e.pointerId);}catch{}
  this.setHeld(ent,'mouse',{x:at.x,y:at.y,z:at.z});e.preventDefault();
 }
 hoverAt(e){
  if(this.tool==='view'||!this.raycast(e)){this.onHover(null);return;}
  const hits=this.raycaster.intersectObjects([...this.entities.values()].map(en=>en.group),true);
  const id=hits.find(h=>this.entities.has(h.object.userData.equipmentId))?.object.userData.equipmentId;
  const ent=this.entities.get(id);
  const rect=this.renderer.domElement.getBoundingClientRect();
  this.onHover(ent||null,e.clientX-rect.left,e.clientY-rect.top);
 }
 raycast(e){
  const r=this.renderer.domElement.getBoundingClientRect();if(!r.width||!r.height)return null;
  this.pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  this.raycaster.setFromCamera(this.pointer,this.camera);return true;
 }
 move(e){
  if(this.tool==='walk'){
   this.onHover(null);
   if(this.walkLooking && this.walkLast){
    const dx=e.clientX-this.walkLast.x,dy=e.clientY-this.walkLast.y;this.walkLast={x:e.clientX,y:e.clientY};
    this.walkYaw-=dx*.0045;this.walkPitch=clamp3(this.walkPitch-dy*.0045,-1.30,1.30);
    this.camera.rotation.set(this.walkPitch,this.walkYaw,0,'YXZ');
   }return;
  }
  if(!this.mouseHeld){this.hoverAt(e);return;}
  this.onHover(null);
  if(!this.lastPointer||!this.raycast(e))return;
  const s=this.lastPointer; s.lastX=e.clientX;s.lastY=e.clientY;const dy=(e.clientY-s.y)/Math.max(1,this.renderer.domElement.clientHeight);
  const target=s.world.clone();
  const mode=this.dragMode;
  if(mode==='free'){
   const hit=this.raycaster.ray.intersectPlane(s.camPlane,new THREE.Vector3());
   if(hit)target.add(hit.sub(s.screenHit));
   target.z+=s.depthOffset;
  }else if(mode==='xz'){
   const hit=this.raycaster.ray.intersectPlane(s.tablePlane,new THREE.Vector3());
   if(hit){target.x+=hit.x-s.tableHit.x;target.z+=hit.z-s.tableHit.z;}
  }else if(mode==='y')target.y-=dy*7;
  else if(mode==='z')target.z-=dy*7;
  target.add(s.manualOffset);if(this.presentation==='desk')target.z=0;this.moveHeld('mouse',{x:target.x,y:target.y,z:target.z});
 }
 wheel(e){
  if(!this.mouseHeld||!this.lastPointer||this.dragMode!=='free')return;
  e.preventDefault();
  this.lastPointer.depthOffset=clamp3(this.lastPointer.depthOffset-Math.sign(e.deltaY)*.24,-2.5,2.5);
  this.move({...e,clientX:this.lastPointer.lastX??this.lastPointer.x,clientY:this.lastPointer.lastY??this.lastPointer.y});
 }
 nudge(e){
  if(this.tool==='walk'){
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
   if(WALK_CODES.has(e.code)){e.preventDefault();this.walkKeys.add(e.code);}return;
  }
  if(!this.mouseHeld||!this.lastPointer||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  const offsets={KeyW:[0,0,-.13],KeyS:[0,0,.13],KeyQ:[0,.13,0],KeyE:[0,-.13,0],KeyA:[-.13,0,0],KeyD:[.13,0,0]};
  if(e.code==='KeyR'||e.code==='KeyF'){e.preventDefault();this.tiltHeld(e.code==='KeyR'?.14:-.14);return;}
  const o=offsets[e.code];if(!o)return;
  e.preventDefault();const ent=this.entities.get(this.mouseHeld);if(!ent)return;
  this.lastPointer.manualOffset.add(new THREE.Vector3(...o));
  this.moveHeld('mouse',{x:ent.body.position.x+o[0],y:ent.body.position.y+o[1],z:ent.body.position.z+o[2]});
 }
 tiltHeld(delta){const ent=this.entities.get(this.mouseHeld);if(!ent)return false;
  ent.tilt=clamp3(ent.tilt+delta,-1.45,1.45);
  ent.body.quaternion.setFromEuler(0,0,ent.tilt);return true;
 }
 releaseMouse(pointerId=null){
  if(!this.mouseHeld)return;this.release('mouse');this.mouseHeld=null;this.lastPointer=null;this.controls.enabled=true;
  if(pointerId!==null){try{if(this.renderer.domElement.hasPointerCapture(pointerId))this.renderer.domElement.releasePointerCapture(pointerId);}catch{}}
 }
 up(e){
  if(this.tool==='walk'){
   this.walkLooking=false;this.walkLast=null;this.renderer.domElement.style.cursor='grab';
   if(e?.pointerId!==undefined){try{if(this.renderer.domElement.hasPointerCapture(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);}catch{}}
   return;
  }this.releaseMouse(e?.pointerId??null);
 }
 draw(time=performance.now()){
  if(!this.active)return;requestAnimationFrame(t=>this.draw(t));const dt=Math.min((time-this.lastTime)/1000,.04);this.lastTime=time;
  this.updateWalk(dt);this.updateAssisted(dt);this.world.step(1/60,Math.max(0,dt),3);
  if(this.demoHeldUntil&&time>this.demoHeldUntil.until){const ent=this.entities.get(this.demoHeldUntil.id);if(ent){ent.held=false;ent.body.type=CANNON.Body.STATIC;ent.body.mass=0;ent.body.updateMassProperties();ent.body.velocity.setZero();ent.body.angularVelocity.setZero();ent.body.position.set(3.5,.56,1.22);ent.body.quaternion.set(0,0,0,1);}this.demoHeldUntil=null;}
  for(const part of this.fallenParts){part.mesh.position.copy(part.body.position);part.mesh.quaternion.copy(part.body.quaternion);}
  for(const id of this.pendingBreaks){const ent=this.entities.get(id);if(ent)this.shatter(ent);}this.pendingBreaks.clear();
  // Drop-based presentation for a deterministic transfer event. This is NOT full CFD.
  for(const droplet of this.flowParticles){
   droplet.p+=dt*droplet.rate;
   const u=clamp3(droplet.p,0,1);
   droplet.mesh.visible=droplet.p>=0&&droplet.p<=1;
   droplet.mesh.position.lerpVectors(droplet.from,droplet.to,u);
   droplet.mesh.position.y+=.30*u*(1-u);
  }
  const expired=this.flowParticles.filter(d=>d.p>1||performance.now()>d.life);
  for(const d of expired)this.scene.remove(d.mesh);
  this.flowParticles=this.flowParticles.filter(d=>d.p<=1&&performance.now()<=d.life);
  const receivers=[...this.entities.values()].filter(e=>['beaker','tube','flask'].includes(e.type)&&!e.broken);
  for(const src of this.entities.values()){
    if(!['reagent','tube','beaker','flask'].includes(src.type)||!src.held||this.assisted?.source.id===src.id)continue;
    const quat=src.body.quaternion;
    const roll=2*Math.atan2(quat.z,quat.w);
    const remaining=src.type==='reagent'?src.inventoryMl:src.volume;
    if(remaining<=0)continue;
    const amount=dripRate({tilt:roll,remainingMl:remaining,dt,viscosity:src.reagentId==='brine'?1.2:src.reagentId==='indicator'?1.4:1,diameter:src.type==='tube'?.12:.3});
    if(amount<=0)continue;
    const point={x:src.body.position.x,y:src.body.position.y,z:0};
    const targetPoint=easyPourTarget(point,receivers.filter(e=>e!==src).map(e=>({...e.body.position,entity:e})),{horizontal:.84});
    const target=targetPoint?.entity;
    if(target){
      if(src.type==='reagent')src.inventoryMl-=amount;
      this.onTransfer(src,target,amount);this.updateLiquid(src,{});
      this.flowElapsed+=dt;
      if(this.flowElapsed>.12){this.showPourStream(src,target,.35);this.flowElapsed=0;}
      if(time-this.lastPourWarn>1400){this.lastPourWarn=time;this.onEvent(`${src.spec.name}向${target.spec.name}流动：液量、反应和微观图像随之更新。`,'good');}
    }else if(Math.abs(roll)>.75){
      // If there is no receiving vessel, material is lost to the tabletop.
      if(src.type==='reagent')src.inventoryMl=Math.max(0,src.inventoryMl-amount);
      else this.onSpill?.(src,amount);
      this.makeSpill(src.body.position,amount);
      if(time-this.lastSpillEvent>1300){this.lastSpillEvent=time;this.onEvent(`${src.spec.name}倾倒时没有接收容器，液体洒在桌面上。`,'warn');}
      this.updateLiquid(src,{});
    }
  }
  for(const lamp of this.entities.values())if(lamp.type==='lamp'&&lamp.inventoryMl>0){
    const q=lamp.body.quaternion,roll=Math.abs(2*Math.atan2(q.z,q.w));
    if(roll>.85){if(lamp.capAttached)this.dropLampCap(lamp);
      const dose=dripRate({tilt:roll,remainingMl:lamp.inventoryMl,dt,viscosity:1.1,diameter:.12});
      if(dose>.0001){lamp.inventoryMl=Math.max(0,lamp.inventoryMl-dose);this.makeSpill(lamp.body.position,dose);
        if(time-this.lastSpillEvent>1300){this.lastSpillEvent=time;this.onEvent('酒精灯倾倒：灯帽脱落，模拟燃料泄漏。现实中应远离火源并按安全规范处置。','danger');}
      }
    }
  }
  this.heatElapsed+=dt;
  if(this.heatElapsed>.09){
   const interval=this.heatElapsed;this.heatElapsed=0;
   const lamps=[...this.entities.values()].filter(e=>e.type==='lamp'&&e.flame?.visible);
   for(const ent of receivers){
     const nearby=lamps.some(l=>Math.hypot(ent.body.position.x-l.body.position.x,ent.body.position.z-l.body.position.z)<1.0&&Math.abs(ent.body.position.y-l.body.position.y)<1.75);
     this.onHeat(ent,interval,nearby);
   }
  }
  for(const ent of this.entities.values()){
   ent.group.position.copy(ent.body.position);ent.group.quaternion.copy(ent.body.quaternion);
   if(ent.volume>0&&!ent.held&&ent.body.type===CANNON.Body.DYNAMIC){
    const angle=2*Math.acos(clamp3(ent.body.quaternion.w,-1,1));
    if(angle>.75&&ent.body.position.y<1.35){const spilled=Math.min(ent.volume,.11);if(spilled>.01){this.onSpill(ent,spilled);ent.spilled+=spilled;if(ent.liquid){ent.liquid.scale.y=Math.max(.015,ent.volume/6);}if(ent.spilled<.15)this.onEvent('试管倾斜：液体开始洒出。','warn');}}
   }
   if(ent.flame?.visible)ent.flame.scale.y=.83+Math.sin(time*.013)*.18;
   if(ent.effect&&ent.type!=='reagent'&&ent.gasUntil&&time>ent.gasUntil&&!(ent.lastPrecipitateG>0))ent.effect.visible=false;
   if(ent.effect?.visible){let i=0;for(const dot of ent.effect.children){dot.position.y=-.37+((time*.00045+i*.084)%0.56);dot.position.x=Math.sin(time*.001+i*2.9)*.20;dot.position.z=Math.cos(time*.001+i*1.3)*.18;i++;}}
   if(ent.steam?.visible){ent.steam.position.y=.8+(time*.00025%1)*.35;ent.steam.material.opacity=.12+.11*Math.sin(time*.001);}
  }
  const selectedEnt=this.entities.get(this.lastSelected);
  if(selectedEnt){this.selectionAxes.visible=true;this.selectionAxes.position.copy(selectedEnt.body.position);}
  else this.selectionAxes.visible=false;
  if(this.tool!=='walk')this.controls.update();this.renderer.render(this.scene,this.camera);
 }
}
