const state = {
  image: null, imageUrl: "", imageWidth: 0, imageHeight: 0,
  originalImage: null, processedCanvas: null, hasTransparencyApplied: false,
  columns: 4, rows: 1, frameWidth: 0, frameHeight: 0, totalFrames: 0,
  currentFrame: 0, fps: 8, loop: true, isPlaying: false, rafId: 0, lastTick: 0,
  playbackMode: "all", targetRow: 1, rangeStart: 1, rangeEnd: 1,
  previewBounds: null, transparencyMode: "off", transparencyThreshold: 30, targetColor: "#ffffff"
};

const els = {
  spriteImage: document.getElementById("spriteImage"), columnsInput: document.getElementById("columnsInput"), rowsInput: document.getElementById("rowsInput"),
  fpsInput: document.getElementById("fpsInput"), speedPreset: document.getElementById("speedPreset"), bgSelect: document.getElementById("bgSelect"),
  playbackMode: document.getElementById("playbackMode"), rowInput: document.getElementById("rowInput"), startFrameInput: document.getElementById("startFrameInput"), endFrameInput: document.getElementById("endFrameInput"),
  transparencyMode: document.getElementById("transparencyMode"), thresholdInput: document.getElementById("thresholdInput"), thresholdValue: document.getElementById("thresholdValue"),
  targetColorWrap: document.getElementById("targetColorWrap"), targetColorInput: document.getElementById("targetColorInput"), checkerWarning: document.getElementById("checkerWarning"),
  sampleDataSelect: document.getElementById("sampleDataSelect"), sampleDataPreview: document.getElementById("sampleDataPreview"), applySampleDataButton: document.getElementById("applySampleDataButton"), copySampleDataButton: document.getElementById("copySampleDataButton"),
  applyTransparencyButton: document.getElementById("applyTransparencyButton"), restoreImageButton: document.getElementById("restoreImageButton"), downloadTransparentButton: document.getElementById("downloadTransparentButton"),
  rowModeFields: document.getElementById("rowModeFields"), rangeModeFields: document.getElementById("rangeModeFields"), splitPreviewCanvas: document.getElementById("splitPreviewCanvas"),
  playButton: document.getElementById("playButton"), stopButton: document.getElementById("stopButton"), prevButton: document.getElementById("prevButton"), nextButton: document.getElementById("nextButton"), resetButton: document.getElementById("resetButton"),
  loopToggle: document.getElementById("loopToggle"), message: document.getElementById("spriteMessage"), canvas: document.getElementById("spriteCanvas"), canvasWrap: document.getElementById("canvasWrap"), info: document.getElementById("spriteInfo")
};
const ctx = els.canvas.getContext("2d");
const splitCtx = els.splitPreviewCanvas.getContext("2d");
const modeLabel = { all: "全フレーム再生", row: "行単位再生", range: "範囲指定再生" };
let sampleDataMap = {};

const defaultSampleDataMap = {
  "sample01": { "name": "sample01", "columns": 4, "rows": 4, "fps": 11, "playbackMode": "row", "row": 1, "rangeStart": 1, "rangeEnd": 16, "loop": true, "background": "white", "imagePath": "./samples/sample_01.png", "notes": "サンプル０１" },
  "sample02": { "name": "sample02", "columns": 4, "rows": 4, "fps": 11, "playbackMode": "all", "row": 2, "rangeStart": 1, "rangeEnd": 16, "loop": true, "background": "white", "imagePath": "./samples/sample_02.png", "notes": "サンプル０２" },
  "sample03": { "name": "sample03", "columns": 4, "rows": 4, "fps": 11, "playbackMode": "all", "row": 1, "rangeStart": 1, "rangeEnd": 16, "loop": true, "background": "white", "imagePath": "./samples/sample_03.png", "notes": "サンプル０３" }
};

const SAMPLE_DATA_URL = "./samples/sample-data.json";

async function loadSampleDataMap() {
  try {
    const resolvedUrl = new URL(SAMPLE_DATA_URL, window.location.href).href;
    console.log("sample-data.json 読み込みURL:", resolvedUrl);

    const response = await fetch(SAMPLE_DATA_URL, { cache: "no-store" });
    console.log("sample-data.json response:", response.status, response.statusText);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data && typeof data === "object" && Object.keys(data).length) {
      sampleDataMap = data;
    } else {
      sampleDataMap = defaultSampleDataMap;
    }
  } catch (error) {
    sampleDataMap = defaultSampleDataMap;
    console.warn("外部サンプル設定JSONを読み込めませんでした。", error);
    showMessage("info", "外部サンプル設定JSONを読み込めなかったため、内蔵サンプル設定を使用しています。");
  }
}

