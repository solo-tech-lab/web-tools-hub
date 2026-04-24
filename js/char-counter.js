const textInput = document.getElementById("textInput");
const copyButton = document.getElementById("copyButton");
const clearButton = document.getElementById("clearButton");
const sampleButton = document.getElementById("sampleButton");
const removeSpacesButton = document.getElementById("removeSpacesButton");
const removeNewlinesButton = document.getElementById("removeNewlinesButton");
const removeSpacesNewlinesButton = document.getElementById("removeSpacesNewlinesButton");
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const whitespaceHighlightToggle = document.getElementById("whitespaceHighlightToggle");
const lineCountToggle = document.getElementById("lineCountToggle");
const whitespacePreview = document.getElementById("whitespacePreview");
const whitespacePreviewContent = document.getElementById("whitespacePreviewContent");
const lineCountPanel = document.getElementById("lineCountPanel");
const lineCountTableBody = document.getElementById("lineCountTableBody");
const messageArea = document.getElementById("messageArea");
const limitInput = document.getElementById("limitInput");
const presetButtons = document.querySelectorAll(".preset-button");
const limitStatus = document.getElementById("limitStatus");
const countModeButtons = document.querySelectorAll(".count-mode-button");
const countModeHint = document.getElementById("countModeHint");
const overflowPreview = document.getElementById("overflowPreview");
const overflowPreviewHint = document.getElementById("overflowPreviewHint");
const overflowPreviewContent = document.getElementById("overflowPreviewContent");
const tabList = document.getElementById("textTabList");
const addTabButton = document.getElementById("addTabButton");
const tabLimitNotice = document.getElementById("tabLimitNotice");

const charCount = document.getElementById("charCount");
const fullWidthCount = document.getElementById("fullWidthCount");
const halfWidthCount = document.getElementById("halfWidthCount");
const whitespaceCount = document.getElementById("whitespaceCount");
const noNewlineCount = document.getElementById("noNewlineCount");
const lineCount = document.getElementById("lineCount");

const sampleText = [
  "これは文字数カウントツールのサンプル文章です。",
  "改行を入れると、行数や1行ごとの文字数も確認できます。",
  "空白 　を少し多めに入れると、空白数の確認にも使えます。",
  "	この行は先頭にタブを入れています。",
  "文章の長さを調整しながら、上限シミュレーターや空白ハイライトの表示も試せます。",
].join("\n");

const COUNT_MODE_LABELS = {
  normal: "通常文字数",
  noSpace: "空白除外",
  noNewline: "改行除外",
  noSpaceNewline: "空白＋改行除外"
};

const MAX_TABS = 5;

let activeCountMode = "normal";
let isWhitespaceHighlightEnabled = false;
let isLineCountEnabled = false;
let tabs = [];
let activeTabId = "";
let tabSequence = 0;

function createTab() {
  tabSequence += 1;

  return {
    id: `tab-${Date.now()}-${tabSequence}`,
    title: `タブ${tabSequence}`,
    text: "",
    undoStack: [],
    redoStack: []
  };
}

function getCurrentTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

function showMessage(type, text) {
  messageArea.innerHTML = "";

  if (!text) {
    return;
  }

  const messageBox = document.createElement("div");
  messageBox.className = `message-box ${type}`;
  messageBox.textContent = text;
  messageArea.appendChild(messageBox);
}

