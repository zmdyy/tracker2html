window.PhysicsEngine = (() => {
  function applyScale(px, metersPerPx) { return px * metersPerPx; }
  function smooth(values, strength) {
    if (strength <= 0 || values.length < 3) return values.slice();
    const radius = strength;
    const out = [];
    for (let i = 0; i < values.length; i++) {
      let sum = 0, wsum = 0;
      for (let j = Math.max(0, i-radius); j <= Math.min(values.length-1, i+radius); j++) {
        const w = radius + 1 - Math.abs(i-j);
        sum += values[j] * w; wsum += w;
      }
      out.push(sum / wsum);
    }
    return out;
  }
  function deriveFirst(t, q) {
    const v = new Array(q.length).fill(0);
    for (let i=1;i<q.length-1;i++) {
      const dt = t[i+1]-t[i-1];
      v[i] = dt ? (q[i+1]-q[i-1])/dt : 0;
    }
    if (q.length > 1) {
      v[0] = (q[1]-q[0]) / Math.max(1e-9,t[1]-t[0]);
      v[q.length-1] = (q[q.length-1]-q[q.length-2]) / Math.max(1e-9,t[q.length-1]-t[q.length-2]);
    }
    return v;
  }
  function deriveSecond(t, q) { return deriveFirst(t, deriveFirst(t,q)); }
  function analyze(points, cfg={}) {
    if (!points.length) return [];
    const metersPerPx = cfg.metersPerPx || 1;
    const invertY = cfg.invertY !== false;
    const angle = (cfg.inclineAngle || 0) * Math.PI / 180;
    const zeroAtStart = cfg.zeroAtStart !== false;
    const mass = Math.max(0, Number(cfg.mass) || 0);
    const g = Math.max(0, Number(cfg.gravity) || 9.8);
    const h0 = Number(cfg.zeroHeight) || 0;

    const t = points.map(p=>p.t);
    const xPx = points.map(p=>p.x);
    const yPx = points.map(p=>p.y);
    const x0 = xPx[0], y0 = yPx[0];
    let x = xPx.map(v => (v - (zeroAtStart ? x0 : 0)) * metersPerPx);
    let y = yPx.map(v => ((invertY ? -(v-y0) : (v-y0)) * metersPerPx) + (zeroAtStart ? 0 : 0));

    // Along-incline coordinate s; positive toward the chosen incline angle.
    const s = x.map((vx,i) => vx*Math.cos(angle) + y[i]*Math.sin(angle));
    const vx = deriveFirst(t, smooth(x,cfg.smooth||0));
    const vy = deriveFirst(t, smooth(y,cfg.smooth||0));
    const speed = vx.map((v,i)=>Math.hypot(v,vy[i]));
    const ax = deriveFirst(t, smooth(vx,cfg.smooth||0));
    const ay = deriveFirst(t, smooth(vy,cfg.smooth||0));
    const accel = ax.map((v,i)=>Math.hypot(v,ay[i]));
    const vs = deriveFirst(t, smooth(s,cfg.smooth||0));
    const as = deriveFirst(t, smooth(vs,cfg.smooth||0));

    return points.map((p,i)=>{
      const Ek = 0.5 * mass * speed[i] * speed[i];
      const Ep = mass * g * (y[i] + h0);
      return {
        ...p, t:t[i], x:x[i], y:y[i], s:s[i], vx:vx[i], vy:vy[i], v:speed[i], ax:ax[i], ay:ay[i], a:accel[i], vs:vs[i], as:as[i], Ek, Ep, Em:Ek+Ep
      };
    });
  }
  function motionSummary(data) {
    if (!data.length) return { label:'—', detail:'暂无数据' };
    const aVals = data.map(d=>Math.abs(d.a)).filter(Number.isFinite);
    const vVals = data.map(d=>d.v).filter(Number.isFinite);
    const aMean = aVals.length ? aVals.reduce((a,b)=>a+b,0)/aVals.length : 0;
    const vMax = vVals.length ? Math.max(...vVals) : 0;
    const xSpan = Math.abs(data[data.length-1].s - data[0].s);
    if (aMean < 0.08 && vMax > 0.1) return { label:'近似匀速运动', detail:`平均加速度约 ${aMean.toFixed(2)} m/s²` };
    if (aMean >= 0.08 && xSpan > 0.02) return { label:'存在明显加速度', detail:`最大速度约 ${vMax.toFixed(2)} m/s` };
    return { label:'运动趋势较弱或数据不足', detail:`位移范围约 ${xSpan.toFixed(3)} m` };
  }
  return { analyze, motionSummary, smooth };
})();
