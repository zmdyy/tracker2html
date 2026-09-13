/**
 * test-derivatives.js
 * 
 * Honest test: Savitzky-Golay derivatives vs production baseline
 * Production = smooth positions, then central finite differences
 * Run with: node test-derivatives.js
 */

// Mock window object for Node.js environment
global.window = {};

// Load the filter engine
require('./js/filter-engine.js');
const FilterEngine = global.window.FilterEngine;

/**
 * Generate analytical pendulum data with pixel quantization noise
 */
function generatePendulumData(fps, duration, L, theta0, pixelsPerMeter) {
  const numSamples = Math.floor(fps * duration);
  const dt = 1 / fps;
  const g = 9.8;
  const omega = Math.sqrt(g / L);
  
  const data = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    
    // Analytical values (in meters)
    const x_true = L * theta0 * Math.cos(omega * t);
    const v_true = -L * theta0 * omega * Math.sin(omega * t);
    const a_true = -L * theta0 * omega * omega * Math.cos(omega * t);
    
    // Convert to pixels and quantize
    const x_px = Math.round(x_true * pixelsPerMeter);
    const x_quantized = x_px / pixelsPerMeter;
    
    data.push({ t, x_true, v_true, a_true, x_quantized });
  }
  
  return data;
}

/**
 * Production baseline: smooth positions, then central finite differences
 */
function productionBaseline(t, x, radius) {
  const n = x.length;
  
  // Smooth positions using FilterEngine (SG smooth)
  const x_smooth = FilterEngine.smooth(x, radius);
  
  // Central finite differences for velocity
  const v = new Array(n);
  for (let i = 1; i < n - 1; i++) {
    v[i] = (x_smooth[i + 1] - x_smooth[i - 1]) / (t[i + 1] - t[i - 1]);
  }
  v[0] = (x_smooth[1] - x_smooth[0]) / (t[1] - t[0]);
  v[n - 1] = (x_smooth[n - 1] - x_smooth[n - 2]) / (t[n - 1] - t[n - 2]);
  
  // Central finite differences for acceleration (from velocity)
  const a = new Array(n);
  for (let i = 1; i < n - 1; i++) {
    a[i] = (v[i + 1] - v[i - 1]) / (t[i + 1] - t[i - 1]);
  }
  a[0] = (v[1] - v[0]) / (t[1] - t[0]);
  a[n - 1] = (v[n - 1] - v[n - 2]) / (t[n - 1] - t[n - 2]);
  
  return { x: x_smooth, v, a };
}

/**
 * Compute RMS error
 */
function rmsError(predicted, actual, dropEdges = 0) {
  let sumSqErr = 0;
  let count = 0;
  const start = dropEdges;
  const end = predicted.length - dropEdges;
  
  for (let i = start; i < end; i++) {
    if (Number.isFinite(predicted[i]) && Number.isFinite(actual[i])) {
      const err = predicted[i] - actual[i];
      sumSqErr += err * err;
      count++;
    }
  }
  return count > 0 ? Math.sqrt(sumSqErr / count) : NaN;
}

/**
 * Standard deviation
 */
function std(values, dropEdges = 0) {
  const start = dropEdges;
  const end = values.length - dropEdges;
  const filtered = values.slice(start, end).filter(Number.isFinite);
  if (filtered.length === 0) return NaN;
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const variance = filtered.reduce((sum, v) => sum + (v - mean) ** 2, 0) / filtered.length;
  return Math.sqrt(variance);
}

/**
 * Peak-to-peak variation
 */
function peakToPeak(values, dropEdges = 0) {
  const start = dropEdges;
  const end = values.length - dropEdges;
  const filtered = values.slice(start, end).filter(Number.isFinite);
  if (filtered.length === 0) return NaN;
  return Math.max(...filtered) - Math.min(...filtered);
}

/**
 * Main test
 */