function showMessage(type, text) { els.message.innerHTML = text ? `<div class="message-box ${type}">${text}</div>` : ""; }
function formatSampleData(sample) { return JSON.stringify(sample, null, 2); }
function getSelectedSampleData() {
  const keys = Object.keys(sampleDataMap);
  if (!keys.length) return null;
  return sampleDataMap[els.sampleDataSelect.value] || sampleDataMap.sample01 || sampleDataMap[keys[0]];
}
function updateSamplePreview() {
  const sample = getSelectedSampleData();
  els.sampleDataPreview.value = sample ? formatSampleData(sample) : "サンプル設定を読み込めませんでした。";
}
function toFrameNo(v, d = 1) { return Number(v) || d; }
function getFrameRect(i) { const c = i % state.columns; const r = Math.floor(i / state.columns); return { sx: c * state.frameWidth, sy: r * state.frameHeight, sw: state.frameWidth, sh: state.frameHeight, row: r, col: c }; }

function calculateFrameSize() {
  state.columns = Math.max(1, Number(els.columnsInput.value) || 1);
  state.rows = Math.max(1, Number(els.rowsInput.value) || 1);
  state.fps = Math.min(60, Math.max(1, Number(els.fpsInput.value) || 1));
  state.loop = els.loopToggle.checked;
  state.playbackMode = els.playbackMode.value;
  state.targetRow = toFrameNo(els.rowInput.value, 1);
  state.rangeStart = toFrameNo(els.startFrameInput.value, 1);
  state.rangeEnd = toFrameNo(els.endFrameInput.value, 1);
  if (!state.image) { state.frameWidth = 0; state.frameHeight = 0; state.totalFrames = 0; return; }
  state.frameWidth = Math.floor(state.imageWidth / state.columns);
  state.frameHeight = Math.floor(state.imageHeight / state.rows);
  state.totalFrames = state.columns * state.rows;
}

function getPlaybackFrames() {
  if (!state.totalFrames) return [];
  if (state.playbackMode === "row") { const start = (state.targetRow - 1) * state.columns; return Array.from({ length: state.columns }, (_, i) => start + i); }
  if (state.playbackMode === "range") { const start = state.rangeStart - 1; const end = state.rangeEnd - 1; return Array.from({ length: end - start + 1 }, (_, i) => start + i); }
  return Array.from({ length: state.totalFrames }, (_, i) => i);
}

function validate() {
  if (!state.image) return "画像が未選択です。";
  if (state.columns < 1 || state.rows < 1) return "列数・行数は1以上を指定してください。";
  if (state.fps < 1 || state.fps > 60) return "FPSは1〜60で指定してください。";
  if (state.playbackMode === "row" && (state.targetRow < 1 || state.targetRow > state.rows)) return `行番号は1〜${state.rows}で指定してください。`;
  if (state.playbackMode === "range") {
    if (state.rangeStart < 1 || state.rangeEnd < 1 || state.rangeStart > state.totalFrames || state.rangeEnd > state.totalFrames) return `開始/終了フレームは1〜${state.totalFrames}で指定してください。`;
    if (state.rangeStart > state.rangeEnd) return "開始フレームは終了フレーム以下にしてください。";
  }
  return "";
}

function drawEmpty() { ctx.clearRect(0, 0, els.canvas.width, els.canvas.height); ctx.fillStyle = "#6b7280"; ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("画像をアップロードしてください", els.canvas.width / 2, els.canvas.height / 2); }

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 255, b: 255 };
}
function removeWhiteBackground(imageData, threshold) {
  const data = imageData.data; const limit = 255 - Math.round(threshold * 0.6);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r >= limit && g >= limit && b >= limit) data[i + 3] = 0;
  }
}

