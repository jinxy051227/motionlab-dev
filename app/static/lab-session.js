/** Small, private, browser-tab-only experiment handoff between 2D and 3D.
 * Transfers chemical state of the primary receiver, not camera frames or
 * every 3D object. Individual vessels remain independent within 3D mode.
 */
const KEY='motionlab.v0.9.primary-vessel';
export function readSession(store=typeof sessionStorage==='undefined'?null:sessionStorage){
 try{const value=JSON.parse(store?.getItem(KEY)||'null');if(!value||value.v!==1||!value.engine||!value.scenario||Date.now()-value.at>12*3600e3)return null;return value;}catch{return null;}
}
export function saveSession(scenario,engine,store=typeof sessionStorage==='undefined'?null:sessionStorage){
 if(!engine||!store)return false;
 try{store.setItem(KEY,JSON.stringify({v:1,at:Date.now(),scenario,engine:engine.snapshot()}));return true;}catch{return false;}
}
export function clearSession(store=typeof sessionStorage==='undefined'?null:sessionStorage){try{store?.removeItem(KEY);}catch{}}
