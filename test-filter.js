<<<<<<< HEAD
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
    
    const phase = (2 * Math.PI * freq * t) % (2 * Math.PI);
    const nearPeak = Math.abs(Math.sin(phase)) > 0.95;
    const continuousPeak = nearPeak ? thetaMax * Math.sign(Math.sin(phase)) : thetaDeg;
    
    points.push({ t, x, y, thetaDegIdeal: continuousPeak, thetaRadIdeal: continuousPeak / RDEG });
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
  
  let sumErrorBefore = 0, sumErrorAfter = 0;
  let dwellCountBefore = [], dwellCountAfter = [];
  
  for (const ext of extrema) {
    const idx = ext.idx;
    const before = thetaSmooth[idx] * RDEG;
    const after = thetaReconstructed[idx] * RDEG;
    const ideal = points[idx].thetaDegIdeal;
    
    const errBefore = Math.abs(before - ideal);
    const errAfter = Math.abs(after - ideal);
    sumErrorBefore += errBefore;
    sumErrorAfter += errAfter;
    
    console.log(`极值点 ${idx}:`);
    console.log(`  理想值: ${ideal.toFixed(3)}°`);
    console.log(`  重建前: ${before.toFixed(3)}° (误差 ${errBefore.toFixed(3)}°)`);
    console.log(`  重建后: ${after.toFixed(3)}° (误差 ${errAfter.toFixed(3)}°)`);
    
    // 检查驻留宽度（连续样本在 ~0.3° 内）
    const dwellTol = 0.3;
    let dwellBefore = 1, dwellAfter = 1;
    for (let i = idx - 1; i >= Math.max(0, idx - 5); i--) {
      if (Math.abs(thetaSmooth[i] * RDEG - before) < dwellTol) dwellBefore++;
      else break;
    }
    for (let i = idx + 1; i <= Math.min(theta.length - 1, idx + 5); i++) {
      if (Math.abs(thetaSmooth[i] * RDEG - before) < dwellTol) dwellBefore++;
      else break;
    }
    for (let i = idx - 1; i >= Math.max(0, idx - 5); i--) {
      if (Math.abs(thetaReconstructed[i] * RDEG - after) < dwellTol) dwellAfter++;
      else break;
    }
    for (let i = idx + 1; i <= Math.min(theta.length - 1, idx + 5); i++) {
      if (Math.abs(thetaReconstructed[i] * RDEG - after) < dwellTol) dwellAfter++;
      else break;
    }
    
    dwellCountBefore.push(dwellBefore);
    dwellCountAfter.push(dwellAfter);
    
    console.log(`  驻留宽度: 重建前=${dwellBefore}帧, 重建后=${dwellAfter}帧 (应≤重建前)`);
    console.log();
  }
  
  console.log('=== 测试结果 ===\n');
  
  // 断言 1: 极值点处平均误差减小
  console.log(`✓ 断言 1: 极值点平均 |θ_recon − θ_ideal| < |θ_pre − θ_ideal|`);
  const avgErrorBefore = sumErrorBefore / extrema.length;
  const avgErrorAfter = sumErrorAfter / extrema.length;
  console.log(`  理想峰值: ±${thetaMax}°`);
  console.log(`  重建前平均误差: ${avgErrorBefore.toFixed(4)}°`);
  console.log(`  重建后平均误差: ${avgErrorAfter.toFixed(4)}°`);
  console.log(`  改进: ${((1 - avgErrorAfter / avgErrorBefore) * 100).toFixed(1)}%`);
  
  const assertion1 = avgErrorAfter < avgErrorBefore;
  console.log(`  ${assertion1 ? '✓ 通过' : '✗ 失败'}\n`);
  
  // 断言 2: 驻留宽度减小或不增加
  console.log(`✓ 断言 2: 驻留宽度（连续帧在 ~0.3° 内）减小或不增加`);
  const avgDwellBefore = dwellCountBefore.reduce((a, b) => a + b, 0) / dwellCountBefore.length;
  const avgDwellAfter = dwellCountAfter.reduce((a, b) => a + b, 0) / dwellCountAfter.length;
  const allDwellReduced = dwellCountAfter.every((after, i) => after <= dwellCountBefore[i]);
  console.log(`  重建前平均驻留: ${avgDwellBefore.toFixed(1)}帧`);
  console.log(`  重建后平均驻留: ${avgDwellAfter.toFixed(1)}帧`);
  console.log(`  所有极值点驻留≤重建前: ${allDwellReduced ? '是' : '否'}`);
  
  const assertion2 = avgDwellAfter <= avgDwellBefore;
  console.log(`  ${assertion2 ? '✓ 通过' : '✗ 失败'}\n`);
  
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
  const allPassed = assertion1 && assertion2 && avgChange < 0.01;
  console.log('=== 测试总结 ===\n');
  console.log(allPassed ? '✓ 所有测试通过！' : '✗ 部分测试失败');
  console.log(`极值误差改进: ${((1 - avgErrorAfter / avgErrorBefore) * 100).toFixed(1)}%`);
  console.log(`驻留宽度: ${avgDwellBefore.toFixed(1)}帧 → ${avgDwellAfter.toFixed(1)}帧`);
  console.log(`中间摆动变化: ${avgChange.toFixed(6)}°`);
  
  return allPassed ? 0 : 1;
}

