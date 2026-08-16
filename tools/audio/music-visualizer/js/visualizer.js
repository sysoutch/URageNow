// =========================================================
// VISUALIZER - Canvas rendering & animation
// =========================================================

// Canvas setup and view controls (must load before player.js for HTML inline handlers)
const canvas = document.getElementById('visualizerCanvas');

// Enable smoothing by default (for curves), disable only for bar views
const ctx = canvas.getContext('2d', { willReadFrequently: true });
ctx.imageSmoothingEnabled = true;

function initCanvas() {
  const size = parseInt(document.getElementById('pixelSize').value);
  
  // Set internal resolution to match the actual displayed size of the canvas element
  // This prevents blurry stretching - each CSS pixel maps to one canvas pixel
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width) || 800;
  canvas.height = Math.round(rect.height) || 450;
  peaks = new Array(canvas.width).fill(0);

  if (size > 16) {
    canvas.classList.add('pixelated');
  } else {
    canvas.classList.remove('pixelated');
  }
}

// Ensure canvas is sized after layout settles
function ensureCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    const newWidth = Math.round(rect.width);
    const newHeight = Math.round(rect.height);
    if (newWidth !== canvas.width || newHeight !== canvas.height) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      peaks = new Array(canvas.width).fill(0);
    }
  }
}

// Call on resize and after a short delay to catch the initial layout
window.addEventListener('resize', ensureCanvasSize);
setTimeout(ensureCanvasSize, 50);
setTimeout(ensureCanvasSize, 200);
setTimeout(ensureCanvasSize, 1000);

function changeView() {
  currentView = document.getElementById('viewType').value;
}

function updateColorMode() {
  colorMode = document.getElementById('colorMode').value;
}

function getColor(index, max, intensity) {
  switch(colorMode) {
    case 'mono-green':
      return `rgb(0, ${Math.floor(255 * intensity)}, 65)`;
    case 'mono-cyan':
      return `rgb(0, ${Math.floor(255 * intensity)}, ${Math.floor(255 * intensity)})`;
    case 'gradient':
      const hue = 180 + (index / max) * 180;
      return `hsl(${hue}, 100%, ${50 + intensity * 50}%)`;
    case 'spectrum':
    default:
      const h = (index / max) * 360;
      return `hsl(${h}, 100%, ${50 + intensity * 50}%)`;
  }
}

function drawBars() {
  // Disable smoothing for pixel-perfect bars
  ctx.imageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  
  ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bufferLength = analyser.frequencyBinCount;
  const barWidth = canvas.width / (bufferLength / 2);
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * canvas.height;
    const intensity = dataArray[i] / 255;
    
    ctx.fillStyle = getColor(i, bufferLength, intensity);
    const gridY = Math.floor(canvas.height - barHeight);
    ctx.fillRect(x, gridY, barWidth - 1, barHeight);

    if (barHeight > peaks[i]) {
      peaks[i] = barHeight;
    } else {
      peaks[i] -= 0.5;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, canvas.height - peaks[i] - 2, barWidth - 1, 2);
    x += barWidth;
  }
  
  // Re-enable smoothing for next frame (curves)
  ctx.imageSmoothingEnabled = true;
  ctx.webkitImageSmoothingEnabled = true;
}