function runTests() {
  console.log('='.repeat(70));
  console.log('Savitzky-Golay Derivative Accuracy Tests');
  console.log('Honest comparison vs PRODUCTION BASELINE');
  console.log('='.repeat(70));
  console.log();
  
  // Test parameters
  const fps = 30;
  const duration = 2.0;
  const L = 0.5;
  const theta0 = 0.3;
  const pixelsPerMeter = 300;
  const smoothRadius = 2;
  
  console.log('Test Configuration:');
  console.log(`  Sampling rate: ${fps} fps`);
  console.log(`  Duration: ${duration} s`);
  console.log(`  Pendulum length: ${L} m`);
  console.log(`  Initial angle: ${(theta0 * 180 / Math.PI).toFixed(1)}°`);
  console.log(`  Pixel resolution: ${pixelsPerMeter} px/m`);
  console.log(`  SG window radius: ${smoothRadius} (window length = ${2 * smoothRadius + 1})`);
  console.log();
  
  // Generate test data
  const data = generatePendulumData(fps, duration, L, theta0, pixelsPerMeter);
  const t = data.map(d => d.t);
  const x_quantized = data.map(d => d.x_quantized);
  const v_true = data.map(d => d.v_true);
  const a_true = data.map(d => d.a_true);
  
  console.log(`Generated ${data.length} samples`);
  console.log();
  
  // Test 1: Production baseline (smooth + FD)
  console.log('Test 1: Production Baseline (SG smooth + finite differences)');
  console.log('-'.repeat(70));
  const prod = productionBaseline(t, x_quantized, smoothRadius);
  const prod_v_error = rmsError(prod.v, v_true, 2);
  const prod_a_error = rmsError(prod.a, a_true, 2);
  console.log(`  Velocity RMS error (drop 2 edge):     ${prod_v_error.toFixed(6)} m/s`);
  console.log(`  Acceleration RMS error (drop 2 edge): ${prod_a_error.toFixed(6)} m/s²`);
  console.log();
  
  // Test 2: Savitzky-Golay polynomial derivatives
  console.log('Test 2: Savitzky-Golay Polynomial Derivatives');
  console.log('(Same local fit: x=smooth, v=1st coeff/dt, a=2nd coeff/dt²)');
  console.log('-'.repeat(70));
  const sg = FilterEngine.sgFilterWithDerivatives(t, x_quantized, smoothRadius);
  const sg_v_error = rmsError(sg.v, v_true, 2);
  const sg_a_error = rmsError(sg.a, a_true, 2);
  console.log(`  Velocity RMS error (drop 2 edge):     ${sg_v_error.toFixed(6)} m/s`);
  console.log(`  Acceleration RMS error (drop 2 edge): ${sg_a_error.toFixed(6)} m/s²`);
  console.log();
  
  // Test 3: Error comparison
  console.log('Test 3: Accuracy Improvement vs Production');
  console.log('-'.repeat(70));
  const v_improvement = ((prod_v_error - sg_v_error) / prod_v_error * 100).toFixed(1);
  const a_improvement = ((prod_a_error - sg_a_error) / prod_a_error * 100).toFixed(1);
  console.log(`  Velocity error reduction:     ${v_improvement}%`);
  console.log(`  Acceleration error reduction: ${a_improvement}%`);
  
  if (sg_v_error < prod_v_error) {
    const v_ratio = (prod_v_error / sg_v_error).toFixed(2);
    console.log(`  SG velocity is ${v_ratio}x more accurate than production`);
  } else {
    const v_ratio = (sg_v_error / prod_v_error).toFixed(2);
    console.log(`  SG velocity is ${v_ratio}x WORSE than production`);
  }
  
  if (sg_a_error < prod_a_error) {
    const a_ratio = (prod_a_error / sg_a_error).toFixed(2);
    console.log(`  SG acceleration is ${a_ratio}x more accurate than production`);
  } else {
    const a_ratio = (sg_a_error / prod_a_error).toFixed(2);
    console.log(`  SG acceleration is ${a_ratio}x WORSE than production`);
  }
  
  const v_test_pass = sg_v_error < prod_v_error;
  const a_test_pass = sg_a_error < prod_a_error;
  console.log();
  console.log(`  ✓ Velocity accuracy test: ${v_test_pass ? 'PASS' : 'FAIL'} (SG < production)`);
  console.log(`  ✓ Acceleration accuracy test: ${a_test_pass ? 'PASS' : 'FAIL'} (SG < production)`);
  console.log();
  
  // Test 4: Energy conservation
  console.log('Test 4: Mechanical Energy Conservation (Frictionless Pendulum)');
  console.log('-'.repeat(70));
  const mass = 0.1;
  const g = 9.8;
  const h0 = 0;
  
  // Production energy
  const prod_Ek = prod.v.map(v => 0.5 * mass * v * v);
  const prod_Ep = prod.x.map(x => mass * g * (x + h0));
  const prod_Em = prod_Ek.map((Ek, i) => Ek + prod_Ep[i]);
  const prod_Em_std = std(prod_Em, 2);
  const prod_Em_p2p = peakToPeak(prod_Em, 2);
  
  // SG energy
  const sg_Ek = sg.v.map(v => 0.5 * mass * v * v);
  const sg_Ep = sg.x.map(x => mass * g * (x + h0));
  const sg_Em = sg_Ek.map((Ek, i) => Ek + sg_Ep[i]);
  const sg_Em_std = std(sg_Em, 2);
  const sg_Em_p2p = peakToPeak(sg_Em, 2);
  
  console.log(`  Production (smooth + FD):`);
  console.log(`    Em std dev (drop 2 edge):  ${prod_Em_std.toFixed(6)} J`);
  console.log(`    Em peak-to-peak (drop 2):  ${prod_Em_p2p.toFixed(6)} J`);
  console.log(`  Savitzky-Golay:`);
  console.log(`    Em std dev (drop 2 edge):  ${sg_Em_std.toFixed(6)} J`);
  console.log(`    Em peak-to-peak (drop 2):  ${sg_Em_p2p.toFixed(6)} J`);
  console.log();
  
  const energy_std_improvement = ((prod_Em_std - sg_Em_std) / prod_Em_std * 100).toFixed(1);
  const energy_p2p_improvement = ((prod_Em_p2p - sg_Em_p2p) / prod_Em_p2p * 100).toFixed(1);
  console.log(`  Energy std dev reduction:  ${energy_std_improvement}%`);
  console.log(`  Energy p2p reduction:      ${energy_p2p_improvement}%`);
  
  // Require meaningful improvement (>1%)
  const energy_test_pass = sg_Em_std < prod_Em_std * 0.99;
  console.log(`  ✓ Energy conservation test: ${energy_test_pass ? 'PASS' : 'FAIL'} (SG < production * 0.99)`);
  console.log();
  
  // Test 5: Edge behavior
  console.log('Test 5: Edge Behavior (last 3 samples)');
  console.log('-'.repeat(70));
  console.log('Production a:', prod.a.slice(-3).map(v => v.toFixed(4)).join(', '));
  console.log('SG a:        ', sg.a.slice(-3).map(v => v.toFixed(4)).join(', '));
  console.log('True a:      ', a_true.slice(-3).map(v => v.toFixed(4)).join(', '));
  console.log();
  
  // Summary
  console.log('='.repeat(70));
  console.log('Test Summary');
  console.log('='.repeat(70));
  const all_pass = v_test_pass && a_test_pass && energy_test_pass;
  console.log(`  Velocity accuracy:      ${v_test_pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Acceleration accuracy:  ${a_test_pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Energy conservation:    ${energy_test_pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log();
  if (all_pass) {
    console.log('  ✓ ALL TESTS PASSED');
    console.log('  Savitzky-Golay polynomial derivatives improve accuracy');
    console.log('  over production baseline (smooth + finite differences).');
  } else {
    console.log('  ✗ SOME TESTS FAILED');
    console.log('  SG derivatives did not meet accuracy requirements vs production.');
  }
  console.log('='.repeat(70));
  
  process.exit(all_pass ? 0 : 1);
}

// Run tests
runTests();