// 运行测试
const exitCode = runTest();
process.exit(exitCode);
=======
#!/usr/bin/env node
// Test script to verify position filtering fixes theta quantization

// Mock window object for Node.js
global.window = {};

// Load engines
require('./filter-engine.js');
require('./rotation-engine.js');
require('./physics-engine.js');

const RDEG = 180 / Math.PI;
const RREC = Math.PI / 180;

console.log('=== Position Filter Test Suite ===\n');

// Test 1: Synthetic quantized pendulum
console.log('Test 1: Quantized pendulum θ(t) smoothing');
console.log('------------------------------------------');

// Create synthetic pendulum: small amplitude (±8°), integer pixel positions
// Physical setup: L=1m, θ_max=8°, period ≈ 2s
const fps = 30;
const duration = 3.0; // 3 seconds
const nFrames = Math.floor(fps * duration);
const L = 1.0; // 1 meter pendulum length
const thetaMaxRad = 8 * RREC; // ±8 degrees amplitude
const period = 2.0; // approx 2 second period
const omega0 = 2 * Math.PI / period;

// Generate smooth ideal motion
const idealPoints = [];
for (let i = 0; i < nFrames; i++) {
  const t = i / fps;
  const theta = thetaMaxRad * Math.sin(omega0 * t); // smooth sine wave
  const r = L;
  // Pendulum: theta=0 is straight down, positive = right
  // In screen coords: pivot at (400, 100), y increases downward
  const pivotX = 400, pivotY = 100;
  const x = pivotX + L * Math.sin(theta) * 100; // scale to pixels (100px/m)
  const y = pivotY + L * Math.cos(theta) * 100;
  idealPoints.push({ x, y, t, frame: i, thetaIdeal: theta });
}

// Quantize to integer pixels (simulates pixel quantization in real tracking)
const quantizedPoints = idealPoints.map(p => ({
  x: Math.round(p.x),
  y: Math.round(p.y),
  t: p.t,
  frame: p.frame,
  thetaIdeal: p.thetaIdeal
}));

// Test with smooth=0 (no filter) vs smooth=2 (filter on)
const pivot = { x: 400, y: 100 };
const metersPerPx = 0.01; // 100 px/m

console.log(`Generated ${nFrames} frames, pendulum L=${L}m, θ_max=${(thetaMaxRad*RDEG).toFixed(1)}°`);

// Run with smooth=0
const resultRaw = window.RotationEngine.compute(quantizedPoints, pivot, {
  metersPerPx,
  smooth: 0,
  scene: 'pendulum'
});

// Run with smooth=2
const resultFiltered = window.RotationEngine.compute(quantizedPoints, pivot, {
  metersPerPx,
  smooth: 2,
  scene: 'pendulum'
});