function getNormalCharacterCount(text) {
  return text.length;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildWhitespacePreviewHtml(text) {
  if (!text) {
    return '<span class="whitespace-preview-empty">（入力テキストは空です）</span>';
  }

  let html = "";

  for (const char of text) {
    if (char === " ") {
      html += '<span class="whitespace-token whitespace-token-space" title="半角スペース">·</span>';
      continue;
    }

    if (char === "　") {
      html += '<span class="whitespace-token whitespace-token-full" title="全角スペース">□</span>';
      continue;
    }

    if (char === "\t") {
      html += '<span class="whitespace-token whitespace-token-tab" title="タブ">⇥</span>';
      continue;
    }

    html += escapeHtml(char);
  }

  return html;
}

function updateWhitespacePreview(text) {
  whitespaceHighlightToggle.classList.toggle("is-active", isWhitespaceHighlightEnabled);
  whitespaceHighlightToggle.setAttribute("aria-pressed", String(isWhitespaceHighlightEnabled));
  whitespaceHighlightToggle.textContent = isWhitespaceHighlightEnabled
    ? "空白ハイライト ON"
    : "空白ハイライト OFF";

  if (!isWhitespaceHighlightEnabled) {
    whitespacePreview.hidden = true;
    whitespacePreviewContent.innerHTML = "";
    return;
  }

  whitespacePreview.hidden = false;
  whitespacePreviewContent.innerHTML = buildWhitespacePreviewHtml(text);
}

function toggleWhitespaceHighlight() {
  isWhitespaceHighlightEnabled = !isWhitespaceHighlightEnabled;
  updateUI();
}

function getLineCharacterRows(text) {
  if (text === "") {
    return [
      {
        lineNumber: 1,
        lineText: "",
        characterCount: 0
      }
    ];
  }

  const lines = text.split(/\r\n|\n|\r/);
  return lines.map((lineText, index) => ({
    lineNumber: index + 1,
    lineText,
    characterCount: getNormalCharacterCount(lineText)
  }));
}

function renderLineCharacterTable(rows) {
  lineCountTableBody.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const lineNumberCell = document.createElement("td");
    lineNumberCell.className = "line-count-col-number";
    lineNumberCell.textContent = String(row.lineNumber);

    const lineTextCell = document.createElement("td");
    lineTextCell.className = "line-count-col-text";
    lineTextCell.textContent = row.lineText;

    const charCountCell = document.createElement("td");
    charCountCell.className = "line-count-col-count";
    charCountCell.textContent = String(row.characterCount);

    tr.appendChild(lineNumberCell);
    tr.appendChild(lineTextCell);
    tr.appendChild(charCountCell);
    lineCountTableBody.appendChild(tr);
  });
}

function updateLineCharacterPanel(text) {
  lineCountToggle.classList.toggle("is-active", isLineCountEnabled);
  lineCountToggle.setAttribute("aria-pressed", String(isLineCountEnabled));
  lineCountToggle.textContent = isLineCountEnabled ? "行文字数 ON" : "行文字数 OFF";

  if (!isLineCountEnabled) {
    lineCountPanel.hidden = true;
    lineCountTableBody.innerHTML = "";
    return;
  }

  lineCountPanel.hidden = false;
  renderLineCharacterTable(getLineCharacterRows(text));
}

function toggleLineCharacterCount() {
  isLineCountEnabled = !isLineCountEnabled;
  updateUI();
}

function getNoSpaceCharacterCount(text) {
  return text.replace(/[ \t\u3000]/g, "").length;
}

function getNoNewlineCharacterCount(text) {
  return text.replace(/\r\n|\n|\r/g, "").length;
}

function getWhitespaceCount(text) {
  const matched = text.match(/[ \t\u3000]/g);
  return matched ? matched.length : 0;
}

function getNoSpaceNewlineCharacterCount(text) {
  return text.replace(/[ \t\u3000\r\n]/g, "").length;
}

function getFullHalfWidthCounts(text) {
  let fullWidth = 0;
  let halfWidth = 0;

  for (const char of text) {
    if (char === "\n" || char === "\r") {
      continue;
    }

    if (char.codePointAt(0) <= 0x007f) {
      halfWidth += 1;
    } else {
      fullWidth += 1;
    }
  }

  return { fullWidth, halfWidth };
}

function getCurrentModeCount(text, mode) {
  switch (mode) {
    case "noSpace":
      return getNoSpaceCharacterCount(text);
    case "noNewline":
      return getNoNewlineCharacterCount(text);
    case "noSpaceNewline":
      return getNoSpaceNewlineCharacterCount(text);
    default:
      return getNormalCharacterCount(text);
  }
}

