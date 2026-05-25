// ==============================================================
// TUGAS PRAKTIKUM PENGOLAHAN CITRA DIGITAL
// Nama          : Naufal Madani
// NIM           : 241011128
// Program Studi : Rekayasa Perangkat Lunak - Semester 4
// Kampus        : Institut Teknologi Bacharuddin Jusuf Habibie (ITH)
// File          : script.js — Image Processing Engine
// ==============================================================

/* ================================================================
   GLOBAL STATE
================================================================ */
let imgData  = null;   // original proportional ImageData
let grayData = null;   // grayscale ImageData
let imgW     = 0;
let imgH     = 0;

let chartRGB  = null;
let chartGray = null;
let chartHSV  = null;

/* ================================================================
   SCROLL REVEAL
================================================================ */
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.05 });

document.querySelectorAll('.section').forEach(s => observer.observe(s));

// Langsung tampilkan section pertama tanpa scroll
['sec-upload', 'sec-gray'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.classList.add('visible');
});

/* ================================================================
   SLIDER RANGE GRADIENT SYNC
================================================================ */
function syncSliderGradient(input) {
  const min = +input.min, max = +input.max, val = +input.value;
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--val', pct + '%');
}

document.querySelectorAll('input[type="range"]').forEach(r => {
  syncSliderGradient(r);
  r.addEventListener('input', () => syncSliderGradient(r));
});

/* ================================================================
   FILE UPLOAD HANDLING
================================================================ */
const fileInput  = document.getElementById('file-input');
const uploadZone = document.getElementById('upload-zone');

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processFile(file);
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) processFile(e.target.files[0]);
});

/**
 * Memproses file gambar yang diupload:
 * - Resize proporsional ke lebar 300px
 * - Simpan ImageData ke state global
 * - Tampilkan info file
 * - Jalankan seluruh proses pengolahan citra
 */
function processFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    // Hitung dimensi proporsional (lebar 300px)
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    const newW  = 300;
    const newH  = Math.round(origH * (newW / origW));
    imgW = newW;
    imgH = newH;

    // Gambar ke offscreen canvas untuk ambil ImageData
    const offscreen = document.createElement('canvas');
    offscreen.width  = newW;
    offscreen.height = newH;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(img, 0, 0, newW, newH);
    imgData = ctx.getImageData(0, 0, newW, newH);

    // Tampilkan info file
    document.getElementById('info-name').textContent        = file.name;
    document.getElementById('info-size').textContent        = formatBytes(file.size);
    document.getElementById('info-res').textContent         = `${origW} × ${origH} px`;
    document.getElementById('info-display-res').textContent = `${newW} × ${newH} px`;
    document.getElementById('info-type').textContent        = file.type;
    document.getElementById('original-display').classList.remove('hidden');
    document.getElementById('file-info').classList.remove('hidden');

    // Render gambar asli
    renderImageDataToCanvas('canvas-original', imgData, newW, newH);

    // Jalankan semua proses pengolahan citra
    computeGrayscale();
    showAllSections();

    URL.revokeObjectURL(url);
  };

  img.src = url;
}