// Measure smoothness: compute variance of consecutive differences (quantization stairs show up here)
function measureSmoothness(rows) {
  const valid = rows.filter(r => Number.isFinite(r.thetaDeg));
  if (valid.length < 3) return { variance: NaN, maxJump: NaN };
  
  const diffs = [];
  for (let i = 1; i < valid.length; i++) {
    diffs.push(Math.abs(valid[i].thetaDeg - valid[i-1].thetaDeg));
  }
  
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((a, d) => a + Math.pow(d - mean, 2), 0) / diffs.length;
  const maxJump = Math.max(...diffs);
  
  return { variance, maxJump, mean };
}

const smoothRaw = measureSmoothness(resultRaw.rows);
const smoothFiltered = measureSmoothness(resultFiltered.rows);

console.log(`\nSmooth=0 (raw): variance=${smoothRaw.variance.toFixed(6)}, max jump=${smoothRaw.maxJump.toFixed(4)}°`);
console.log(`Smooth=2 (filt): variance=${smoothFiltered.variance.toFixed(6)}, max jump=${smoothFiltered.maxJump.toFixed(4)}°`);

const improvement = (smoothRaw.variance - smoothFiltered.variance) / smoothRaw.variance * 100;
console.log(`Smoothness improvement: ${improvement.toFixed(1)}% reduction in variance`);

if (improvement < 30) {
  console.log('❌ FAIL: Filter should reduce variance by at least 30%');
  process.exit(1);
}
console.log('✓ PASS: θ(t) is much smoother with filtering');

// Test 2: Verify raw values are preserved
console.log('\nTest 2: Raw values preservation');
console.log('-------------------------------');

const sampleIdx = Math.floor(nFrames / 2);
const rawTheta = resultRaw.rows[sampleIdx].thetaDeg;
const filtTheta = resultFiltered.rows[sampleIdx].thetaDeg;
const filtRaw = resultFiltered.rows[sampleIdx].thetaDeg_raw;

console.log(`Sample frame ${sampleIdx}:`);
console.log(`  Raw engine θ=${rawTheta.toFixed(4)}°`);
console.log(`  Filtered engine θ=${filtTheta.toFixed(4)}° (published)`);
console.log(`  Filtered engine θ_raw=${filtRaw.toFixed(4)}° (audit)`);

if (Math.abs(rawTheta - filtRaw) > 0.001) {
  console.log('❌ FAIL: Raw value not preserved in filtered engine');
  process.exit(1);
}
console.log('✓ PASS: Raw values preserved for audit');

// Test 3: Energy consistency (Ek + Ep should use consistent position series)
console.log('\nTest 3: Energy consistency in linear motion');
console.log('--------------------------------------------');

// Create simple horizontal motion with quantization
const linearPoints = [];
for (let i = 0; i < 60; i++) {
  const t = i / 30.0;
  const xSmooth = 100 + 50 * t; // smooth linear motion
  const y = 200; // constant height
  linearPoints.push({
    x: Math.round(xSmooth), // quantized
    y: Math.round(y),
    t,
    frame: i
  });
}

const linearRaw = window.PhysicsEngine.analyze(linearPoints, {
  metersPerPx: 0.01,
  smooth: 0,
  mass: 0.5,
  gravity: 9.8,
  invertY: true,
  zeroAtStart: true
});

const linearFiltered = window.PhysicsEngine.analyze(linearPoints, {
  metersPerPx: 0.01,
  smooth: 2,
  mass: 0.5,
  gravity: 9.8,
  invertY: true,
  zeroAtStart: true
});

// Check that Em = Ek + Ep consistently
function checkEnergyConsistency(data) {
  const errors = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (Number.isFinite(row.Ek) && Number.isFinite(row.Ep) && Number.isFinite(row.Em)) {
      const computed = row.Ek + row.Ep;
      const err = Math.abs(computed - row.Em);
      errors.push(err);
    }
  }
  const maxErr = errors.length > 0 ? Math.max(...errors) : 0;
  const avgErr = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
  return { maxErr, avgErr };
}

