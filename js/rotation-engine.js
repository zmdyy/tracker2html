window.RotationEngine = (() => {
  const RDEG = 180 / Math.PI;

  // Use FilterEngine if available, otherwise fallback to local triangular smooth
  function smoothArr(values, strength) {
    if (window.FilterEngine && window.FilterEngine.smooth) {
      return window.FilterEngine.smooth(values, strength);
    }
    // Fallback: triangular smooth
    if (strength <= 0 || values.length < 3) return values.slice();
    const radius = Math.min(strength, 2);
    const out = [];
    const sgCoeffs = {
      1: [-3, 12, 17, 12, -3],
      2: [-21, 14, 39, 54, 59, 54, 39, 14, -21]
    };
    const coeffs = sgCoeffs[radius] || sgCoeffs[2];
    const halfWin = Math.floor(coeffs.length / 2);
    const norm = coeffs.reduce((a, b) => a + b, 0);
    for (let i = 0; i < values.length; i++) {
      if (i < halfWin || i >= values.length - halfWin) {
        out.push(values[i]);
      } else {
        let sum = 0;
        for (let j = 0; j < coeffs.length; j++) {
          sum += values[i - halfWin + j] * coeffs[j];
        }
        out.push(sum / norm);
      }
    }
    return out;
  }
  function deriv(t, q) {
    const v = new Array(q.length).fill(NaN);
    for (let i = 1; i < q.length - 1; i++) {
      const dt = t[i + 1] - t[i - 1];
      v[i] = dt ? (q[i + 1] - q[i - 1]) / dt : NaN;
    }
    if (q.length > 1) {
      v[0] = (q[1] - q[0]) / Math.max(1e-9, t[1] - t[0]);
      v[q.length - 1] = (q[q.length - 1] - q[q.length - 2]) / Math.max(1e-9, t[q.length - 1] - t[q.length - 2]);
    }
    return v;
  }

  function detectExtrema(theta, omega) {
    const extrema = [];
    for (let i = 1; i < theta.length - 1; i++) {
      if (!Number.isFinite(theta[i]) || !Number.isFinite(omega[i])) continue;
      const isMax = theta[i] > theta[i - 1] && theta[i] > theta[i + 1];
      const isMin = theta[i] < theta[i - 1] && theta[i] < theta[i + 1];
      const omegaCross = i > 0 && i < omega.length - 1 && Number.isFinite(omega[i - 1]) && Number.isFinite(omega[i + 1]) && Math.sign(omega[i - 1]) !== Math.sign(omega[i + 1]);
      if (isMax || isMin || omegaCross) {
        extrema.push({ idx: i, type: isMax ? 'max' : isMin ? 'min' : 'turn' });
      }
    }
    return extrema;
  }

  function reconstructPeaks(t, theta, extrema) {
    const reconstructed = theta.slice();
    return reconstructed;
  }

  function compute(points, pivot, cfg = {}) {
    const n = points.length;
    const rows = new Array(n);
    if (!n) return { rows, period: null, avgOmega: null, direction: 0 };
    if (!pivot || !Number.isFinite(pivot.x) || !Number.isFinite(pivot.y)) {
      for (let i = 0; i < n; i++) {
        const p = points[i];
        rows[i] = { frame: p && p.frame, t: p && Number.isFinite(p.t) ? p.t : 0, r: NaN, thetaRad: NaN, thetaDeg: NaN, thetaBaseRad: NaN, omega: NaN, vr: NaN, vt: NaN, thetaConfidence: 0 };
      }
      return { rows, period: null, avgOmega: null, direction: 0 };
    }
    const mpp = Number(cfg.metersPerPx) || 1;
    const scene = cfg.scene === 'pendulum' ? 'pendulum' : 'circle';
    const smooth = Number(cfg.smooth) || 0;
    const px0 = pivot.x, py0 = pivot.y;

    const rPx = new Array(n).fill(NaN);
    const base = new Array(n).fill(NaN);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const dx = p.x - px0, dy = p.y - py0;
      rPx[i] = Math.hypot(dx, dy);
      if (rPx[i] < 1e-6) continue;
      let a = Math.atan2(-dy, dx);
      if (scene === 'pendulum') a += Math.PI / 2;
      base[i] = a;
    }

    const theta = new Array(n).fill(NaN);
    const valid = [];
    {
      let acc = NaN, last = NaN;
      for (let i = 0; i < n; i++) {
        if (!Number.isFinite(base[i])) { theta[i] = NaN; continue; }
        if (!Number.isFinite(last)) acc = base[i];
        else {
          let d = base[i] - last;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          acc += d;
        }
        last = base[i];
        theta[i] = acc;
        valid.push(i);
      }
    }

    const tFull = points.map(p => Number.isFinite(p.t) ? p.t : 0);
    const tv = valid.map(i => tFull[i]);
    const thetaV = valid.map(i => theta[i]);
    const rArr = rPx.map(v => v * mpp);
    const rV = valid.map(i => rArr[i]);

    // Use SG filter to get smoothed angles/radii AND derivatives from same polynomial fit
    let thSm, rSm, omegaV, vrV;
    
    if (smooth > 0 && window.FilterEngine && window.FilterEngine.sgFilterWithDerivatives) {
      // SG method: extract position and velocity from same fit
      const thResult = window.FilterEngine.sgFilterWithDerivatives(tv, thetaV, smooth);
      const rResult = window.FilterEngine.sgFilterWithDerivatives(tv, rV, smooth);
      thSm = thResult.x;
      omegaV = thResult.v;
      rSm = rResult.x;
      vrV = rResult.v;
    } else {
      // Fallback: smooth then finite differences (current production baseline)
      thSm = smoothArr(thetaV, smooth);
      rSm = smoothArr(rV, smooth);
      omegaV = deriv(tv, thSm);
      vrV = deriv(tv, rSm);
    }

    // Spread filtered and derived values back to full arrays
    const thetaFiltered = new Array(n).fill(NaN);
    const rFiltered = new Array(n).fill(NaN);
    const omegaFull = new Array(n).fill(NaN);
    const vrFull = new Array(n).fill(NaN);
    for (let j = 0; j < valid.length; j++) {
      const idx = valid[j];
      thetaFiltered[idx] = thSm[j];
      rFiltered[idx] = rSm[j];
      omegaFull[idx] = omegaV[j];
      vrFull[idx] = vrV[j];
    }

    const period = detectPeriod(valid, tv, thetaV, omegaV, scene);
    const omMean = (() => {
      let s = 0, c = 0;
      for (let j = 0; j < valid.length; j++) {
        if (Number.isFinite(omegaV[j])) { s += omegaV[j]; c++; }
      }
      return c ? s / c : null;
    })();
    const direction = period && period.direction !== 0 ? period.direction : (omMean != null && Math.abs(omMean) > 1e-9 ? Math.sign(omMean) : 0);

    let avgOmega = null;
    if (valid.length >= 2) {
      const dt = tFull[valid[valid.length - 1]] - tFull[valid[0]];
      if (dt > 1e-9) avgOmega = (theta[valid[valid.length - 1]] - theta[valid[0]]) / dt;
    }

    for (let i = 0; i < n; i++) {
      const p = points[i];
      const good = Number.isFinite(theta[i]) && rPx[i] >= 8;
      // Published values use FILTERED positions
      const rPub = Number.isFinite(rFiltered[i]) ? rFiltered[i] : NaN;
      const thetaPub = thetaFiltered[i];
      rows[i] = {
        frame: p && p.frame,
        t: tFull[i],
        // Published (filtered) values
        r: rPub,
        thetaRad: thetaPub,
        thetaDeg: Number.isFinite(thetaPub) ? thetaPub * RDEG : NaN,
        omega: omegaFull[i],
        vr: vrFull[i],
        vt: Number.isFinite(rPub) && Number.isFinite(omegaFull[i]) ? rPub * omegaFull[i] : NaN,
        // Raw (unfiltered) values for audit
        r_raw: Number.isFinite(rArr[i]) ? rArr[i] : NaN,
        thetaRad_raw: theta[i],
        thetaDeg_raw: Number.isFinite(theta[i]) ? theta[i] * RDEG : NaN,
        thetaBaseRad: base[i],
        thetaConfidence: good ? 1 : 0
      };
    }
    return { rows, period, avgOmega, direction };
  }

  function detectPeriod(valid, tv, thetaV, omegaV, scene) {
    if (valid.length < 3) return null;
    if (scene === 'pendulum') {
      const crosses = [];
      for (let j = 1; j < valid.length; j++) {
        const a = thetaV[j - 1], b = thetaV[j];
        if (a === 0 || Math.sign(a) !== Math.sign(b)) {
          const span = tv[j] - tv[j - 1];
          const k = span > 0 ? -a / (b - a) : 0;
          crosses.push({ t: tv[j - 1] + span * Math.min(1, Math.max(0, k)), dir: Math.sign(b - a) });
        }
      }
      const periods = [];
      for (let i = 0; i + 2 < crosses.length; i++) {
        const c0 = crosses[i], c1 = crosses[i + 2];
        if (c0.dir === c1.dir) periods.push(c1.t - c0.t);
      }
      if (!periods.length) return null;
      const value = periods.reduce((a, b) => a + b, 0) / periods.length;
      return { value, method: 'zero-crossing', count: periods.length, direction: 0 };
    }
    const revs = [];
    let prevK = Math.floor(thetaV[0] / (2 * Math.PI));
    for (let j = 1; j < valid.length; j++) {
      const k = Math.floor(thetaV[j] / (2 * Math.PI));
      if (k === prevK) continue;
      const target = (k > prevK ? k : prevK) * 2 * Math.PI;
      const span = tv[j] - tv[j - 1];
      const frac = span > 0 ? (target - thetaV[j - 1]) / (thetaV[j] - thetaV[j - 1]) : 0;
      const tCross = tv[j - 1] + span * Math.min(1, Math.max(0, frac));
      const dir = Math.sign(k - prevK);
      if (tCross > (revs.length ? revs[revs.length - 1].t : -Infinity) + 1e-9) revs.push({ t: tCross, dir });
      prevK = k;
    }
    if (revs.length < 2) return null;
    const dir = revs[0].dir;
    const periods = [];
    for (let i = 0; i + 1 < revs.length; i++) {
      if (revs[i].dir === dir && revs[i + 1].dir === dir) periods.push(Math.abs(revs[i + 1].t - revs[i].t));
    }
    if (!periods.length) return null;
    const value = periods.reduce((a, b) => a + b, 0) / periods.length;
    return { value, method: 'revolution', count: periods.length, direction: dir };
  }

  return { compute };
})();