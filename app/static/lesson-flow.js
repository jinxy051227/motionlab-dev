/** Shared guided-learning plans. All actions are executed by the actual 2D/3D
 * chemistry engine, never by pre-recorded results. 'mL-equivalent' salt doses
 * are NOT a laboratory measurement of granular solid volume.
 */
export const LESSON_PLANS = Object.freeze({
 neutralization:[
  {id:'safety',type:'safety',title:'检查实验安全',instruction:'确认模拟佩戴护目镜，检查容器中已有10mL稀盐酸。',what:'先确认安全与起始溶液'},
  {id:'first',type:'pour',reagent:'naoh',amount:3,title:'第一次加入碱液',instruction:'选取0.10 mol/L NaOH，向盐酸中缓慢加入3mL，观察pH开始变化。',what:'观察酸性溶液逐渐接近中性'},
  {id:'second',type:'pour',reagent:'naoh',amount:7,title:'接近理论等量点',instruction:'继续加入约7mL NaOH，接近总加入量10mL，关注pH与离子变化。',what:'理论等量点为10.00mL，酚酞终点并不完全相同'},
  {id:'observe',type:'observe',title:'观察微观离子',instruction:'进入微观视图，解释H₃O⁺与OH⁻中和、Na⁺与Cl⁻作为旁观离子的现象。',what:'观看微观图与实时pH并生成学习记录'},
 ],
 precipitate:[
  {id:'safety',type:'safety',title:'检查实验安全',instruction:'确认模拟佩戴护目镜；容器已有氯化钙溶液。',what:'准备两种溶液'},
  {id:'first',type:'pour',reagent:'na2co3',amount:3,title:'混合碳酸钠溶液',instruction:'向氯化钙溶液加入3mL碳酸钠溶液，观察白色沉淀。',what:'观察CaCO₃沉淀与离子变化'},
  {id:'observe',type:'observe',title:'查看沉淀微观示意',instruction:'查看Ca²⁺、CO₃²⁻变成CaCO₃(s)的教学示意。',what:'区分沉淀与溶液中的旁观离子'},
 ],
 gas:[
  {id:'safety',type:'safety',title:'检查实验安全',instruction:'确认模拟佩戴护目镜；容器已有稀醋酸。',what:'确认起始溶液'},
  {id:'first',type:'pour',reagent:'nahco3',amount:3,title:'加入碳酸氢钠',instruction:'缓慢加入3mL碳酸氢钠溶液，观察模拟CO₂气泡。',what:'观察气体发生'},
  {id:'observe',type:'observe',title:'观察微观变化',instruction:'解释CO₂从何而来，并注意该模型不计算真实气压。',what:'查看反应物消耗和生成物'},
 ],
 dissolution:[
  {id:'safety',type:'safety',title:'检查实验安全',instruction:'确认模拟佩戴护目镜，烧杯内已有20mL水。',what:'准备溶剂'},
  {id:'first',type:'pour',reagent:'salt',amount:2,title:'加入第一份食盐',instruction:'加入2格等效投料刻度的NaCl粉末（按教学模型折合4g），观察离子分散。',what:'观察溶解后的离子'},
  {id:'second',type:'pour',reagent:'salt',amount:2,title:'继续投料直到模拟饱和',instruction:'再加入2格等效投料刻度（再折合4g），观察是否有未溶固体。',what:'区分溶解与饱和'},
  {id:'observe',type:'observe',title:'观察溶质和未溶固体',instruction:'比较微观示意中的Na⁺、Cl⁻和NaCl(s)。',what:'理解饱和溶液'},
 ],
 heating:[
  {id:'safety',type:'safety',title:'检查实验安全',instruction:'确认模拟佩戴护目镜；烧杯内已有25mL水。',what:'检查水量与虚拟热源'},
  {id:'heat',type:'heat',seconds:15,title:'演示加热与蒸发',instruction:'进行约15秒的加速模拟加热。观察温度上升、蒸气和水量变化。',what:'本模型加热时间被加速，不代表真实实验耗时'},
  {id:'observe',type:'observe',title:'观察水的状态变化',instruction:'切到微观视图，比较液态和气态H₂O的教学示意。',what:'区分状态变化与化学反应'},
 ],
});
export function getLesson(scenario){const steps=LESSON_PLANS[scenario];if(!steps)throw new Error('没有对应实验教学计划：'+scenario);return steps;}
export function lessonProgress(scenario,{goggles=false,reagents={},temperatureC=20,observed=false}={}){
 const amounts={};return getLesson(scenario).map(step=>{
  if(step.type==='safety')return {...step,done:!!goggles};
  if(step.type==='pour'){
   amounts[step.reagent]=(amounts[step.reagent]||0)+step.amount;
   return {...step,done:(reagents[step.reagent]||0)>=amounts[step.reagent]-.05};
  }
  if(step.type==='heat')return {...step,done:temperatureC>=80};
  return {...step,done:!!observed};
 });
}

/** Frame-clock state machine; no background timers or fake chemistry.
 * Implementations supply start(step), update(step, dt, elapsed) and finish(step).
 * In single-step mode, exactly one planned action is completed per click.
 */
export class LessonDirector{
 constructor(scenario,adapter,onChange=()=>{}){
  this.adapter=adapter;this.onChange=onChange;this.reset(scenario);
 }
 reset(scenario=this.scenario){this.scenario=scenario;this.steps=getLesson(scenario);this.index=0;this.running=false;this.paused=false;this.single=false;this.started=false;this.elapsed=0;this.wait=0;this.error='';this.completed=false;this.notify();}
 get current(){return this.steps[this.index]||null;}
 get status(){return {scenario:this.scenario,index:this.index,count:this.steps.length,running:this.running,paused:this.paused,completed:this.completed,error:this.error,current:this.current};}
 notify(){this.onChange(this.status);}
 play(){if(this.completed)return false;this.running=true;this.paused=false;this.single=false;this.adapter.setPaused?.(false);this.notify();return true;}
 next(){if(this.completed||this.running)return false;this.running=true;this.paused=false;this.single=true;this.adapter.setPaused?.(false);this.notify();return true;}
 pause(){if(!this.running)return false;this.running=false;this.paused=true;this.adapter.setPaused?.(true);this.notify();return true;}
 tick(dt){
  if(!this.running||this.completed||!this.current)return;
  dt=Math.max(0,Math.min(.1,Number(dt)||0));
  if(this.wait>0){this.wait=Math.max(0,this.wait-dt);return;}
  const step=this.current;
  if(!this.started){
   try{const r=this.adapter.start(step);if(r===false||r?.ok===false)throw Error(r?.reason||'操作无法开始');}
   catch(e){this.error=String(e?.message||e);this.running=false;this.paused=true;this.notify();return;}
   this.started=true;this.elapsed=0;this.notify();
  }
  this.elapsed+=dt;
  let done=false;
  try{done=this.adapter.update(step,dt,this.elapsed)===true;}
  catch(e){this.error=String(e?.message||e);this.running=false;this.paused=true;this.notify();return;}
  if(this.elapsed>25){this.error=`${step.title}超时：请检查试剂量或模拟画面`;this.running=false;this.paused=true;this.notify();return;}
  if(!done)return;
  this.adapter.finish?.(step);
  this.index++;this.started=false;this.elapsed=0;this.error='';this.wait=.65;
  if(this.index>=this.steps.length){this.completed=true;this.running=false;this.paused=false;this.adapter.onComplete?.();}
  else if(this.single){this.running=false;this.paused=false;this.single=false;}
  this.notify();
 }
}
