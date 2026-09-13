// test-filter.js - 测试峰值重建功能
// Node.js 可运行测试，验证摆锤极值点重建

const RDEG = 180 / Math.PI;

function smoothArr(values, strength) {
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
  for (const ext of extrema) {
    const idx = ext.idx;
    const thetaVal = theta[idx];
    const flatTol = 0.02;
    let leftShoulder = idx, rightShoulder = idx;
    for (let i = idx - 1; i >= Math.max(0, idx - 8); i--) {
      if (!Number.isFinite(theta[i])) break;
      if (Math.abs(theta[i] - thetaVal) > flatTol) {
        leftShoulder = i;
        break;
      }
    }
    for (let i = idx + 1; i <= Math.min(theta.length - 1, idx + 8); i++) {
      if (!Number.isFinite(theta[i])) break;
      if (Math.abs(theta[i] - thetaVal) > flatTol) {
        rightShoulder = i;
        break;
      }
    }
    if (leftShoulder === idx && rightShoulder === idx) continue;
    const fitIdx = [], fitT = [], fitTheta = [];
    for (let i = Math.max(0, leftShoulder - 3); i <= Math.min(theta.length - 1, rightShoulder + 3); i++) {
      if (Number.isFinite(theta[i]) && Number.isFinite(t[i])) {
        const distFromPeak = Math.abs(i - idx);
        const isFlatRegion = Math.abs(theta[i] - thetaVal) < flatTol;
        if (!isFlatRegion || distFromPeak <= 1) {
          fitIdx.push(i);
          fitT.push(t[i] - t[idx]);
          fitTheta.push(theta[i]);
        }
      }
    }
    if (fitIdx.length < 3) continue;
    let sumT = 0, sumT2 = 0, sumT3 = 0, sumT4 = 0;
    let sumTh = 0, sumTTh = 0, sumT2Th = 0;
    for (let j = 0; j < fitT.length; j++) {
      const tj = fitT[j], thj = fitTheta[j];
      sumT += tj; sumT2 += tj * tj; sumT3 += tj * tj * tj; sumT4 += tj * tj * tj * tj;
      sumTh += thj; sumTTh += tj * thj; sumT2Th += tj * tj * thj;
    }
    const n = fitT.length;
    const det = n * (sumT2 * sumT4 - sumT3 * sumT3) - sumT * (sumT * sumT4 - sumT2 * sumT3) + sumT2 * (sumT * sumT3 - sumT2 * sumT2);
    if (Math.abs(det) < 1e-12) continue;
    const a = (sumTh * (sumT2 * sumT4 - sumT3 * sumT3) - sumTTh * (sumT * sumT4 - sumT2 * sumT3) + sumT2Th * (sumT * sumT3 - sumT2 * sumT2)) / det;
    const b = (n * (sumTTh * sumT4 - sumT2Th * sumT3) - sumT * (sumTh * sumT4 - sumT2Th * sumT2) + sumT2 * (sumTh * sumT3 - sumTTh * sumT2)) / det;
    const c = (n * (sumT2 * sumT2Th - sumT3 * sumTTh) - sumT * (sumT * sumT2Th - sumT2 * sumTTh) + sumT2 * (sumT * sumTTh - sumT2 * sumTh)) / det;
    for (let i = Math.max(leftShoulder, idx - 1); i <= Math.min(rightShoulder, idx + 1); i++) {
      if (Math.abs(theta[i] - thetaVal) < flatTol) {
        const dt = t[i] - t[idx];
        reconstructed[i] = a + b * dt + c * dt * dt;
      }
    }
  }
  return reconstructed;
}