function drawCircular() {
  // Enable smoothing for curved shapes
  ctx.imageSmoothingEnabled = true;
  ctx.webkitImageSmoothingEnabled = true;
  
  ctx.fillStyle = 'rgba(5, 5, 5, 0.2)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bufferLength = analyser.frequencyBinCount;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) * 0.6;

  // Outer ring
  ctx.beginPath();
  for (let i = 0; i < bufferLength; i++) {
    const angle = (i / bufferLength) * Math.PI * 2;
    const barHeight = (dataArray[i] / 255) * radius * 0.5;
    const x = centerX + Math.cos(angle) * (radius + barHeight);
    const y = centerY + Math.sin(angle) * (radius + barHeight);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = getColor(0, bufferLength, 1);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bars on circle
  for (let i = 0; i < bufferLength; i++) {
    const angle = (i / bufferLength) * Math.PI * 2;
    const barHeight = (dataArray[i] / 255) * radius * 0.6;
    const intensity = dataArray[i] / 255;
    const x1 = centerX + Math.cos(angle) * radius;
    const y1 = centerY + Math.sin(angle) * radius;
    const x2 = centerX + Math.cos(angle) * (radius + barHeight);
    const y2 = centerY + Math.sin(angle) * (radius + barHeight);
    ctx.strokeStyle = getColor(i, bufferLength, intensity);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawWaveform() {
  // Enable smoothing for curved shapes
  ctx.imageSmoothingEnabled = true;
  ctx.webkitImageSmoothingEnabled = true;
  
  ctx.fillStyle = 'rgba(5, 5, 5, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bufferLength = analyser.frequencyBinCount;
  const centerY = canvas.height / 2;
  const pointSpacing = canvas.width / bufferLength;

  // Top half
  ctx.beginPath();
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * centerY;
    const x = i * pointSpacing;
    if (i === 0) ctx.moveTo(x, centerY - barHeight); else ctx.lineTo(x, centerY - barHeight);
  }
  ctx.strokeStyle = getColor(0, bufferLength, 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bottom mirror
  ctx.beginPath();
  for (let i = bufferLength - 1; i >= 0; i--) {
    const barHeight = (dataArray[i] / 255) * centerY;
    const x = i * pointSpacing;
    if (i === bufferLength - 1) ctx.moveTo(x, centerY + barHeight); else ctx.lineTo(x, centerY + barHeight);
  }
  ctx.fillStyle = getColor(0, bufferLength, 0.4);
  ctx.fill();

  // Center line
  ctx.strokeStyle = 'rgba(0, 255, 65, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(canvas.width, centerY);
  ctx.stroke();
}

function drawSpectrum() {
  // Disable smoothing for pixel-perfect bars
  ctx.imageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  
  ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bufferLength = analyser.frequencyBinCount;
  const barWidth = canvas.width / bufferLength;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * canvas.height;
    const intensity = dataArray[i] / 255;
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
    gradient.addColorStop(0, getColor(i, bufferLength, intensity * 0.5));
    gradient.addColorStop(1, getColor(i, bufferLength, intensity));
    ctx.fillStyle = gradient;
    ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
  }
  
  // Re-enable smoothing for next frame (curves)
  ctx.imageSmoothingEnabled = true;
  ctx.webkitImageSmoothingEnabled = true;
}

function drawOrbs() {
  // Enable smoothing for curved shapes
  ctx.imageSmoothingEnabled = true;
  ctx.webkitImageSmoothingEnabled = true;
  
  ctx.fillStyle = 'rgba(5, 5, 5, 0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bufferLength = analyser.frequencyBinCount;
  const numOrbs = Math.min(16, bufferLength / 4);
  const orbSpacing = canvas.width / numOrbs;
  const centerY = canvas.height / 2;

  for (let i = 0; i < numOrbs; i++) {
    const dataIndex = Math.floor((i / numOrbs) * bufferLength);
    const orbSize = (dataArray[dataIndex] / 255) * 30 + 10;
    const intensity = dataArray[dataIndex] / 255;
    const x = orbSpacing * i + orbSpacing / 2;
    const y = centerY + Math.sin(Date.now() * 0.001 + i) * 20;

    // Outer glow
    const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, orbSize + 10);
    glowGradient.addColorStop(0, getColor(i, numOrbs, intensity));
    glowGradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, orbSize + 10, 0, Math.PI * 2);
    ctx.fill();

    // Main orb
    ctx.fillStyle = getColor(i, numOrbs, intensity);
    ctx.beginPath();
    ctx.arc(x, y, orbSize, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x - orbSize / 3, y - orbSize / 3, orbSize / 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  requestAnimationFrame(draw);
  
  // Keep canvas resolution synced with displayed size (handles window resize while playing)
  ensureCanvasSize();
  
  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  updateProgress();

  switch(currentView) {
    case 'bars': drawBars(); break;
    case 'circular': drawCircular(); break;
    case 'waveform': drawWaveform(); break;
    case 'spectrum': drawSpectrum(); break;
    case 'orbs': drawOrbs(); break;
    default: drawBars();
  }
}