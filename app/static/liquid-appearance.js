/** Scientific-colour presets for the explicitly modelled school reagents.
 * Clear solutions really are colourless. The very pale cool tint is a renderer
 * highlight to make transparent liquid visible on dark lab backgrounds.
 * This is not a spectral absorption/CFD model.
 */
export const CLEAR = Object.freeze({color:'#e8f8fa',opacity:0.23,label:'无色透明',kind:'clear'});
export function reagentAppearance(id){
 if(id==='salt')return {color:'#f6f6f1',opacity:.97,label:'白色固体粉末',kind:'solid'};
 const names={water:'无色透明',hcl:'无色透明',naoh:'无色透明',cacl2:'无色透明',na2co3:'无色透明',vinegar:'无色透明',nahco3:'无色透明',brine:'无色透明',indicator:'无色透明（单独存在时）',alcohol:'无色透明'};
 return {...CLEAR,label:names[id]||'未校验颜色'};
}
export function mixtureAppearance({scenario,indicator=false,ph=7,precipitateG=0,undissolvedG=0}={}){
 if(indicator && scenario==='neutralization' && ph>8.3){
  const f=Math.max(0,Math.min(1,(ph-8.3)/1.7));
  return {color:`rgb(${Math.round(244-14*f)},${Math.round(167-65*f)},${Math.round(199-48*f)})`,opacity:.25+.28*f,label:'酚酞显粉红色（碱性）',kind:'indicator'};
 }
 if(scenario==='precipitate'&&precipitateG>0.0002)return {color:'#e8f7f8',opacity:.28,label:'无色液相，悬浮／沉积白色碳酸钙',kind:'precipitate'};
 if(scenario==='dissolution'&&undissolvedG>.01)return {color:'#e8f7f8',opacity:.26,label:'无色液相，底部有未溶食盐',kind:'solid-in-liquid'};
 return {...CLEAR};
}
