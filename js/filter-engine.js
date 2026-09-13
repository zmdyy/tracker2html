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

  /**
   * Compute SG coefficients for smoothing and derivatives
   * Uses least-squares polynomial fitting
   */
  function computeSGCoeffs(radius, polyOrder, deriv) {
    const m = 2 * radius + 1;
    if (m < polyOrder + 1) polyOrder = m - 1;
    
    const n = polyOrder + 1;
    
    // Build Vandermonde matrix
    const A = [];
    for (let i = -radius; i <= radius; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        row.push(Math.pow(i, j));
      }
      A.push(row);
    }
    
    // Compute A^T * A
    const AtA = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < m; k++) {
          AtA[i][j] += A[k][i] * A[k][j];
        }
      }
    }
    
    // Unit vector for derivative order
    const e = Array(n).fill(0);
    let factorial = 1;
    for (let i = 1; i <= deriv; i++) factorial *= i;
    e[deriv] = factorial;
    
    // Solve AtA * c = e using Gaussian elimination
    const c = gaussianElim(AtA, e);
    if (!c) return null;
    
    // Compute convolution coefficients
    const coeffs = [];
    for (let i = 0; i < m; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += c[j] * A[i][j];
      }
      coeffs.push(sum);
    }
    
    return coeffs;
  }
  
  function gaussianElim(A, b) {
    const n = A.length;
    const aug = A.map((row, i) => [...row, b[i]]);
    
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
          maxRow = row;
        }
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      
      if (Math.abs(aug[col][col]) < 1e-10) return null;
      
      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }
    
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= aug[i][j] * x[j];
      }
      x[i] = sum / aug[i][i];
    }
    
    return x;
  }

  /**
   * Apply Savitzky-Golay filter to get smoothed value, 1st derivative, and 2nd derivative
   * All from the SAME local polynomial fit (avoiding double filtering)
   * @param {Array<number>} t - time array
   * @param {Array<number>} q - position array (raw)
   * @param {number} radius - window half-width (0-4)
   * @returns {Object} {x: smoothed, v: 1st deriv, a: 2nd deriv}
   */
  function sgFilterWithDerivatives(t, q, radius) {
    const n = q.length;
    if (radius <= 0 || n < 3) {
      // Fallback to finite differences
      const x = q.slice();
      const v = new Array(n).fill(0);
      const a = new Array(n).fill(0);
      
      for (let i = 1; i < n - 1; i++) {
        const dt = t[i+1] - t[i-1];
        v[i] = dt ? (q[i+1] - q[i-1]) / dt : 0;
      }
      v[0] = (q[1] - q[0]) / Math.max(1e-9, t[1] - t[0]);
      v[n-1] = (q[n-1] - q[n-2]) / Math.max(1e-9, t[n-1] - t[n-2]);
      
      for (let i = 1; i < n - 1; i++) {
        const dt = t[i+1] - t[i-1];
        a[i] = dt ? (v[i+1] - v[i-1]) / dt : 0;
      }
      a[0] = (v[1] - v[0]) / Math.max(1e-9, t[1] - t[0]);
      a[n-1] = (v[n-1] - v[n-2]) / Math.max(1e-9, t[n-1] - t[n-2]);
      
      return { x, v, a };
    }
    
    radius = Math.min(4, radius);
    
    // Choose polynomial order: 3 for 2nd deriv (user requires >= 3), 4 if window allows
    const windowSize = 2 * radius + 1;
    let polyOrder = Math.min(4, windowSize - 1);
    if (polyOrder < 3 && windowSize >= 4) polyOrder = 3;
    
    // Compute SG coefficients for smooth (deriv=0), 1st deriv, and 2nd deriv
    const coeffs0 = computeSGCoeffs(radius, polyOrder, 0);
    const coeffs1 = computeSGCoeffs(radius, polyOrder, 1);
    const coeffs2 = computeSGCoeffs(radius, polyOrder, 2);
    
    if (!coeffs0 || !coeffs1 || !coeffs2) {
      // Fallback
      return sgFilterWithDerivatives(t, q, 0);
    }
    
    const x = new Array(n);
    const v = new Array(n);
    const a = new Array(n);
    
    // Compute average dt for scaling
    const dt_avg = (t[n-1] - t[0]) / (n - 1);
    
    for (let i = 0; i < n; i++) {
      let sum0 = 0, sum1 = 0, sum2 = 0;
      
      for (let j = -radius; j <= radius; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < n) {
          const w0 = coeffs0[j + radius];
          const w1 = coeffs1[j + radius];
          const w2 = coeffs2[j + radius];
          
          sum0 += q[idx] * w0;
          sum1 += q[idx] * w1;
          sum2 += q[idx] * w2;
        }
      }
      
      x[i] = sum0;
      v[i] = sum1 / dt_avg;
      a[i] = sum2 / (dt_avg * dt_avg);
    }
    
    return { x, v, a };
  }

  // Main filter function: Savitzky-Golay for better trend preservation
  function smooth(values, strength) {
    return savitzkyGolay(values, strength);
  }

  return { 
    smooth, 
    savitzkyGolay, 
    triangularSmooth,
    sgFilterWithDerivatives 
  };
})();