// 生成合成摆锤数据，带整数像素量化和转折点驻留
function generateSyntheticPendulum(opts = {}) {
  const fps = opts.fps || 30;
  const duration = opts.duration || 3;
  const thetaMax = opts.thetaMax || 10;
  const freq = opts.freq || 1;
  const pixelsPerDegree = opts.pixelsPerDegree || 10;
  const radius = opts.radius || 200;
  const pivotX = opts.pivotX || 320;
  const pivotY = opts.pivotY || 100;

  const n = Math.floor(fps * duration);
  const points = [];
  
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const thetaDeg = thetaMax * Math.sin(2 * Math.PI * freq * t);
    const thetaRad = thetaDeg / RDEG;
    
    const xExact = pivotX + radius * Math.sin(thetaRad);
    const yExact = pivotY + radius * Math.cos(thetaRad);
    
    const x = Math.round(xExact);
    const y = Math.round(yExact);
    
    points.push({ t, x, y, thetaDegIdeal: thetaDeg, thetaRadIdeal: thetaRad });
  }
  
  return { points, pivotX, pivotY, radius, thetaMax };
}

// 从点计算 theta（模拟 RotationEngine 的逻辑）
function computeTheta(points, pivot) {
  const n = points.length;
  const theta = new Array(n);
  const base = new Array(n);
  
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const dx = p.x - pivot.x;
    const dy = p.y - pivot.y;
    let a = Math.atan2(-dy, dx);
    a += Math.PI / 2; // 摆锤约定：0 = 垂直向下
    base[i] = a;
  }
  
  // 展开相位
  let acc = base[0], last = base[0];
  theta[0] = acc;
  for (let i = 1; i < n; i++) {
    let d = base[i] - last;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    acc += d;
    last = base[i];
    theta[i] = acc;
  }
  
  return theta;
}

