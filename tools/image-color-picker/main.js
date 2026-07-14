(() => {
  const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const ACCEPTED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
  const MAX_HISTORY_ITEMS = 8;
  const MAGNIFIER_SOURCE_SIZE = 15;
  const MAGNIFIER_SCALE = 10;
  const MAGNIFIER_SIZE = MAGNIFIER_SOURCE_SIZE * MAGNIFIER_SCALE;
  const MAGNIFIER_OFFSET = 20;
  const VIEWPORT_MARGIN = 12;
  const COPY_FEEDBACK_DURATION = 1800;

  const state = {
    imageLoaded: false,
    canvasDrawn: false,
    sampledColor: null,
    selectedColor: createColor(0, 0, 0, 255),
    colorHistory: [],
    loadId: 0,
    dragDepth: 0,
  };

  const elements = {
    fileInput: document.getElementById("imageFileInput"),
    dropZone: document.getElementById("dropZone"),
    sampleButtons: [...document.querySelectorAll("[data-sample-path]")],
    selectedFileName: document.getElementById("selectedFileName"),
    canvasShell: document.getElementById("canvasShell"),
    canvasEmptyState: document.getElementById("canvasEmptyState"),
    canvasStage: document.getElementById("canvasStage"),
    imageCanvas: document.getElementById("imageCanvas"),
    magnifierCanvas: document.getElementById("magnifierCanvas"),
    colorPreview: document.getElementById("colorPreview"),
    colorPreviewLabel: document.getElementById("colorPreviewLabel"),
    hexValue: document.getElementById("hexValue"),
    rgbValue: document.getElementById("rgbValue"),
    rgbaValue: document.getElementById("rgbaValue"),
    hslValue: document.getElementById("hslValue"),
    nativeColorInput: document.getElementById("nativeColorInput"),
    colorControls: {
      r: {
        range: document.getElementById("redRange"),
        number: document.getElementById("redNumber"),
      },
      g: {
        range: document.getElementById("greenRange"),
        number: document.getElementById("greenNumber"),
      },
      b: {
        range: document.getElementById("blueRange"),
        number: document.getElementById("blueNumber"),
      },
      a: {
        range: document.getElementById("alphaRange"),
        number: document.getElementById("alphaNumber"),
      },
    },
    addHistoryButton: document.getElementById("addHistoryButton"),
    restoreSampledColorButton: document.getElementById("restoreSampledColorButton"),
    copyButtons: [...document.querySelectorAll("[data-copy-format]")],
    history: document.getElementById("colorHistory"),
    historyEmptyState: document.getElementById("historyEmptyState"),
    chooseAnotherButton: document.getElementById("chooseAnotherButton"),
    removeImageButton: document.getElementById("removeImageButton"),
    messageArea: document.getElementById("messageArea"),
    messageBox: document.getElementById("messageBox"),
  };

  const imageContext = elements.imageCanvas.getContext("2d", { willReadFrequently: true });
  const magnifierContext = elements.magnifierCanvas.getContext("2d");
  const copyFeedbackTimers = new Map();

  // RGB値を再利用しやすいHEX文字列へ変換する。
  function rgbToHex(red, green, blue) {
    const toHex = (value) => value.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
  }

  // RGB値をHSLへ変換し、画面表示に適した整数へ丸める。
  function rgbToHsl(red, green, blue) {
    const normalizedRed = red / 255;
    const normalizedGreen = green / 255;
    const normalizedBlue = blue / 255;
    const maximum = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
    const minimum = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
    const lightness = (maximum + minimum) / 2;
    const difference = maximum - minimum;
    let hue = 0;
    let saturation = 0;

    if (difference !== 0) {
      saturation = difference / (1 - Math.abs(2 * lightness - 1));

      if (maximum === normalizedRed) {
        hue = 60 * (((normalizedGreen - normalizedBlue) / difference) % 6);
      } else if (maximum === normalizedGreen) {
        hue = 60 * ((normalizedBlue - normalizedRed) / difference + 2);
      } else {
        hue = 60 * ((normalizedRed - normalizedGreen) / difference + 4);
      }
    }

    if (hue < 0) {
      hue += 360;
    }

    return {
      h: Math.round(hue),
      s: Math.round(saturation * 100),
      l: Math.round(lightness * 100),
    };
  }

  function formatAlpha(alphaByte) {
    return Number((alphaByte / 255).toFixed(3)).toString();
  }

  function normalizeRgbValue(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    return Math.min(255, Math.max(0, Math.round(numericValue)));
  }

  function createColor(red, green, blue, alphaByte) {
    const normalizedRed = normalizeRgbValue(red);
    const normalizedGreen = normalizeRgbValue(green);
    const normalizedBlue = normalizeRgbValue(blue);
    const normalizedAlpha = normalizeRgbValue(alphaByte);
    const alpha = formatAlpha(normalizedAlpha);
    const hsl = rgbToHsl(normalizedRed, normalizedGreen, normalizedBlue);

    return {
      r: normalizedRed,
      g: normalizedGreen,
      b: normalizedBlue,
      a: normalizedAlpha,
      alpha,
      key: `${normalizedRed},${normalizedGreen},${normalizedBlue},${normalizedAlpha}`,
      hex: rgbToHex(normalizedRed, normalizedGreen, normalizedBlue),
      rgb: `rgb(${normalizedRed}, ${normalizedGreen}, ${normalizedBlue})`,
      rgba: `rgba(${normalizedRed}, ${normalizedGreen}, ${normalizedBlue}, ${alpha})`,
      hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    };
  }

  function showMessage(type, text) {
    elements.messageBox.className = `message-box ${type}`;
    elements.messageBox.textContent = text;
    elements.messageBox.setAttribute("role", type === "error" ? "alert" : "status");
    elements.messageBox.hidden = false;
  }

  function clearMessage() {
    elements.messageBox.hidden = true;
    elements.messageBox.textContent = "";
    elements.messageBox.removeAttribute("role");
    elements.messageBox.className = "message-box";
  }

  function isSupportedImage(file) {
    const mimeType = file.type.toLowerCase();
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    return ACCEPTED_MIME_TYPES.has(mimeType) || (!mimeType && ACCEPTED_EXTENSIONS.has(extension));
  }

  function resetCopyFeedback() {
    copyFeedbackTimers.forEach((timerId, button) => {
      window.clearTimeout(timerId);
      button.textContent = "コピー";
    });
    copyFeedbackTimers.clear();
  }

  function setCopyButtonFeedback(button) {
    const activeTimer = copyFeedbackTimers.get(button);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
    }

    button.textContent = "コピーしました";
    const timerId = window.setTimeout(() => {
      button.textContent = "コピー";
      copyFeedbackTimers.delete(button);
    }, COPY_FEEDBACK_DURATION);
    copyFeedbackTimers.set(button, timerId);
  }

  function syncColorControls(color) {
    Object.entries(elements.colorControls).forEach(([channel, controls]) => {
      controls.range.value = String(color[channel]);
      controls.number.value = String(color[channel]);
    });
    elements.nativeColorInput.value = color.hex.toLowerCase();
  }

  function updateColorDisplay() {
    const color = state.selectedColor || createColor(0, 0, 0, 255);
    const values = {
      hex: elements.hexValue,
      rgb: elements.rgbValue,
      rgba: elements.rgbaValue,
      hsl: elements.hslValue,
    };

    Object.entries(values).forEach(([format, output]) => {
      output.textContent = color[format];
    });

    elements.copyButtons.forEach((button) => {
      button.disabled = false;
    });

    elements.colorPreview.style.backgroundColor = color.rgba;
    elements.colorPreviewLabel.textContent = `${color.hex} / Alpha ${color.alpha}`;
    elements.colorPreview.setAttribute("aria-label", `選択色 ${color.hex}、${color.rgba}`);
    elements.restoreSampledColorButton.disabled = !state.sampledColor;
    syncColorControls(color);
  }

  function renderHistory() {
    const fragment = document.createDocumentFragment();

    state.colorHistory.forEach((color) => {
      const button = document.createElement("button");
      const label = document.createElement("span");
      button.className = "history-color-button";
      button.type = "button";
      button.style.setProperty("--history-color", color.rgba);
      button.title = `${color.hex} / ${color.rgba}`;
      button.setAttribute("aria-label", `${color.hex}、${color.rgba}を再選択`);
      label.textContent = color.a === 255 ? color.hex : `${color.hex} / ${color.alpha}`;
      button.append(label);
      button.addEventListener("click", () => {
        applySelectedColor(color, { addToHistory: true });
        showMessage("info", `${color.hex}を履歴から再選択しました。`);
      });
      fragment.append(button);
    });

    elements.history.replaceChildren(fragment);
    elements.historyEmptyState.hidden = state.colorHistory.length > 0;
  }

  function updateHistory(color) {
    state.colorHistory = [
      color,
      ...state.colorHistory.filter((historyColor) => historyColor.key !== color.key),
    ].slice(0, MAX_HISTORY_ITEMS);
    renderHistory();
  }

  // 選択色の状態・表示・全入力を一度に同期し、必要な場合だけ履歴や取得元を更新する。
  function applySelectedColor(color, options = {}) {
    const numericAlpha = Number(color.a);
    const alphaByte = Number.isFinite(numericAlpha) ? numericAlpha : 255;
    const nextColor = createColor(color.r, color.g, color.b, alphaByte);
    state.selectedColor = nextColor;

    if (options.updateSampledColor) {
      state.sampledColor = nextColor;
    }

    updateColorDisplay();

    if (options.addToHistory) {
      updateHistory(nextColor);
    }
  }

  function resetSelection() {
    state.sampledColor = null;
    state.selectedColor = createColor(0, 0, 0, 255);
    state.colorHistory = [];
    resetCopyFeedback();
    updateColorDisplay();
    renderHistory();
  }

  function updateColorChannel(channel, value) {
    const currentColor = state.selectedColor || createColor(0, 0, 0, 255);
    applySelectedColor({
      r: channel === "r" ? value : currentColor.r,
      g: channel === "g" ? value : currentColor.g,
      b: channel === "b" ? value : currentColor.b,
      a: channel === "a" ? value : currentColor.a,
    });
  }

  function handleColorNumberInput(channel, input) {
    if (input.value.trim() === "") {
      return;
    }

    const numericValue = Number(input.value);
    if (Number.isFinite(numericValue)) {
      updateColorChannel(channel, numericValue);
    }
  }

  function normalizeColorNumberInput(channel, input) {
    const currentColor = state.selectedColor || createColor(0, 0, 0, 255);
    const numericValue = input.value.trim() === "" ? Number.NaN : Number(input.value);
    const normalizedValue = Number.isFinite(numericValue)
      ? normalizeRgbValue(numericValue)
      : currentColor[channel];
    updateColorChannel(channel, normalizedValue);
  }

  function handleNativeColorInput() {
    const match = /^#([0-9a-f]{6})$/i.exec(elements.nativeColorInput.value);
    if (!match) {
      syncColorControls(state.selectedColor || createColor(0, 0, 0, 255));
      return;
    }

    const hex = match[1];
    const currentColor = state.selectedColor || createColor(0, 0, 0, 255);
    applySelectedColor({
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: currentColor.a,
    });
  }

  function addSelectedColorToHistory() {
    if (!state.selectedColor) {
      return;
    }
    updateHistory(state.selectedColor);
    showMessage("success", `${state.selectedColor.hex}を履歴に追加しました。`);
  }

  function restoreSampledColor() {
    if (!state.sampledColor) {
      return;
    }
    applySelectedColor(state.sampledColor);
    showMessage("info", `${state.sampledColor.hex}の元の取得色に戻しました。`);
  }

  function hideMagnifier() {
    elements.magnifierCanvas.hidden = true;
  }

  // CSS表示サイズとCanvas内部サイズの比率から、原画像上のピクセル座標を求める。
  function getCanvasPoint(event) {
    const rect = elements.imageCanvas.getBoundingClientRect();
    if (
      rect.width <= 0
      || rect.height <= 0
      || elements.imageCanvas.width <= 0
      || elements.imageCanvas.height <= 0
      || !Number.isFinite(event.clientX)
      || !Number.isFinite(event.clientY)
    ) {
      return null;
    }

    const scaleX = elements.imageCanvas.width / rect.width;
    const scaleY = elements.imageCanvas.height / rect.height;
    const scaledX = (event.clientX - rect.left) * scaleX;
    const scaledY = (event.clientY - rect.top) * scaleY;

    if (!Number.isFinite(scaledX) || !Number.isFinite(scaledY)) {
      return null;
    }

    return {
      x: Math.min(elements.imageCanvas.width - 1, Math.max(0, Math.floor(scaledX))),
      y: Math.min(elements.imageCanvas.height - 1, Math.max(0, Math.floor(scaledY))),
    };
  }

  function positionMagnifier(clientX, clientY) {
    let left = clientX + MAGNIFIER_OFFSET;
    let top = clientY + MAGNIFIER_OFFSET;

    if (left + MAGNIFIER_SIZE > window.innerWidth - VIEWPORT_MARGIN) {
      left = clientX - MAGNIFIER_SIZE - MAGNIFIER_OFFSET;
    }
    if (top + MAGNIFIER_SIZE > window.innerHeight - VIEWPORT_MARGIN) {
      top = clientY - MAGNIFIER_SIZE - MAGNIFIER_OFFSET;
    }

    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - MAGNIFIER_SIZE - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - MAGNIFIER_SIZE - VIEWPORT_MARGIN);
    elements.magnifierCanvas.style.left = `${Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, left))}px`;
    elements.magnifierCanvas.style.top = `${Math.min(maxTop, Math.max(VIEWPORT_MARGIN, top))}px`;
  }

  // 画像端では透明な余白を残し、選択ピクセルが常にルーペ中央へ来るよう描画する。
  function drawMagnifier(point, clientX, clientY) {
    if (!magnifierContext) {
      return;
    }

    const halfSource = Math.floor(MAGNIFIER_SOURCE_SIZE / 2);
    const requestedX = point.x - halfSource;
    const requestedY = point.y - halfSource;
    const sourceX = Math.max(0, requestedX);
    const sourceY = Math.max(0, requestedY);
    const sourceWidth = Math.min(MAGNIFIER_SOURCE_SIZE - (sourceX - requestedX), elements.imageCanvas.width - sourceX);
    const sourceHeight = Math.min(MAGNIFIER_SOURCE_SIZE - (sourceY - requestedY), elements.imageCanvas.height - sourceY);
    const destinationX = (sourceX - requestedX) * MAGNIFIER_SCALE;
    const destinationY = (sourceY - requestedY) * MAGNIFIER_SCALE;
    const center = halfSource * MAGNIFIER_SCALE;

    magnifierContext.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    magnifierContext.imageSmoothingEnabled = false;
    magnifierContext.drawImage(
      elements.imageCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destinationX,
      destinationY,
      sourceWidth * MAGNIFIER_SCALE,
      sourceHeight * MAGNIFIER_SCALE,
    );

    magnifierContext.strokeStyle = "rgba(0, 0, 0, 0.9)";
    magnifierContext.lineWidth = 3;
    magnifierContext.strokeRect(center + 0.5, center + 0.5, MAGNIFIER_SCALE - 1, MAGNIFIER_SCALE - 1);
    magnifierContext.strokeStyle = "#ffffff";
    magnifierContext.lineWidth = 1;
    magnifierContext.strokeRect(center + 0.5, center + 0.5, MAGNIFIER_SCALE - 1, MAGNIFIER_SCALE - 1);

    positionMagnifier(clientX, clientY);
    elements.magnifierCanvas.hidden = false;
  }

  function handleCanvasPointerMove(event) {
    if (event.pointerType === "touch") {
      hideMagnifier();
      return;
    }

    const point = getCanvasPoint(event);
    if (point) {
      try {
        drawMagnifier(point, event.clientX, event.clientY);
      } catch (error) {
        hideMagnifier();
      }
    }
  }

  function getSamplingErrorMessage(error) {
    if (error && error.name === "SecurityError") {
      return "この画像はブラウザのセキュリティ制限により色を取得できません。";
    }
    if (error && error.name === "IndexSizeError") {
      return "色を取得する位置を確認できませんでした。画像内をもう一度選択してください。";
    }
    if (error && error.name === "InvalidStateError") {
      return "画像の読み込みが完了していません。画像を読み込み直してください。";
    }
    return "色の取得中にエラーが発生しました。画像を読み込み直してお試しください。";
  }

  function handleCanvasPointerUp(event) {
    if (!state.imageLoaded || !state.canvasDrawn || !imageContext) {
      showMessage("error", "画像の読み込みが完了していません。画像を読み込み直してください。");
      return;
    }

    if (elements.imageCanvas.width <= 0 || elements.imageCanvas.height <= 0) {
      showMessage("error", "画像の表示状態が正しくありません。画像を読み込み直してください。");
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) {
      showMessage("error", "色を取得する位置を確認できませんでした。");
      return;
    }

    let pixel;
    try {
      pixel = imageContext.getImageData(point.x, point.y, 1, 1).data;
    } catch (error) {
      showMessage("error", getSamplingErrorMessage(error));
      return;
    }

    const color = createColor(pixel[0], pixel[1], pixel[2], pixel[3]);
    applySelectedColor(color, { addToHistory: true, updateSampledColor: true });
    showMessage("success", `${color.hex}を取得しました（X: ${point.x}, Y: ${point.y}）。`);

    if (event.pointerType === "touch") {
      hideMagnifier();
    }
  }

  function updateImageControls() {
    elements.chooseAnotherButton.disabled = !state.imageLoaded;
    elements.removeImageButton.disabled = !state.imageLoaded;
  }

  function clearImageCanvas() {
    state.canvasDrawn = false;
    if (imageContext) {
      imageContext.clearRect(0, 0, elements.imageCanvas.width, elements.imageCanvas.height);
    }
    elements.imageCanvas.width = 1;
    elements.imageCanvas.height = 1;
    elements.canvasStage.hidden = true;
    elements.canvasEmptyState.hidden = false;
  }

  function removeImage(options = {}) {
    state.loadId += 1;
    state.imageLoaded = false;
    state.canvasDrawn = false;
    state.dragDepth = 0;
    elements.fileInput.value = "";
    elements.selectedFileName.textContent = "未選択";
    elements.dropZone.classList.remove("is-dragging");
    clearImageCanvas();
    hideMagnifier();
    resetSelection();
    updateImageControls();

    if (!options.preserveMessage) {
      clearMessage();
    }
  }

  // ファイル画像とサンプル画像でCanvas描画と画面状態更新を共通化する。
  function renderLoadedImage(image, sourceName) {
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    if (!imageWidth || !imageHeight || !imageContext) {
      throw new Error("Invalid image dimensions or canvas context");
    }

    state.imageLoaded = false;
    state.canvasDrawn = false;
    elements.imageCanvas.width = imageWidth;
    elements.imageCanvas.height = imageHeight;
    imageContext.clearRect(0, 0, imageWidth, imageHeight);
    imageContext.drawImage(image, 0, 0, imageWidth, imageHeight);
    state.canvasDrawn = true;
    state.imageLoaded = true;
    elements.selectedFileName.textContent = sourceName;
    elements.canvasEmptyState.hidden = true;
    elements.canvasStage.hidden = false;
    resetSelection();
    updateImageControls();
    hideMagnifier();
  }

  function loadImageSource(source, sourceName, options = {}) {
    const currentLoadId = state.loadId + 1;
    state.loadId = currentLoadId;
    showMessage("info", `${sourceName}を読み込んでいます…`);

    const image = new Image();
    let sourceReleased = false;
    const releaseSource = () => {
      if (!sourceReleased && typeof options.releaseSource === "function") {
        sourceReleased = true;
        options.releaseSource();
      }
    };

    image.onload = () => {
      if (currentLoadId !== state.loadId) {
        releaseSource();
        return;
      }

      try {
        renderLoadedImage(image, sourceName);
        showMessage("success", `${sourceName}を読み込みました。画像内をクリックまたはタップしてください。`);
      } catch (error) {
        removeImage({ preserveMessage: true });
        showMessage("error", "画像をCanvasへ表示できませんでした。画像サイズを小さくしてお試しください。");
      } finally {
        releaseSource();
      }
    };

    image.onerror = () => {
      releaseSource();
      if (currentLoadId !== state.loadId) {
        return;
      }
      showMessage("error", options.errorMessage || "画像を読み込めませんでした。ファイルが破損していないか確認してください。");
    };

    image.src = source;
  }

  // Object URLは画像の読込成否が確定した時点で必ず解放する。
  function loadImageFile(file) {
    if (!file || !isSupportedImage(file)) {
      showMessage("error", "対応していないファイルです。PNG、JPEG、WebP画像を選択してください。");
      return;
    }

    let objectUrl;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (error) {
      showMessage("error", "画像の読み込みを開始できませんでした。別の画像をお試しください。");
      return;
    }

    loadImageSource(objectUrl, file.name, {
      releaseSource: () => URL.revokeObjectURL(objectUrl),
    });
  }

  function convertHsvToRgb(hue, saturation, value) {
    const chroma = value * saturation;
    const sector = hue / 60;
    const intermediate = chroma * (1 - Math.abs((sector % 2) - 1));
    const match = value - chroma;
    let red = 0;
    let green = 0;
    let blue = 0;

    if (sector < 1) [red, green, blue] = [chroma, intermediate, 0];
    else if (sector < 2) [red, green, blue] = [intermediate, chroma, 0];
    else if (sector < 3) [red, green, blue] = [0, chroma, intermediate];
    else if (sector < 4) [red, green, blue] = [0, intermediate, chroma];
    else if (sector < 5) [red, green, blue] = [intermediate, 0, chroma];
    else [red, green, blue] = [chroma, 0, intermediate];

    return [
      Math.round((red + match) * 255),
      Math.round((green + match) * 255),
      Math.round((blue + match) * 255),
    ];
  }

  // file://では相対画像がCanvasを汚染するため、同じ画素仕様を安全なCanvasへ生成する。
  function createLocalSampleCanvas(sampleKey) {
    const sampleCanvas = document.createElement("canvas");
    const context = sampleCanvas.getContext("2d");
    if (!context) {
      throw new Error("Sample canvas context is unavailable");
    }

    if (sampleKey === "palette") {
      const colors = [
        "#ef4444", "#f97316", "#facc15", "#84cc16",
        "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6",
        "#ec4899", "#ffffff", "#808080", "#000000",
      ];
      sampleCanvas.width = 720;
      sampleCanvas.height = 480;
      colors.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect((index % 4) * 180, Math.floor(index / 4) * 160, 180, 160);
      });
      return sampleCanvas;
    }

    if (sampleKey === "gradient") {
      sampleCanvas.width = 720;
      sampleCanvas.height = 480;
      const imageData = context.createImageData(sampleCanvas.width, sampleCanvas.height);
      for (let y = 0; y < sampleCanvas.height; y += 1) {
        const saturation = 0.92 - (y / 479) * 0.18;
        const value = 1 - (y / 479) * 0.88;
        for (let x = 0; x < sampleCanvas.width; x += 1) {
          const hue = (x / 719) * 359.999;
          const [red, green, blue] = convertHsvToRgb(hue, saturation, value);
          const offset = (y * sampleCanvas.width + x) * 4;
          imageData.data[offset] = red;
          imageData.data[offset + 1] = green;
          imageData.data[offset + 2] = blue;
          imageData.data[offset + 3] = 255;
        }
      }
      context.putImageData(imageData, 0, 0);
      return sampleCanvas;
    }

    if (sampleKey === "transparency") {
      const alphaLevels = [0, 64, 128, 191, 255];
      const colors = [[239, 68, 68], [34, 197, 94], [59, 130, 246]];
      sampleCanvas.width = 750;
      sampleCanvas.height = 360;
      const imageData = context.createImageData(sampleCanvas.width, sampleCanvas.height);
      for (let y = 0; y < sampleCanvas.height; y += 1) {
        const color = colors[Math.min(2, Math.floor(y / 120))];
        for (let x = 0; x < sampleCanvas.width; x += 1) {
          const offset = (y * sampleCanvas.width + x) * 4;
          imageData.data[offset] = color[0];
          imageData.data[offset + 1] = color[1];
          imageData.data[offset + 2] = color[2];
          imageData.data[offset + 3] = alphaLevels[Math.min(4, Math.floor(x / 150))];
        }
      }
      context.putImageData(imageData, 0, 0);
      return sampleCanvas;
    }

    throw new Error("Unknown sample image");
  }

  function loadLocalSampleImage(sampleKey, name) {
    const currentLoadId = state.loadId + 1;
    state.loadId = currentLoadId;
    const sourceName = `サンプル: ${name}`;
    showMessage("info", `${sourceName}を読み込んでいます…`);

    try {
      const sampleCanvas = createLocalSampleCanvas(sampleKey);
      if (currentLoadId !== state.loadId) {
        return;
      }
      renderLoadedImage(sampleCanvas, sourceName);
      showMessage("success", `${sourceName}を読み込みました。画像内をクリックまたはタップしてください。`);
    } catch (error) {
      removeImage({ preserveMessage: true });
      showMessage("error", "サンプル画像を準備できませんでした。ページを再読み込みしてお試しください。");
    }
  }

  function loadSampleImage(path, name, sampleKey) {
    if (!path || !name || !sampleKey) {
      showMessage("error", "サンプル画像の情報を確認できませんでした。");
      return;
    }

    if (window.location.protocol === "file:") {
      loadLocalSampleImage(sampleKey, name);
      return;
    }

    loadImageSource(path, `サンプル: ${name}`, {
      errorMessage: "サンプル画像を読み込めませんでした。ページを再読み込みしてお試しください。",
    });
  }

  function handleFileInput(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (file) {
      loadImageFile(file);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    state.dragDepth = 0;
    elements.dropZone.classList.remove("is-dragging");
    const file = event.dataTransfer && event.dataTransfer.files[0];

    if (!file) {
      showMessage("error", "ファイルを確認できませんでした。画像ファイルをドロップしてください。");
      return;
    }
    loadImageFile(file);
  }

  function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.append(textArea);
    textArea.select();

    let copied = false;
    try {
      copied = typeof document.execCommand === "function" && document.execCommand("copy");
    } finally {
      textArea.remove();
    }
    return copied;
  }

  async function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // 権限やHTTPS要件で失敗した場合は従来方式を試す。
      }
    }
    return fallbackCopyText(text);
  }

  async function handleCopyButton(event) {
    const button = event.currentTarget;
    const format = button.dataset.copyFormat;
    const color = state.selectedColor;

    if (!color || !color[format]) {
      showMessage("error", "先に画像から色を選択してください。");
      return;
    }

    try {
      const copied = await copyText(color[format]);
      if (!copied) {
        throw new Error("Clipboard unavailable");
      }
      setCopyButtonFeedback(button);
      showMessage("success", `${format.toUpperCase()}をコピーしました。`);
    } catch (error) {
      showMessage("error", "コピーに失敗しました。カラーコードを選択して手動でコピーしてください。");
    }
  }

  function initialize() {
    elements.fileInput.addEventListener("change", handleFileInput);
    elements.dropZone.addEventListener("click", () => elements.fileInput.click());
    elements.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.fileInput.click();
      }
    });
    elements.dropZone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      state.dragDepth += 1;
      elements.dropZone.classList.add("is-dragging");
    });
    elements.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    });
    elements.dropZone.addEventListener("dragleave", () => {
      state.dragDepth = Math.max(0, state.dragDepth - 1);
      if (state.dragDepth === 0) {
        elements.dropZone.classList.remove("is-dragging");
      }
    });
    elements.dropZone.addEventListener("drop", handleDrop);
    elements.sampleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        loadSampleImage(button.dataset.samplePath, button.dataset.sampleName, button.dataset.sampleKey);
      });
    });

    Object.entries(elements.colorControls).forEach(([channel, controls]) => {
      controls.range.addEventListener("input", () => updateColorChannel(channel, controls.range.value));
      controls.number.addEventListener("input", () => handleColorNumberInput(channel, controls.number));
      controls.number.addEventListener("change", () => normalizeColorNumberInput(channel, controls.number));
      controls.number.addEventListener("blur", () => normalizeColorNumberInput(channel, controls.number));
    });
    elements.nativeColorInput.addEventListener("input", handleNativeColorInput);
    elements.addHistoryButton.addEventListener("click", addSelectedColorToHistory);
    elements.restoreSampledColorButton.addEventListener("click", restoreSampledColor);

    elements.imageCanvas.addEventListener("pointermove", handleCanvasPointerMove);
    elements.imageCanvas.addEventListener("pointerup", handleCanvasPointerUp);
    elements.imageCanvas.addEventListener("pointerleave", hideMagnifier);
    elements.imageCanvas.addEventListener("pointercancel", hideMagnifier);
    elements.copyButtons.forEach((button) => button.addEventListener("click", handleCopyButton));
    elements.chooseAnotherButton.addEventListener("click", () => elements.fileInput.click());
    elements.removeImageButton.addEventListener("click", () => removeImage());
    window.addEventListener("scroll", hideMagnifier, { passive: true });
    window.addEventListener("blur", hideMagnifier);

    resetSelection();
    updateImageControls();
    if (!imageContext || !magnifierContext) {
      showMessage("error", "このブラウザではCanvasを利用できないため、ツールを使用できません。");
    }
  }

  initialize();
})();