/** Format ukuran file ke satuan yang terbaca manusia */
function formatBytes(b) {
  if (b < 1024)    return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

/** Tampilkan semua section setelah gambar diupload */
function showAllSections() {
  ['gray', 'binary', 'arith', 'logic', 'hist', 'conv', 'morph'].forEach(key => {
    const ph = document.getElementById(key + '-placeholder');
    const ct = document.getElementById(key + '-content');
    if (ph) ph.classList.add('hidden');
    if (ct) ct.classList.remove('hidden');
  });

  renderBinary();
  renderBrightness();
  renderBitand();
  renderNot();
  buildHistograms();
  buildConvolutions();
  buildMorphology();
}

/* ================================================================
   HELPER: Render ImageData ke elemen canvas berdasarkan ID
================================================================ */
function renderImageDataToCanvas(canvasId, data, w, h) {
  const canvas  = document.getElementById(canvasId);
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(data, 0, 0);
}

/* ================================================================
   POIN 3.1 — GRAYSCALE
   Formula: gray = 0.299*R + 0.587*G + 0.114*B
================================================================ */
function computeGrayscale() {
  const src = imgData.data;
  const out = new ImageData(imgW, imgH);
  const d   = out.data;

  for (let i = 0; i < src.length; i += 4) {
    const g = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    d[i + 3] = 255;
  }

  grayData = out;
  renderImageDataToCanvas('canvas-gray', out, imgW, imgH);
}

/* ================================================================
   POIN 3.2 — CITRA BINER (THRESHOLDING)
   Piksel > threshold → putih (255), ≤ threshold → hitam (0)
================================================================ */
const sliderThreshold = document.getElementById('slider-threshold');
sliderThreshold.addEventListener('input', renderBinary);

function renderBinary() {
  if (!grayData) return;

  const t   = +sliderThreshold.value;
  document.getElementById('val-threshold').textContent = t;
  document.getElementById('lbl-threshold').textContent = t;
  syncSliderGradient(sliderThreshold);

  const src = grayData.data;
  const out = new ImageData(imgW, imgH);
  const d   = out.data;

  for (let i = 0; i < src.length; i += 4) {
    const v = src[i] > t ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }

  renderImageDataToCanvas('canvas-binary', out, imgW, imgH);
}

/* ================================================================
   POIN 3.3 — OPERASI ARITMATIKA (BRIGHTNESS)
   Setiap piksel ditambah/dikurangi nilai beta, di-clamp ke 0–255
================================================================ */
const sliderBrightness = document.getElementById('slider-brightness');
sliderBrightness.addEventListener('input', renderBrightness);

function renderBrightness() {
  if (!imgData) return;

  const beta = +sliderBrightness.value;
  document.getElementById('val-brightness').textContent = (beta >= 0 ? '+' : '') + beta;
  syncSliderGradient(sliderBrightness);

  const src = imgData.data;
  const out = new ImageData(imgW, imgH);
  const d   = out.data;

  for (let i = 0; i < src.length; i += 4) {
    d[i]     = clamp(src[i]     + beta);
    d[i + 1] = clamp(src[i + 1] + beta);
    d[i + 2] = clamp(src[i + 2] + beta);
    d[i + 3] = 255;
  }

  renderImageDataToCanvas('canvas-arith', out, imgW, imgH);
}

/* ================================================================
   POIN 3.4 — OPERASI LOGIKA
   a) Bitwise AND dengan nilai konstan (slider)
   b) Citra Negatif (Bitwise NOT)
================================================================ */
const sliderBitand = document.getElementById('slider-bitand');
sliderBitand.addEventListener('input', renderBitand);

function renderBitand() {
  if (!imgData) return;

  const mask = +sliderBitand.value;
  document.getElementById('val-bitand').textContent = mask;
  syncSliderGradient(sliderBitand);

  const src = imgData.data;
  const out = new ImageData(imgW, imgH);
  const d   = out.data;

  for (let i = 0; i < src.length; i += 4) {
    d[i]     = src[i]     & mask;
    d[i + 1] = src[i + 1] & mask;
    d[i + 2] = src[i + 2] & mask;
    d[i + 3] = 255;
  }

  renderImageDataToCanvas('canvas-bitand', out, imgW, imgH);
}

function renderNot() {
  if (!imgData) return;

  const src = imgData.data;
  const out = new ImageData(imgW, imgH);
  const d   = out.data;

  for (let i = 0; i < src.length; i += 4) {
    d[i]     = 255 - src[i];
    d[i + 1] = 255 - src[i + 1];
    d[i + 2] = 255 - src[i + 2];
    d[i + 3] = 255;
  }

  renderImageDataToCanvas('canvas-not', out, imgW, imgH);
}

/* ================================================================
   OPTIONAL 1 — HISTOGRAM
   Menghitung distribusi frekuensi nilai piksel (0–255)
   untuk channel RGB, Grayscale, dan HSV Value
================================================================ */
function buildHistograms() {
  if (!imgData || !grayData) return;

  // Hitung histogram RGB
  const rHist = new Array(256).fill(0);
  const gHist = new Array(256).fill(0);
  const bHist = new Array(256).fill(0);
  const src = imgData.data;

  for (let i = 0; i < src.length; i += 4) {
    rHist[src[i]]++;
    gHist[src[i + 1]]++;
    bHist[src[i + 2]]++;
  }

  // Hitung histogram Grayscale
  const grHist = new Array(256).fill(0);
  const gs = grayData.data;
  for (let i = 0; i < gs.length; i += 4) grHist[gs[i]]++;

  // Hitung histogram HSV Value (kecerahan)
  const vHist = new Array(256).fill(0);
  for (let i = 0; i < src.length; i += 4) {
    const v = rgbToHSV(src[i], src[i + 1], src[i + 2]).v;
    vHist[Math.round(v * 255)]++;
  }

  const labels = Array.from({ length: 256 }, (_, i) => i);

  // Konfigurasi umum Chart.js
  const chartCfg = (datasets) => ({
    type: 'line',
    data: { labels, datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      elements: { point: { radius: 0 }, line: { tension: 0.1 } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', maxTicksLimit: 16, font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        }
      },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } }
      }
    }
  });

  // Hancurkan chart lama sebelum buat baru (mencegah memory leak)
  if (chartRGB)  chartRGB.destroy();
  if (chartGray) chartGray.destroy();
  if (chartHSV)  chartHSV.destroy();

  chartRGB = new Chart(document.getElementById('chart-rgb'), chartCfg([
    { label: 'Red',   data: rHist, borderColor: '#f87171', borderWidth: 1.5, fill: false },
    { label: 'Green', data: gHist, borderColor: '#4ade80', borderWidth: 1.5, fill: false },
    { label: 'Blue',  data: bHist, borderColor: '#60a5fa', borderWidth: 1.5, fill: false },
  ]));

  chartGray = new Chart(document.getElementById('chart-gray'), chartCfg([
    {
      label: 'Grayscale',
      data: grHist,
      borderColor: '#e2e8f0',
      borderWidth: 2,
      fill: true,
      backgroundColor: 'rgba(226,232,240,0.08)'
    }
  ]));

  chartHSV = new Chart(document.getElementById('chart-hsv'), chartCfg([
    {
      label: 'Value (Kecerahan/HSV)',
      data: vHist,
      borderColor: '#c084fc',
      borderWidth: 2,
      fill: true,
      backgroundColor: 'rgba(192,132,252,0.08)'
    }
  ]));
}

