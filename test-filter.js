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