function isCountableCharacter(char, mode) {
  if ((mode === "noSpace" || mode === "noSpaceNewline") && /[ \t\u3000]/.test(char)) {
    return false;
  }

  if ((mode === "noNewline" || mode === "noSpaceNewline") && (char === "\r" || char === "\n")) {
    return false;
  }

  return true;
}

function getOverflowStartIndex(text, limit, mode) {
  let counted = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (!isCountableCharacter(char, mode)) {
      continue;
    }

    counted += 1;

    if (counted > limit) {
      return index;
    }
  }

  return -1;
}

function buildOverflowPreviewHtml(text, overflowStartIndex) {
  const withinLimit = escapeHtml(text.slice(0, overflowStartIndex));
  const overflowed = escapeHtml(text.slice(overflowStartIndex));
  return `${withinLimit}<span class="overflow-preview-exceeded">${overflowed}</span>`;
}

function updateOverflowPreview(text, currentCount) {
  const limitValue = Number(limitInput.value);
  const isValidLimit = Number.isInteger(limitValue) && limitValue > 0;
  const shouldShowPreview = isValidLimit && text.length > 0 && currentCount > limitValue;

  if (!shouldShowPreview) {
    overflowPreview.hidden = true;
    overflowPreviewHint.textContent = "";
    overflowPreviewContent.innerHTML = "";
    return;
  }

  const overflowStartIndex = getOverflowStartIndex(text, limitValue, activeCountMode);

  if (overflowStartIndex < 0) {
    overflowPreview.hidden = true;
    overflowPreviewHint.textContent = "";
    overflowPreviewContent.innerHTML = "";
    return;
  }

  overflowPreview.hidden = false;
  overflowPreviewHint.textContent = `判定基準: ${COUNT_MODE_LABELS[activeCountMode]}`;
  overflowPreviewContent.innerHTML = buildOverflowPreviewHtml(text, overflowStartIndex);
}

function getTextStats(text) {
  const totalCharacters = getNormalCharacterCount(text);
  const whitespace = getWhitespaceCount(text);
  const withoutNewline = getNoNewlineCharacterCount(text);
  const lines = text === "" ? 0 : text.split(/\r\n|\n|\r/).length;
  const { fullWidth, halfWidth } = getFullHalfWidthCounts(text);

  return {
    totalCharacters,
    fullWidth,
    halfWidth,
    whitespace,
    withoutNewline,
    lines
  };
}

function updateLimitStatus(currentCount) {
  const limitValue = Number(limitInput.value);

  if (!Number.isInteger(limitValue) || limitValue <= 0) {
    limitStatus.className = "limit-status info";
    limitStatus.textContent = "制限文字数を入力すると判定を表示します。";
    return;
  }

  if (currentCount <= limitValue) {
    const remaining = limitValue - currentCount;
    limitStatus.className = "limit-status success";
    limitStatus.textContent = `現在 ${currentCount} 文字 / 制限 ${limitValue} 文字（残り ${remaining} 文字）`;
    return;
  }

  const exceeded = currentCount - limitValue;
  limitStatus.className = "limit-status error";
  limitStatus.textContent = `現在 ${currentCount} 文字 / 制限 ${limitValue} 文字（${exceeded} 文字オーバー）`;
}

function updateUndoRedoButtons() {
  const currentTab = getCurrentTab();
  const undoStack = currentTab ? currentTab.undoStack : [];
  const redoStack = currentTab ? currentTab.redoStack : [];

  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function updateTabLimitState() {
  const reachedLimit = tabs.length >= MAX_TABS;
  addTabButton.disabled = reachedLimit;
  tabLimitNotice.hidden = !reachedLimit;
}

function renderTabBar() {
  const selectedTabId = activeTabId;
  tabList.innerHTML = "";

  tabs.forEach((tab) => {
    const item = document.createElement("li");
    item.className = "tab-item";

    const tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.className = "text-tab";
    const isActive = tab.id === selectedTabId;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-pressed", String(isActive));
    tabButton.textContent = tab.title;
    tabButton.addEventListener("click", () => selectTab(tab.id));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "text-tab-remove";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `${tab.title}を削除`);
    removeButton.disabled = tabs.length === 1;
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeTab(tab.id);
    });

    item.appendChild(tabButton);
    item.appendChild(removeButton);
    tabList.appendChild(item);
  });

  updateTabLimitState();
}