/* ================================================================
   OPTIONAL 2 — KONVOLUSI / FILTERING
   Definisi 5 kernel konvolusi 3×3
================================================================ */
const KERNELS = [
  {
    name: 'Mean (Blur)',
    emoji: '💧',
    kernel: [
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9],
      [1/9, 1/9, 1/9]
    ]
  },
  {
    name: 'Sharpening Standar',
    emoji: '🔪',
    kernel: [
      [ 0, -1,  0],
      [-1,  5, -1],
      [ 0, -1,  0]
    ]
  },
  {
    name: 'Sharpening Extreme',
    emoji: '⚡',
    kernel: [
      [-1, -1, -1],
      [-1,  9, -1],
      [-1, -1, -1]
    ]
  },
  {
    name: 'Edge Vertikal',
    emoji: '↕️',
    kernel: [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1]
    ]
  },
  {
    name: 'Edge Horizontal',
    emoji: '↔️',
    kernel: [
      [-1, -2, -1],
      [ 0,  0,  0],
      [ 1,  2,  1]
    ]
  }
];

/** Membangun grid konvolusi dan menampilkan hasilnya */
function buildConvolutions() {
  if (!imgData) return;

  const grid = document.getElementById('conv-grid');
  grid.innerHTML = '';

  KERNELS.forEach((kDef, idx) => {
    const result   = applyConvolution(imgData, kDef.kernel, imgW, imgH);
    const canvasId = `canvas-conv-${idx}`;

    const item = document.createElement('div');
    item.className = 'conv-item';
    item.innerHTML = `
      <div class="conv-item-header">
        <h4>${kDef.emoji} ${kDef.name}</h4>
        ${buildKernelHTML(kDef.kernel)}
      </div>
      <canvas id="${canvasId}"></canvas>
    `;
    grid.appendChild(item);

    // Render setelah elemen ada di DOM
    requestAnimationFrame(() => {
      const canvas  = document.getElementById(canvasId);
      canvas.width  = imgW;
      canvas.height = imgH;
      canvas.getContext('2d').putImageData(result, 0, 0);
    });
  });
}