function isCheckerBackgroundCandidate(r, g, b, threshold) {
  const brightness = (r + g + b) / 3;
  const colorDiff = Math.max(r, g, b) - Math.min(r, g, b);
  const coolNeutralBias = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
  const brightnessLimit = clamp(236 - threshold * 0.8, 155, 245);
  const diffLimit = clamp(12 + threshold * 0.34, 10, 38);
  const neutralBiasLimit = clamp(22 + threshold * 0.5, 18, 58);
  return brightness >= brightnessLimit && colorDiff <= diffLimit && coolNeutralBias <= neutralBiasLimit;
}

function removeCheckerBackground(imageData, threshold) {
  const { data, width, height } = imageData;
  const candidate = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const i = idx * 4;
      candidate[idx] = isCheckerBackgroundCandidate(data[i], data[i + 1], data[i + 2], threshold) ? 1 : 0;
    }
  }

  const queue = new Int32Array(width * height);
  let head = 0; let tail = 0;
  const visited = new Uint8Array(width * height);
  const pushIfEdgeCandidate = (x, y) => {
    const idx = y * width + x;
    if (!visited[idx] && candidate[idx]) { visited[idx] = 1; queue[tail++] = idx; }
  };

  for (let x = 0; x < width; x += 1) { pushIfEdgeCandidate(x, 0); pushIfEdgeCandidate(x, height - 1); }
  for (let y = 1; y < height - 1; y += 1) { pushIfEdgeCandidate(0, y); pushIfEdgeCandidate(width - 1, y); }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width; const y = Math.floor(idx / width);
    if (x > 0) { const n = idx - 1; if (!visited[n] && candidate[n]) { visited[n] = 1; queue[tail++] = n; } }
    if (x < width - 1) { const n = idx + 1; if (!visited[n] && candidate[n]) { visited[n] = 1; queue[tail++] = n; } }
    if (y > 0) { const n = idx - width; if (!visited[n] && candidate[n]) { visited[n] = 1; queue[tail++] = n; } }
    if (y < height - 1) { const n = idx + width; if (!visited[n] && candidate[n]) { visited[n] = 1; queue[tail++] = n; } }
  }

  for (let idx = 0; idx < visited.length; idx += 1) {
    if (!visited[idx]) continue;
    data[idx * 4 + 3] = 0;
  }
}

function removeTargetColor(imageData, targetColor, threshold) {
  const data = imageData.data; const t = hexToRgb(targetColor); const distLimit = threshold * 4.5;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - t.r, dg = data[i + 1] - t.g, db = data[i + 2] - t.b;
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= distLimit) data[i + 3] = 0;
  }
}

function updatePreviewImage() { drawFrame(state.currentFrame); updateSplitPreview(); updateInfo(getPlaybackFrames()); }
function updateSplitPreview() { drawSplitPreview(); }

function applyTransparency() {
  if (!state.originalImage) return showMessage("error", "画像が未選択です。");
  if (state.transparencyMode === "off") return showMessage("info", "背景透過補助がOFFです。モードを選択してください。");
  const workingCanvas = document.createElement("canvas"); workingCanvas.width = state.imageWidth; workingCanvas.height = state.imageHeight;
  const workingCtx = workingCanvas.getContext("2d"); workingCtx.drawImage(state.originalImage, 0, 0);
  const imageData = workingCtx.getImageData(0, 0, state.imageWidth, state.imageHeight);
  if (state.transparencyMode === "white") removeWhiteBackground(imageData, state.transparencyThreshold);
  if (state.transparencyMode === "checker") removeCheckerBackground(imageData, state.transparencyThreshold);
  if (state.transparencyMode === "target") removeTargetColor(imageData, state.targetColor, state.transparencyThreshold);
  workingCtx.putImageData(imageData, 0, 0);
  state.processedCanvas = workingCanvas; state.image = workingCanvas; state.hasTransparencyApplied = true;
  els.downloadTransparentButton.disabled = false;
  showMessage("info", "透過処理を適用しました。必要に応じて元画像に戻せます。");
  updatePreviewImage();
}

function restoreOriginalImage() {
  if (!state.originalImage) return;
  state.image = state.originalImage; state.processedCanvas = null; state.hasTransparencyApplied = false;
  els.downloadTransparentButton.disabled = true;
  showMessage("info", "元画像に戻しました。");
  updatePreviewImage();
}

function downloadTransparentPng() {
  if (!state.hasTransparencyApplied || !state.processedCanvas) return showMessage("error", "透過処理が未適用です。先に透過処理を適用してください。");
  const a = document.createElement("a"); a.download = "sprite-transparent.png"; a.href = state.processedCanvas.toDataURL("image/png"); a.click();
}

