/** Camera-relative first-person WALK translation, independent of rendering. */
export const WALK_CODES = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','ShiftLeft','ShiftRight']);
export function walkDelta({yaw=0, keys=[], dt=0, speed=2.5}={}) {
  const s = keys instanceof Set ? keys : new Set(keys);
  const key = (...codes) => codes.some(c => s.has(c)) ? 1 : 0;
  const f = key('KeyW','ArrowUp') - key('KeyS','ArrowDown');
  const r = key('KeyD','ArrowRight') - key('KeyA','ArrowLeft');
  const up = key('KeyE') - key('KeyQ');
  const length = Math.hypot(f,r,up);
  if(!length || dt <= 0) return {x:0,y:0,z:0};
  const step = Math.min(dt,0.05) * speed * (key('ShiftLeft','ShiftRight') ? 2.3 : 1) / length;
  // In Three.js a camera with yaw=0 faces -Z; yaw=-π/2 faces +X.
  return {
    x: step * (-Math.sin(yaw)*f + Math.cos(yaw)*r),
    y: step * up,
    z: step * (-Math.cos(yaw)*f - Math.sin(yaw)*r),
  };
}