/**
 * Membuat HTML visual untuk menampilkan nilai kernel
 * Nilai positif → biru, negatif → merah, nol → abu-abu
 */
function buildKernelHTML(k) {
  let html = `<div class="kernel-display" style="grid-template-columns:repeat(${k[0].length},36px)">`;

  k.forEach(row => row.forEach(v => {
    const disp = Number.isInteger(v)
      ? v
      : (Math.abs(v) < 0.1 ? '1/' + Math.round(1 / Math.abs(v)) : v.toFixed(2));
    const cls = v > 0 ? 'positive' : v < 0 ? 'negative' : 'zero';
    html += `<div class="kernel-cell ${cls}">${disp}</div>`;
  }));

  html += '</div>';
  return html;
}

/**
 * Menerapkan konvolusi 2D pada ImageData menggunakan kernel yang diberikan
 * Menggunakan border-clamp (batas piksel dijaga dalam range gambar)
 */
function applyConvolution(imageData, kernel, w, h) {
  const src = imageData.data;
  const out = new ImageData(w, h);
  const d   = out.data;
  const kH  = kernel.length;
  const kW  = kernel[0].length;
  const kHH = Math.floor(kH / 2);
  const kHW = Math.floor(kW / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0;

      for (let ky = 0; ky < kH; ky++) {
        for (let kx = 0; kx < kW; kx++) {
          const sy  = clampCoord(y + ky - kHH, h);
          const sx  = clampCoord(x + kx - kHW, w);
          const idx = (sy * w + sx) * 4;
          const kv  = kernel[ky][kx];
          rSum += src[idx]     * kv;
          gSum += src[idx + 1] * kv;
          bSum += src[idx + 2] * kv;
        }
      }

      const idx  = (y * w + x) * 4;
      d[idx]     = clamp(Math.round(rSum));
      d[idx + 1] = clamp(Math.round(gSum));
      d[idx + 2] = clamp(Math.round(bSum));
      d[idx + 3] = 255;
    }
  }

  return out;
}

/* ================================================================
   OPTIONAL 3 — OPERASI MORFOLOGI
   7 Kernel × 2 Operasi (Erosi & Dilasi) = 14 Output
================================================================ */
const MORPH_KERNELS = [
  {
    name: 'Kernel Kotak (3×3)',
    emoji: '⬜',
    k: [[1,1,1],[1,1,1],[1,1,1]]
  },
  {
    name: 'Kernel Plus (+)',
    emoji: '➕',
    k: [[0,1,0],[1,1,1],[0,1,0]]
  },
  {
    name: 'Kernel Cross (×)',
    emoji: '✖️',
    k: [[1,0,1],[0,1,0],[1,0,1]]
  },
  {
    name: 'Kernel Horizontal (—)',
    emoji: '↔️',
    k: [[0,0,0],[1,1,1],[0,0,0]]
  },
  {
    name: 'Kernel Vertikal (|)',
    emoji: '↕️',
    k: [[0,1,0],[0,1,0],[0,1,0]]
  },
  {
    name: 'Kernel Diagonal Kanan (\\)',
    emoji: '↗️',
    k: [[0,0,1],[0,1,0],[1,0,0]]
  },
  {
    name: 'Kernel Diagonal Kiri (/)',
    emoji: '↖️',
    k: [[1,0,0],[0,1,0],[0,0,1]]
  }
];

