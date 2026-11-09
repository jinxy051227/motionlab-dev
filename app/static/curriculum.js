/** Coverage index is based on Japan's junior-high science syllabus.
 * `implemented` denotes an executable, deliberately simplified educational model.
 * `catalog` denotes a researched learning objective ONLY, not a runnable experiment.
 */
export const CURRICULUM = Object.freeze([
 {grade:1,topic:'物质识别与密度测量',domain:'化学',status:'catalog'},
 {grade:1,topic:'气体的发生与收集',domain:'化学',status:'catalog'},
 {grade:1,topic:'氧气和二氧化碳的性质',domain:'化学',status:'catalog'},
 {grade:1,topic:'水溶液与均匀分散',domain:'化学',status:'catalog'},
 {grade:1,topic:'食盐溶解和饱和',domain:'化学',status:'implemented',scenario:'dissolution'},
 {grade:1,topic:'温度与溶解度曲线',domain:'化学',status:'catalog'},
 {grade:1,topic:'再结晶与固体回收',domain:'化学',status:'catalog'},
 {grade:1,topic:'熔点和沸点',domain:'物理/化学',status:'catalog'},
 {grade:1,topic:'水的沸腾与蒸发',domain:'物理/化学',status:'implemented',scenario:'heating'},
 {grade:1,topic:'蒸馏及物质分离',domain:'化学',status:'catalog'},
 {grade:1,topic:'光的反射与折射',domain:'物理',status:'catalog'},
 {grade:1,topic:'凸透镜成像',domain:'物理',status:'catalog'},
 {grade:1,topic:'声音产生与传播',domain:'物理',status:'catalog'},
 {grade:1,topic:'力和压力',domain:'物理',status:'catalog'},
 {grade:2,topic:'物质分解与原子分子',domain:'化学',status:'catalog'},
 {grade:2,topic:'铁和硫的化合',domain:'化学',status:'catalog'},
 {grade:2,topic:'氧化与还原',domain:'化学',status:'catalog'},
 {grade:2,topic:'化学变化与质量守恒',domain:'化学',status:'catalog'},
 {grade:2,topic:'碳酸钙沉淀生成',domain:'化学',status:'implemented',scenario:'precipitate'},
 {grade:2,topic:'醋酸与碳酸氢钠的气体生成',domain:'化学',status:'implemented',scenario:'gas'},
 {grade:2,topic:'电流和电压',domain:'物理',status:'catalog'},
 {grade:2,topic:'串并联电路',domain:'物理',status:'catalog'},
 {grade:2,topic:'电流与热量',domain:'物理',status:'catalog'},
 {grade:2,topic:'磁场和电磁感应',domain:'物理',status:'catalog'},
 {grade:3,topic:'离子和电解质',domain:'化学',status:'catalog'},
 {grade:3,topic:'酸碱中和与离子',domain:'化学',status:'implemented',scenario:'neutralization'},
 {grade:3,topic:'化学电池',domain:'化学',status:'catalog'},
 {grade:3,topic:'力学能守恒',domain:'物理',status:'catalog'},
 {grade:3,topic:'物体运动与力',domain:'物理',status:'catalog'},
 {grade:3,topic:'杠杆和功',domain:'物理',status:'catalog'},
]);
export const coverage=()=>({total:CURRICULUM.length,implemented:CURRICULUM.filter(x=>x.status==='implemented').length,catalog:CURRICULUM.filter(x=>x.status==='catalog').length});