function drawFrame(i) {
  const maxSize = 360;
  if (!state.image || !state.frameWidth || !state.frameHeight) return drawEmpty();
  const scale = Math.min(maxSize / state.frameWidth, maxSize / state.frameHeight, 1);
  const w = Math.max(1, Math.floor(state.frameWidth * scale));
  const h = Math.max(1, Math.floor(state.frameHeight * scale));
  els.canvas.width = w; els.canvas.height = h;
  const { sx, sy, sw, sh } = getFrameRect(i);
  ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false; ctx.drawImage(state.image, sx, sy, sw, sh, 0, 0, w, h);
}

function drawSplitPreview() {
  const cw = els.splitPreviewCanvas.width, ch = els.splitPreviewCanvas.height;
  splitCtx.clearRect(0, 0, cw, ch);
  if (!state.image) {
    state.previewBounds = null;
    splitCtx.fillStyle = "#6b7280"; splitCtx.font = "16px sans-serif"; splitCtx.textAlign = "center";
    splitCtx.fillText("画像をアップロードすると分割プレビューが表示されます", cw / 2, ch / 2);
    return;
  }
  const scale = Math.min(cw / state.imageWidth, ch / state.imageHeight);
  const dw = state.imageWidth * scale, dh = state.imageHeight * scale;
  const ox = (cw - dw) / 2, oy = (ch - dh) / 2;
  state.previewBounds = { ox, oy, dw, dh, cellW: dw / state.columns, cellH: dh / state.rows };

  splitCtx.drawImage(state.image, 0, 0, state.imageWidth, state.imageHeight, ox, oy, dw, dh);
  splitCtx.strokeStyle = "rgba(255,255,255,0.8)"; splitCtx.lineWidth = 1;
  for (let c = 0; c <= state.columns; c++) { splitCtx.beginPath(); splitCtx.moveTo(ox + c * state.previewBounds.cellW, oy); splitCtx.lineTo(ox + c * state.previewBounds.cellW, oy + dh); splitCtx.stroke(); }
  for (let r = 0; r <= state.rows; r++) { splitCtx.beginPath(); splitCtx.moveTo(ox, oy + r * state.previewBounds.cellH); splitCtx.lineTo(ox + dw, oy + r * state.previewBounds.cellH); splitCtx.stroke(); }

  splitCtx.font = "11px sans-serif"; splitCtx.textAlign = "left";
  for (let i = 0; i < state.totalFrames; i++) {
    const rect = getFrameRect(i); const x = ox + rect.col * state.previewBounds.cellW + 4; const y = oy + rect.row * state.previewBounds.cellH + 13;
    splitCtx.fillStyle = "rgba(0,0,0,0.55)"; splitCtx.fillRect(x - 2, y - 10, 20, 12); splitCtx.fillStyle = "#fff"; splitCtx.fillText(String(i + 1), x, y);
  }

  const a = getFrameRect(state.currentFrame); const hx = ox + a.col * state.previewBounds.cellW; const hy = oy + a.row * state.previewBounds.cellH;
  splitCtx.fillStyle = "rgba(59,130,246,0.25)"; splitCtx.fillRect(hx, hy, state.previewBounds.cellW, state.previewBounds.cellH);
  splitCtx.strokeStyle = "#3b82f6"; splitCtx.lineWidth = 2; splitCtx.strokeRect(hx, hy, state.previewBounds.cellW, state.previewBounds.cellH);

}