function syncTextareaFromCurrentTab() {
  const currentTab = getCurrentTab();
  textInput.value = currentTab ? currentTab.text : "";
}

function syncCurrentTabFromTextarea() {
  const currentTab = getCurrentTab();

  if (!currentTab) {
    return;
  }

  currentTab.text = textInput.value;
}

function updateUI() {
  const currentTab = getCurrentTab();
  const text = currentTab ? currentTab.text : "";
  const stats = getTextStats(text);
  const modeCount = getCurrentModeCount(text, activeCountMode);

  charCount.textContent = String(stats.totalCharacters);
  fullWidthCount.textContent = String(stats.fullWidth);
  halfWidthCount.textContent = String(stats.halfWidth);
  whitespaceCount.textContent = String(stats.whitespace);
  noNewlineCount.textContent = String(stats.withoutNewline);
  lineCount.textContent = String(stats.lines);
  countModeHint.textContent = `判定基準: ${COUNT_MODE_LABELS[activeCountMode]}`;

  updateLimitStatus(modeCount);
  updateOverflowPreview(text, modeCount);
  updateUndoRedoButtons();
  updateWhitespacePreview(text);
  updateLineCharacterPanel(text);
  renderTabBar();
}

function setTextAndRefresh(nextText) {
  const currentTab = getCurrentTab();

  if (!currentTab) {
    return;
  }

  currentTab.text = nextText;
  textInput.value = nextText;
  updateUI();
}

function saveUndoState(currentText) {
  const currentTab = getCurrentTab();

  if (!currentTab) {
    return;
  }

  currentTab.undoStack.push(currentText);
  currentTab.redoStack.length = 0;
  updateUndoRedoButtons();
}

function applyTextChange(nextText, message) {
  const currentTab = getCurrentTab();

  if (!currentTab) {
    return;
  }

  const currentText = currentTab.text;

  if (currentText === nextText) {
    showMessage("info", "変更対象がありませんでした。");
    return;
  }

  saveUndoState(currentText);
  setTextAndRefresh(nextText);

  if (message) {
    showMessage("info", message);
  }

  textInput.focus();
}

function removeSpaces(text) {
  return text.replace(/[ \t\u3000]/g, "");
}

function removeNewlines(text) {
  return text.replace(/\r\n|\n|\r/g, "");
}

function removeSpacesAndNewlines(text) {
  return text.replace(/[ \t\u3000\r\n]/g, "");
}

function undoTextChange() {
  const currentTab = getCurrentTab();

  if (!currentTab || currentTab.undoStack.length === 0) {
    return;
  }

  const currentText = currentTab.text;
  const previousText = currentTab.undoStack.pop();
  currentTab.redoStack.push(currentText);
  setTextAndRefresh(previousText);
  showMessage("info", "1つ前の状態に戻しました。");
  textInput.focus();
}

function redoTextChange() {
  const currentTab = getCurrentTab();

  if (!currentTab || currentTab.redoStack.length === 0) {
    return;
  }

  const currentText = currentTab.text;
  const nextText = currentTab.redoStack.pop();
  currentTab.undoStack.push(currentText);
  setTextAndRefresh(nextText);
  showMessage("info", "1つ後の状態に進みました。");
  textInput.focus();
}

async function copyInputText() {
  const currentTab = getCurrentTab();
  const text = currentTab ? currentTab.text : "";

  if (!text) {
    showMessage("error", "コピーするテキストがありません。");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showMessage("success", "入力テキストをコピーしました。");
  } catch (error) {
    try {
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = text;
      tempTextArea.style.position = "fixed";
      tempTextArea.style.left = "-9999px";
      document.body.appendChild(tempTextArea);

      tempTextArea.focus();
      tempTextArea.select();
      document.execCommand("copy");

      document.body.removeChild(tempTextArea);
      showMessage("success", "入力テキストをコピーしました。");
    } catch (fallbackError) {
      showMessage("error", "コピーに失敗しました。");
    }
  }
}