// 运行测试
function runTest() {
  console.log('=== 峰值重建测试 ===\n');
  
  const synth = generateSyntheticPendulum({ 
    fps: 30, 
    duration: 3, 
    thetaMax: 10, 
    freq: 1,
    pixelsPerDegree: 10,
    radius: 200 
  });
  
  const { points, pivotX, pivotY, thetaMax } = synth;
  const pivot = { x: pivotX, y: pivotY };
  
  console.log(`生成了 ${points.length} 帧合成摆锤数据`);
  console.log(`理想峰值: ±${thetaMax}°\n`);
  
  // 计算量化后的 theta
  const theta = computeTheta(points, pivot);
  const t = points.map(p => p.t);
  
  // 应用平滑（Savitzky-Golay）
  const smooth = 2;
  const thetaSmooth = smoothArr(theta, smooth);
  
  // 计算 omega
  const omegaPrelim = deriv(t, thetaSmooth);
  
  // 检测极值
  const extrema = detectExtrema(thetaSmooth, omegaPrelim);
  console.log(`检测到 ${extrema.length} 个极值点:`);
  extrema.forEach(ext => {
    const thetaDeg = thetaSmooth[ext.idx] * RDEG;
    console.log(`  帧 ${ext.idx}, t=${t[ext.idx].toFixed(3)}s, θ=${thetaDeg.toFixed(3)}°, 类型=${ext.type}`);
  });
  console.log();
  
  // 峰值重建
  const thetaReconstructed = reconstructPeaks(t, thetaSmooth, extrema);
  
  // 比较结果
  console.log('=== 重建前后峰值对比 ===\n');
  
  let maxThetaBeforeAbs = 0, maxThetaAfterAbs = 0;
  let peakVarianceBefore = [], peakVarianceAfter = [];
  
  for (const ext of extrema) {
    const idx = ext.idx;
    const before = thetaSmooth[idx] * RDEG;
    const after = thetaReconstructed[idx] * RDEG;
    const ideal = points[idx].thetaDegIdeal;
    
    maxThetaBeforeAbs = Math.max(maxThetaBeforeAbs, Math.abs(before));
    maxThetaAfterAbs = Math.max(maxThetaAfterAbs, Math.abs(after));
    
    console.log(`极值点 ${idx}:`);
    console.log(`  理想值: ${ideal.toFixed(3)}°`);
    console.log(`  重建前: ${before.toFixed(3)}° (误差 ${Math.abs(before - ideal).toFixed(3)}°)`);
    console.log(`  重建后: ${after.toFixed(3)}° (误差 ${Math.abs(after - ideal).toFixed(3)}°)`);
    
    // 检查峰值区域的方差（3帧窗口）
    const windowBefore = [];
    const windowAfter = [];
    for (let i = Math.max(0, idx - 1); i <= Math.min(theta.length - 1, idx + 1); i++) {
      windowBefore.push(thetaSmooth[i] * RDEG);
      windowAfter.push(thetaReconstructed[i] * RDEG);
    }
    
    const meanBefore = windowBefore.reduce((a, b) => a + b, 0) / windowBefore.length;
    const meanAfter = windowAfter.reduce((a, b) => a + b, 0) / windowAfter.length;
    const varBefore = windowBefore.reduce((sum, v) => sum + (v - meanBefore) ** 2, 0) / windowBefore.length;
    const varAfter = windowAfter.reduce((sum, v) => sum + (v - meanAfter) ** 2, 0) / windowAfter.length;
    
    peakVarianceBefore.push(varBefore);
    peakVarianceAfter.push(varAfter);
    
    console.log(`  峰值方差: 重建前=${varBefore.toFixed(6)}°², 重建后=${varAfter.toFixed(6)}°²`);
    console.log();
  }
  
  console.log('=== 测试结果 ===\n');
  
  // 断言 1: 峰值在合理范围内（不应该显著降低）
  console.log(`✓ 断言 1: 重建后峰值保持在合理范围（≥ 95% 原值）`);
  console.log(`  理想峰值: ±${thetaMax}°`);
  console.log(`  重建前最大: ${maxThetaBeforeAbs.toFixed(3)}°`);
  console.log(`  重建后最大: ${maxThetaAfterAbs.toFixed(3)}°`);
  console.log(`  保持率: ${(maxThetaAfterAbs / maxThetaBeforeAbs * 100).toFixed(1)}%`);
  
  const assertion1 = maxThetaAfterAbs >= maxThetaBeforeAbs * 0.95;
  console.log(`  ${assertion1 ? '✓ 通过' : '✗ 失败'}\n`);
  
  // 断言 2: 峰值不是多帧常量（方差 > 0）
  console.log(`✓ 断言 2: 峰值区域不是平坦帽（方差 > 0）`);
  const allVariancePositive = peakVarianceAfter.every(v => v > 1e-6);
  console.log(`  重建前平均方差: ${(peakVarianceBefore.reduce((a, b) => a + b, 0) / peakVarianceBefore.length).toFixed(6)}°²`);
  console.log(`  重建后平均方差: ${(peakVarianceAfter.reduce((a, b) => a + b, 0) / peakVarianceAfter.length).toFixed(6)}°²`);
  console.log(`  ${allVariancePositive ? '✓ 通过' : '✗ 失败'}\n`);
  
  // 断言 3: 中间摆动样本基本不变
  console.log(`✓ 断言 3: 中间摆动样本基本不变`);
  let midSwingChanges = 0;
  let midSwingTotal = 0;
  for (let i = 10; i < theta.length - 10; i++) {
    const isNearExtremum = extrema.some(ext => Math.abs(ext.idx - i) <= 2);
    if (!isNearExtremum && Math.abs(omegaPrelim[i]) > 1) {
      const diff = Math.abs(thetaReconstructed[i] - thetaSmooth[i]) * RDEG;
      midSwingChanges += diff;
      midSwingTotal++;
    }
  }
  const avgChange = midSwingTotal > 0 ? midSwingChanges / midSwingTotal : 0;
  console.log(`  中间摆动帧平均变化: ${avgChange.toFixed(6)}° (应 < 0.01°)`);
  console.log(`  ${avgChange < 0.01 ? '✓ 通过' : '✗ 失败'}\n`);
  
  // 总结
  const allPassed = assertion1 && allVariancePositive && avgChange < 0.01;
  console.log('=== 测试总结 ===\n');
  console.log(allPassed ? '✓ 所有测试通过！' : '✗ 部分测试失败');
  
  return allPassed ? 0 : 1;
}

// 运行测试
const exitCode = runTest();
process.exit(exitCode);
