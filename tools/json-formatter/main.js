const jsonInput = document.getElementById("jsonInput");
const jsonOutput = document.getElementById("jsonOutput");
const formatButton = document.getElementById("formatButton");
const copyButton = document.getElementById("copyButton");
const saveButton = document.getElementById("saveButton");
const sampleButton = document.getElementById("sampleButton");
const messageArea = document.getElementById("messageArea");

const sampleJson = {
  name: "sample",
  version: 1,
  enabled: true,
  items: [
    {
      id: 1,
      title: "apple"
    },
    {
      id: 2,
      title: "orange"
    }
  ],
  meta: {
    createdBy: "web-tools",
    note: "JSON formatter sample"
  }
};

/**
 * メッセージ表示
 * @param {"success"|"error"|"info"} type
 * @param {string} text
 */
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

/**
 * JSONを整形する
 */
function formatJson() {
  const inputText = jsonInput.value.trim();

  if (!inputText) {
    jsonOutput.textContent = "";
    showMessage("error", "JSONを入力してください。");
    return;
  }

  try {
    const parsedJson = JSON.parse(inputText);
    const formattedJson = JSON.stringify(parsedJson, null, 2);

    jsonOutput.textContent = formattedJson;
    showMessage("success", "JSONを整形しました。");
  } catch (error) {
    jsonOutput.textContent = "";
    showMessage("error", `JSONの形式が正しくありません。 ${error.message}`);
  }
}

/**
 * 整形結果をコピーする
 */
async function copyFormattedJson() {
  const outputText = jsonOutput.textContent;

  if (!outputText) {
    showMessage("error", "コピーする整形結果がありません。");
    return;
  }

  try {
    await navigator.clipboard.writeText(outputText);
    showMessage("success", "整形結果をコピーしました。");
  } catch (error) {
    try {
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = outputText;
      tempTextArea.style.position = "fixed";
      tempTextArea.style.left = "-9999px";
      document.body.appendChild(tempTextArea);

      tempTextArea.focus();
      tempTextArea.select();
      document.execCommand("copy");

      document.body.removeChild(tempTextArea);

      showMessage("success", "整形結果をコピーしました。");
    } catch (fallbackError) {
      showMessage("error", "コピーに失敗しました。");
    }
  }
}

/**
 * 整形済みJSONを保存する
 */
function saveFormattedJson() {
  let jsonToSave = jsonOutput.textContent.trim();

  if (!jsonToSave) {
    const inputText = jsonInput.value.trim();

    if (!inputText) {
      showMessage("error", "保存するJSONがありません。");
      return;
    }

    try {
      const parsedJson = JSON.parse(inputText);
      jsonToSave = JSON.stringify(parsedJson, null, 2);
      jsonOutput.textContent = jsonToSave;
    } catch (error) {
      showMessage("error", `JSONの形式が正しくありません。 ${error.message}`);
      return;
    }
  }

  const jsonBlob = new Blob([jsonToSave], { type: "application/json;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(jsonBlob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = `formatted-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);

  showMessage("success", "JSONファイルを保存しました。");
}

/**
 * サンプルJSONを入力する
 */
function insertSampleJson() {
  jsonInput.value = JSON.stringify(sampleJson);
  jsonOutput.textContent = "";
  showMessage("info", "サンプルJSONを入力しました。");
  jsonInput.focus();
}

/**
 * Tabキーでインデントしやすくする
 */
function handleTextareaKeydown(event) {
  if (event.key === "Tab") {
    event.preventDefault();

    const start = jsonInput.selectionStart;
    const end = jsonInput.selectionEnd;
    const currentValue = jsonInput.value;

    jsonInput.value =
      currentValue.substring(0, start) +
      "  " +
      currentValue.substring(end);

    jsonInput.selectionStart = jsonInput.selectionEnd = start + 2;
  }
}

/**
 * イベント設定
 */
formatButton.addEventListener("click", formatJson);
copyButton.addEventListener("click", copyFormattedJson);
saveButton.addEventListener("click", saveFormattedJson);
sampleButton.addEventListener("click", insertSampleJson);
jsonInput.addEventListener("keydown", handleTextareaKeydown);

/**
 * ショートカットキー
 * Ctrl+Enter / Cmd+Enter: 整形
 */
document.addEventListener("keydown", (event) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const isShortcutKey = isMac ? event.metaKey : event.ctrlKey;

  if (isShortcutKey && event.key === "Enter") {
    event.preventDefault();
    formatJson();
  }
});