function clearText() {
  applyTextChange("", "入力内容をクリアしました。");
  limitInput.value = "";
  updateUI();
}

function insertSampleText() {
  applyTextChange(sampleText, "サンプルテキストを入力しました。");
}

function handleRemoveSpaces() {
  const currentTab = getCurrentTab();
  applyTextChange(removeSpaces(currentTab ? currentTab.text : ""), "空白を削除しました。");
}

function handleRemoveNewlines() {
  const currentTab = getCurrentTab();
  applyTextChange(removeNewlines(currentTab ? currentTab.text : ""), "改行を削除しました。");
}

function handleRemoveSpacesNewlines() {
  const currentTab = getCurrentTab();
  applyTextChange(removeSpacesAndNewlines(currentTab ? currentTab.text : ""), "空白と改行を削除しました。");
}

function applyPresetLimit(event) {
  const button = event.currentTarget;
  const limit = button.dataset.limit;

  limitInput.value = limit;
  updateUI();
  limitInput.focus();
}

function switchCountMode(event) {
  const button = event.currentTarget;
  const mode = button.dataset.countMode;

  if (!mode || mode === activeCountMode) {
    return;
  }

  activeCountMode = mode;
  countModeButtons.forEach((item) => {
    const isActive = item.dataset.countMode === activeCountMode;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-checked", String(isActive));
  });

  updateUI();
}

function selectTab(tabId) {
  if (tabId === activeTabId) {
    return;
  }

  activeTabId = tabId;
  syncTextareaFromCurrentTab();
  showMessage("", "");
  updateUI();
}

function addTab() {
  if (tabs.length >= MAX_TABS) {
    updateTabLimitState();
    showMessage("info", "タブは最大5件まで追加できます。");
    return;
  }

  const newTab = createTab();
  tabs.push(newTab);
  activeTabId = newTab.id;
  syncTextareaFromCurrentTab();
  showMessage("info", `${newTab.title}を追加しました。`);
  updateUI();
}

function removeTab(tabId) {
  if (tabs.length === 1) {
    return;
  }

  const removedIndex = tabs.findIndex((tab) => tab.id === tabId);

  if (removedIndex < 0) {
    return;
  }

  const removedTab = tabs[removedIndex];
  const removedWasActive = tabId === activeTabId;

  tabs.splice(removedIndex, 1);

  if (removedWasActive) {
    const nextTab = tabs[removedIndex] || tabs[removedIndex - 1] || tabs[0];
    activeTabId = nextTab.id;
  }

  syncTextareaFromCurrentTab();
  showMessage("info", `${removedTab.title}を削除しました。`);
  updateUI();
}

function initializeTabs() {
  const initialTab = createTab();
  tabs = [initialTab];
  activeTabId = initialTab.id;
  syncTextareaFromCurrentTab();
}

function handleTextInput() {
  syncCurrentTabFromTextarea();
  updateUI();
}

textInput.addEventListener("input", handleTextInput);
limitInput.addEventListener("input", updateUI);
copyButton.addEventListener("click", copyInputText);
clearButton.addEventListener("click", clearText);
sampleButton.addEventListener("click", insertSampleText);
removeSpacesButton.addEventListener("click", handleRemoveSpaces);
removeNewlinesButton.addEventListener("click", handleRemoveNewlines);
removeSpacesNewlinesButton.addEventListener("click", handleRemoveSpacesNewlines);
undoButton.addEventListener("click", undoTextChange);
redoButton.addEventListener("click", redoTextChange);
whitespaceHighlightToggle.addEventListener("click", toggleWhitespaceHighlight);
lineCountToggle.addEventListener("click", toggleLineCharacterCount);
addTabButton.addEventListener("click", addTab);
presetButtons.forEach((button) => button.addEventListener("click", applyPresetLimit));
countModeButtons.forEach((button) => button.addEventListener("click", switchCountMode));

initializeTabs();
updateUI();