const consRaw = checkEnergyConsistency(linearRaw);
const consFilt = checkEnergyConsistency(linearFiltered);

console.log(`Energy consistency (Em = Ek + Ep):`);
console.log(`  Raw: max error=${consRaw.maxErr.toExponential(2)} J`);
console.log(`  Filtered: max error=${consFilt.maxErr.toExponential(2)} J`);

if (consRaw.maxErr > 1e-10 || consFilt.maxErr > 1e-10) {
  console.log('❌ FAIL: Energy not internally consistent');
  process.exit(1);
}
console.log('✓ PASS: Em = Ek + Ep consistently');

// Test 4: Velocity consistency in rotation (v² ≈ vt² + vr²)
console.log('\nTest 4: Rotation velocity decomposition');
console.log('----------------------------------------');

// Use pendulum data with both rotation and linear analysis
const combinedRaw = window.PhysicsEngine.analyze(quantizedPoints, {
  metersPerPx,
  smooth: 0
});

const combinedFilt = window.PhysicsEngine.analyze(quantizedPoints, {
  metersPerPx,
  smooth: 2
});

const rotRaw = window.RotationEngine.compute(quantizedPoints, pivot, {
  metersPerPx,
  smooth: 0,
  scene: 'pendulum'
});

const rotFilt = window.RotationEngine.compute(quantizedPoints, pivot, {
  metersPerPx,
  smooth: 2,
  scene: 'pendulum'
});

// Merge rotation into linear data
const mergedRaw = combinedRaw.map((d, i) => ({ ...d, ...rotRaw.rows[i] }));
const mergedFilt = combinedFilt.map((d, i) => ({ ...d, ...rotFilt.rows[i] }));

// Check v² ≈ vt² + vr² for valid rotation points
function checkVelocityDecomp(data) {
  const errors = [];
  for (const row of data) {
    if (row.thetaConfidence === 1 && Number.isFinite(row.v) && 
        Number.isFinite(row.vt) && Number.isFinite(row.vr) && row.v > 0.01) {
      const v2 = row.v * row.v;
      const polar2 = row.vt * row.vt + row.vr * row.vr;
      const relErr = Math.abs(v2 - polar2) / v2;
      errors.push(relErr);
    }
  }
  const maxErr = errors.length > 0 ? Math.max(...errors) : 0;
  const avgErr = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
  return { maxErr, avgErr, count: errors.length };
}

const velRaw = checkVelocityDecomp(mergedRaw);
const velFilt = checkVelocityDecomp(mergedFilt);

console.log(`Velocity decomposition v² ≈ vt² + vr²:`);
console.log(`  Raw: max rel error=${(velRaw.maxErr*100).toFixed(2)}%, avg=${(velRaw.avgErr*100).toFixed(2)}% (${velRaw.count} pts)`);
console.log(`  Filtered: max rel error=${(velFilt.maxErr*100).toFixed(2)}%, avg=${(velFilt.avgErr*100).toFixed(2)}% (${velFilt.count} pts)`);

// With quantization, raw can have large errors; filtered should be much better
if (velFilt.avgErr > 0.5) {
  console.log('❌ FAIL: Velocity decomposition has large errors (>50% avg)');
  process.exit(1);
}
console.log('✓ PASS: Velocity decomposition consistent on filtered series');

// Summary
console.log('\n=== Test Summary ===');
console.log('✓ All tests passed!');
console.log('- θ(t) smoothness improved by filtering positions first');
console.log('- Raw values preserved for audit (_raw fields)');
console.log('- Energy internally consistent (Ek + Ep = Em)');
console.log('- Velocity decomposition consistent (v² ≈ vt² + vr²)');
console.log('\nThe filter chain is working correctly:');
console.log('  1. Filter positions (θ, r, x, y) using Savitzky-Golay');
console.log('  2. Derive velocities/accelerations from filtered positions');
console.log('  3. Compute energies from filtered positions');
console.log('  4. All published quantities come from one consistent series');

process.exit(0);
>>>>>>> origin/main
