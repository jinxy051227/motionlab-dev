/** Scientifically grounded ideal strong-acid / strong-base titration model.
 * HCl 0.100 M, 10.00 mL titrated with 0.100 M NaOH at 25 °C.
 * No activity corrections, indicators do not perturb equilibrium.
 */
export const CHEM = Object.freeze({acidM:0.100, baseM:0.100, acidMl:10.00, maxBaseMl:20, kw:1e-14});
export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export const equivalenceMl = CHEM.acidM*CHEM.acidMl/CHEM.baseM;

export function calculateTitration(baseMl, settings=CHEM) {
  if (!Number.isFinite(baseMl) || baseMl<0 || baseMl>settings.maxBaseMl) throw new RangeError('baseMl must be between 0 and 20 mL');
  const acidMol=settings.acidM*settings.acidMl/1000;
  const baseMol=settings.baseM*baseMl/1000;
  const volumeL=(settings.acidMl+baseMl)/1000;
  const net=(acidMol-baseMol)/volumeL;
  // Solve the water-ionization quadratic instead of a discontinuous 'if neutral' check.
  // [H+] - [OH-] = net, [H+][OH-] = Kw; stable form for net < 0 avoids cancellation.
  let h;
  if(net>=0) h=(net+Math.sqrt(net*net+4*settings.kw))/2;
  else h=(2*settings.kw)/(Math.sqrt(net*net+4*settings.kw)-net);
  const ph=clamp(-Math.log10(h),0,14);
  const oh=settings.kw/h;
  const indicator=clamp((ph-8.3)/1.7,0,1);  // pedagogical gradient, not a measured absorbance curve
  return {
    volumeMl:baseMl, ph, hM:h, ohM:oh, acidMol, baseMol,
    totalMl:settings.acidMl+baseMl,
    naMol:baseMol, clMol:acidMol,
    reactedMol:Math.min(acidMol,baseMol),
    excessAcidMol:Math.max(0,acidMol-baseMol),
    excessBaseMol:Math.max(0,baseMol-acidMol),
    equivalenceMl:settings.acidM*settings.acidMl/settings.baseM,
    indicator, nearEndpoint:baseMl>=9.5 && baseMl<=10.2,
  };
}

export function mapPinchToFlow(pinchRatio) {
  // Thumb-tip/index-tip separation divided by MCP palm width.
  // Keep low openings fine-grained for the last few drops.
  const open=clamp((pinchRatio-0.26)/0.84,0,1);
  if(open<0.06) return 0;
  return 0.015+2.25*open*open; // mL/s; illustration, not physical flow calibration.
}

export function evaluateSession({volumeMl, swirlSeconds=0, activeSeconds=0, warnings=[], mode='manual', quickStart=false}) {
  const error=Math.abs(volumeMl-equivalenceMl);
  // This checks stoichiometric volume, not the precise phenolphthalein endpoint.
  const accurate=error<=0.05;
  const acceptable=error<=0.2;
  const mixingRatio=activeSeconds>0 ? swirlSeconds/activeSeconds : 0;
  const tooFast=warnings.some(e=>e.type==='too_fast_near_end');
  const notMixed=warnings.some(e=>e.type==='insufficient_mixing');
  const errors=[];
  if(volumeMl<9.8) errors.push('等量点之前就停止了滴定。');
  else if(volumeMl>10.2) errors.push('滴定量超过理论等量点较多。');
  else if(!accurate) errors.push('停止体积略偏离理论等量点。');
  if(tooFast) errors.push('接近终点时仍以较高速度滴加。');
  if(notMixed || (activeSeconds>1 && mixingRatio<0.25)) errors.push('滴定过程中摇匀操作不足。');
  const score=(accurate?65:acceptable?45:20)+(mixingRatio>=0.25?20:0)+(tooFast?0:15);
  return {
    score, accurate, acceptable, errorMl:error, mixingRatio,
    title:accurate&&!tooFast&&mixingRatio>=0.25?'本次实验完成得很好':acceptable?'接近目标，可以进一步优化':'还有值得改进的操作',
    errors, volumeMl, mode, quickStart,
    takeaways:[
      '理论等量点是10.00 mL；它与酚酞显色终点并不严格相同。',
      '接近等量点时，应降低滴加速度并保持溶液充分混合。',
      '水合氢离子与氢氧根离子中和生成水；Na⁺与Cl⁻主要是旁观离子。'
    ],
  };
}

export function makeCurve(count=241) {
  return Array.from({length:count},(_,i)=>calculateTitration(i*CHEM.maxBaseMl/(count-1)));
}