function updateInfo(playbackFrames = getPlaybackFrames()) {
  const extra = state.playbackMode === "row" ? `行 ${state.targetRow}` : (state.playbackMode === "range" ? `${state.rangeStart}〜${state.rangeEnd}` : "-");
  const rows = [["画像サイズ", state.image ? `${state.imageWidth} x ${state.imageHeight}` : "未選択"], ["1コマサイズ", state.frameWidth ? `${state.frameWidth} x ${state.frameHeight}` : "-"], ["列数", String(state.columns)], ["行数", String(state.rows)], ["合計フレーム数", String(state.totalFrames)], ["現在フレーム", state.totalFrames ? `${state.currentFrame + 1} / ${state.totalFrames}` : "-"], ["再生モード", modeLabel[state.playbackMode]], ["モード詳細", extra], ["再生対象フレーム数", String(playbackFrames.length)], ["FPS", String(state.fps)], ["再生状態", state.isPlaying ? "再生中" : "停止中"]];
  els.info.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function syncCurrentToPlaybackRange(playbackFrames) { if (playbackFrames.length && !playbackFrames.includes(state.currentFrame)) state.currentFrame = playbackFrames[0]; }
function refresh() {
  calculateFrameSize();
  state.transparencyMode = els.transparencyMode.value; state.transparencyThreshold = Number(els.thresholdInput.value) || 0; state.targetColor = els.targetColorInput.value;
  els.thresholdValue.textContent = String(state.transparencyThreshold);
  els.targetColorWrap.classList.toggle("is-hidden", state.transparencyMode !== "target");
  els.checkerWarning.classList.toggle("is-hidden", state.transparencyMode !== "checker");
  els.rowModeFields.classList.toggle("is-hidden", state.playbackMode !== "row"); els.rangeModeFields.classList.toggle("is-hidden", state.playbackMode !== "range");
  const err = validate(); const playbackFrames = err ? [] : getPlaybackFrames();
  if (err) showMessage("error", err);
  else { const warn = (state.imageWidth % state.columns !== 0 || state.imageHeight % state.rows !== 0) ? "画像サイズが列数・行数で割り切れません。端のピクセルが切れる可能性があります。" : ""; showMessage(warn ? "info" : "", warn); syncCurrentToPlaybackRange(playbackFrames); }
  drawFrame(state.currentFrame); drawSplitPreview(); updateInfo(playbackFrames);
}

function moveFrame(step) {
  if (validate()) return;
  const frames = getPlaybackFrames(); if (!frames.length) return;
  let pos = Math.max(0, frames.indexOf(state.currentFrame)) + step;
  if (pos >= frames.length) { if (state.loop) pos = 0; else { stop(); pos = frames.length - 1; } }
  if (pos < 0) pos = state.loop ? frames.length - 1 : 0;
  state.currentFrame = frames[pos]; drawFrame(state.currentFrame); drawSplitPreview(); updateInfo(frames);
}

function tick(ts) { if (!state.isPlaying) return; const interval = 1000 / state.fps; if (!state.lastTick) state.lastTick = ts; if (ts - state.lastTick >= interval) { moveFrame(1); state.lastTick = ts; } state.rafId = requestAnimationFrame(tick); }
function play() { refresh(); if (validate()) return; if (state.isPlaying) return; state.isPlaying = true; state.lastTick = 0; state.rafId = requestAnimationFrame(tick); }
function stop() { state.isPlaying = false; cancelAnimationFrame(state.rafId); updateInfo(getPlaybackFrames()); }
function resetFrame() { const frames = getPlaybackFrames(); if (!frames.length) return; state.currentFrame = frames[0]; drawFrame(state.currentFrame); drawSplitPreview(); updateInfo(frames); }

function handleSplitPreviewClick(event) {
  if (!state.image || !state.previewBounds) return;
  const rect = els.splitPreviewCanvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (els.splitPreviewCanvas.width / rect.width);
  const y = (event.clientY - rect.top) * (els.splitPreviewCanvas.height / rect.height);
  const b = state.previewBounds;
  if (x < b.ox || x > b.ox + b.dw || y < b.oy || y > b.oy + b.dh) return;
  const col = Math.min(state.columns - 1, Math.max(0, Math.floor((x - b.ox) / b.cellW)));
  const row = Math.min(state.rows - 1, Math.max(0, Math.floor((y - b.oy) / b.cellH)));
  const clickedFrame = row * state.columns + col;
  const frames = getPlaybackFrames();
  if (!frames.includes(clickedFrame)) { showMessage("info", "現在の再生モード範囲外のフレームです。再生モードを変更するか範囲を見直してください。"); return; }
  stop();
  state.currentFrame = clickedFrame;
  drawFrame(state.currentFrame); drawSplitPreview(); updateInfo(frames);
}


function loadImageFromPath(path) {
  if (!path) return;
  if (state.imageUrl) { URL.revokeObjectURL(state.imageUrl); state.imageUrl = ""; }
  const img = new Image();
  img.onload = () => {
    state.originalImage = img; state.image = img; state.processedCanvas = null; state.hasTransparencyApplied = false;
    els.downloadTransparentButton.disabled = true;
    state.imageWidth = img.width; state.imageHeight = img.height; state.currentFrame = 0;
    refresh();
  };
  img.onerror = () => {
    showMessage("error", "サンプル画像の読み込みに失敗しました。");
  };
  img.src = path;
}

function handleImageUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { state.originalImage = img; state.image = img; state.processedCanvas = null; state.hasTransparencyApplied = false; els.downloadTransparentButton.disabled = true; state.imageWidth = img.width; state.imageHeight = img.height; state.currentFrame = 0; els.endFrameInput.value = String((Number(els.columnsInput.value) || 1) * (Number(els.rowsInput.value) || 1)); refresh(); };
  img.src = state.imageUrl;
}

