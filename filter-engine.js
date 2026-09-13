// Savitzky-Golay smoothing filter for position data
// Fits a local polynomial to preserve trends better than moving average
window.FilterEngine = (() => {
  // Savitzky-Golay filter coefficients for different window sizes and polynomial order
  // Using order 2 (quadratic) for smoothness while preserving acceleration features
  const SG_COEFFS = {
    // radius 0: no filter
    0: [1],
    // radius 1: 3-point quadratic
    1: [-0.08571428571428572, 0.34285714285714286, 0.48571428571428565, 0.34285714285714286, -0.08571428571428572],
    // radius 2: 5-point quadratic  
    2: [-0.14285714285714285, 0.0, 0.2857142857142857, 0.42857142857142855, 0.5714285714285714, 0.42857142857142855, 0.2857142857142857, 0.0, -0.14285714285714285],
    // radius 3: 7-point quadratic
    3: [-0.09523809523809523, -0.14285714285714285, 0.0, 0.2857142857142857, 0.42857142857142855, 0.6428571428571429, 0.7142857142857143, 0.6428571428571429, 0.42857142857142855, 0.2857142857142857, 0.0, -0.14285714285714285, -0.09523809523809523],
    // radius 4: 9-point quadratic
    4: [-0.08391608391608392, -0.10489510489510489, -0.06293706293706294, 0.02097902097902098, 0.16783216783216784, 0.28321678321678323, 0.4335664335664336, 0.5174825174825175, 0.5594405594405594, 0.5594405594405594, 0.5174825174825175, 0.4335664335664336, 0.28321678321678323, 0.16783216783216784, 0.02097902097902098, -0.06293706293706294, -0.10489510489510489, -0.08391608391608392]
  };

  function savitzkyGolay(values, strength) {
    if (strength <= 0 || values.length < 3) return values.slice();
    const radius = Math.min(4, strength); // cap at radius 4
    const coeffs = SG_COEFFS[radius];
    if (!coeffs) return values.slice(); // fallback
    
    const out = new Array(values.length);
    const halfWin = Math.floor(coeffs.length / 2);
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0, wsum = 0;
      for (let j = -halfWin; j <= halfWin; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < values.length) {
          const w = coeffs[j + halfWin];
          sum += values[idx] * w;
          wsum += w;
        }
      }
      out[i] = wsum > 0.01 ? sum / wsum : values[i];
    }
    return out;
  }

  // Triangular weighted moving average (original, kept for compatibility)
  function triangularSmooth(values, strength) {
    if (strength <= 0 || values.length < 3) return values.slice();
    const radius = strength;
    const out = [];
    for (let i = 0; i < values.length; i++) {
      let sum = 0, wsum = 0;
      for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
        const w = radius + 1 - Math.abs(i - j);
        sum += values[j] * w;
        wsum += w;
      }
      out.push(sum / wsum);
    }
    return out;
  }

  // Main filter function: Savitzky-Golay for better trend preservation
  function smooth(values, strength) {
    return savitzkyGolay(values, strength);
  }

  return { smooth, savitzkyGolay, triangularSmooth };
})();