/** Membangun semua section morfologi secara dinamis */
function buildMorphology() {
  if (!imgData) return;

  const container = document.getElementById('morph-sections');
  container.innerHTML = '';

  MORPH_KERNELS.forEach((kDef, idx) => {
    const eroded     = applyMorphology(imgData, kDef.k, imgW, imgH, 'erode');
    const dilated    = applyMorphology(imgData, kDef.k, imgW, imgH, 'dilate');
    const erosionId  = `canvas-erode-${idx}`;
    const dilationId = `canvas-dilate-${idx}`;

    const sec = document.createElement('div');
    sec.className = 'morph-section';
    sec.innerHTML = `
      <div class="morph-section-title">
        <span>${kDef.emoji}</span>
        <span>${kDef.name}</span>
        ${buildKernelHTML(kDef.k)}
      </div>
      <div class="morph-grid">
        <div class="canvas-item">
          <div class="canvas-label"><span class="dot"></span>Erosi (Erosion)</div>
          <canvas id="${erosionId}"></canvas>
        </div>
        <div class="canvas-item">
          <div class="canvas-label"><span class="dot"></span>Dilasi (Dilation)</div>
          <canvas id="${dilationId}"></canvas>
        </div>
      </div>
    `;
    container.appendChild(sec);

    requestAnimationFrame(() => {
      [[erosionId, eroded], [dilationId, dilated]].forEach(([id, data]) => {
        const c  = document.getElementById(id);
        c.width  = imgW;
        c.height = imgH;
        c.getContext('2d').putImageData(data, 0, 0);
      });
    });
  });
}

/**
 * Menerapkan operasi morfologi (erosi atau dilasi) pada ImageData
 * - Erosi  : output = nilai minimum piksel dalam area kernel
 * - Dilasi : output = nilai maksimum piksel dalam area kernel
 */
function applyMorphology(imageData, kernel, w, h, op) {
  const src = imageData.data;
  const out = new ImageData(w, h);
  const d   = out.data;
  const kH  = kernel.length;
  const kW  = kernel[0].length;
  const kHH = Math.floor(kH / 2);
  const kHW = Math.floor(kW / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rAcc = op === 'erode' ? 255 : 0;
      let gAcc = op === 'erode' ? 255 : 0;
      let bAcc = op === 'erode' ? 255 : 0;

      for (let ky = 0; ky < kH; ky++) {
        for (let kx = 0; kx < kW; kx++) {
          if (!kernel[ky][kx]) continue;
          const sy  = clampCoord(y + ky - kHH, h);
          const sx  = clampCoord(x + kx - kHW, w);
          const idx = (sy * w + sx) * 4;

          if (op === 'erode') {
            rAcc = Math.min(rAcc, src[idx]);
            gAcc = Math.min(gAcc, src[idx + 1]);
            bAcc = Math.min(bAcc, src[idx + 2]);
          } else {
            rAcc = Math.max(rAcc, src[idx]);
            gAcc = Math.max(gAcc, src[idx + 1]);
            bAcc = Math.max(bAcc, src[idx + 2]);
          }
        }
      }

      const idx  = (y * w + x) * 4;
      d[idx]     = rAcc;
      d[idx + 1] = gAcc;
      d[idx + 2] = bAcc;
      d[idx + 3] = 255;
    }
  }

  return out;
}

/* ================================================================
   HISTOGRAM TABS — Navigasi tab antar jenis histogram
================================================================ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('.section-card');
    parent.querySelectorAll('.tab-btn').forEach(b  => b.classList.remove('active'));
    parent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

/* ================================================================
   UTILITY FUNCTIONS
================================================================ */

/** Memastikan nilai piksel tetap dalam rentang 0–255 */
function clamp(v) {
  return Math.max(0, Math.min(255, v));
}

/** Memastikan koordinat tetap dalam batas dimensi gambar */
function clampCoord(v, max) {
  return Math.max(0, Math.min(max - 1, v));
}

/**
 * Konversi warna dari RGB ke HSV
 * @returns {object} { h: [0,1], s: [0,1], v: [0,1] }
 */
function rgbToHSV(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d   = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }

  return { h, s, v };
}