function syncPresetWithFps() {
  const map = { 8: "8", 12: "12", 24: "24" };
  els.speedPreset.value = map[state.fps] || "8";
}

async function init() {
  els.spriteImage.addEventListener("change", handleImageUpload);
  [els.columnsInput, els.rowsInput, els.fpsInput, els.loopToggle, els.playbackMode, els.rowInput, els.startFrameInput, els.endFrameInput, els.transparencyMode, els.thresholdInput, els.targetColorInput].forEach((el) => el.addEventListener("input", refresh));
  els.speedPreset.addEventListener("change", () => { els.fpsInput.value = els.speedPreset.value; refresh(); });
  els.fpsInput.addEventListener("input", () => { calculateFrameSize(); syncPresetWithFps(); });
  els.bgSelect.addEventListener("change", () => { els.canvasWrap.className = `sprite-canvas-wrap ${els.bgSelect.value === "checker" ? "checkerboard" : `bg-${els.bgSelect.value}`}`; });
  els.splitPreviewCanvas.addEventListener("click", handleSplitPreviewClick);
  els.applyTransparencyButton.addEventListener("click", applyTransparency);
  els.restoreImageButton.addEventListener("click", restoreOriginalImage);
  els.downloadTransparentButton.addEventListener("click", downloadTransparentPng);
  els.sampleDataSelect.addEventListener("change", updateSamplePreview);
  els.applySampleDataButton.addEventListener("click", () => {
    const sample = getSelectedSampleData();
    if (!sample) { showMessage("error", "サンプル設定がありません。"); return; }
    els.columnsInput.value = String(sample.columns);
    els.rowsInput.value = String(sample.rows);
    els.fpsInput.value = String(sample.fps);
    els.loopToggle.checked = Boolean(sample.loop);
    els.playbackMode.value = sample.playbackMode;
    els.rowInput.value = String(sample.row);
    els.startFrameInput.value = String(sample.rangeStart);
    els.endFrameInput.value = String(sample.rangeEnd);
    els.bgSelect.value = sample.background;
    els.canvasWrap.className = `sprite-canvas-wrap ${sample.background === "checker" ? "checkerboard" : `bg-${sample.background}`}`;
    refresh();
    if (sample.imagePath) loadImageFromPath(sample.imagePath);
    showMessage("info", `サンプル「${sample.name}」を反映しました。${sample.imagePath ? "サンプル画像を読み込みました。" : "画像アップロード後にそのまま再生確認できます。"}`);
  });
  els.copySampleDataButton.addEventListener("click", async () => {
    const selectedSample = getSelectedSampleData();
    const sampleText = els.sampleDataPreview.value || (selectedSample ? formatSampleData(selectedSample) : "");
    if (!sampleText) { showMessage("error", "コピー対象のサンプルJSONがありません。"); return; }
    try {
      await navigator.clipboard.writeText(sampleText);
      showMessage("success", "サンプルJSONをクリップボードにコピーしました。");
    } catch (error) {
      showMessage("error", "コピーに失敗しました。手動でサンプルJSONを選択してコピーしてください。");
    }
  });
  els.playButton.addEventListener("click", play); els.stopButton.addEventListener("click", stop);
  els.nextButton.addEventListener("click", () => { stop(); moveFrame(1); }); els.prevButton.addEventListener("click", () => { stop(); moveFrame(-1); }); els.resetButton.addEventListener("click", () => { stop(); resetFrame(); });
  drawEmpty(); drawSplitPreview(); refresh();
  await loadSampleDataMap();
  updateSamplePreview();
}

init();
