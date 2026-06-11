(() => {
  const MAX_CODE_POINT = 0x10ffff;
  const DEFAULT_FORMATS = {
    codeToChar: [{ value: "text", label: "文字" }],
    charToUnicode: [
      { value: "uPlus", label: "U+形式" },
      { value: "jsEscape", label: "JavaScriptエスケープ形式" },
      { value: "utf16", label: "JavaScript UTF-16形式" },
      { value: "htmlHex", label: "HTML 16進数文字参照" },
      { value: "htmlDec", label: "HTML 10進数文字参照" },
    ],
    decodeEscapes: [{ value: "text", label: "文字" }],
  };

  const MODE_HINTS = {
    codeToChar: "U+3042、3042、\\u3042、\\u{3042}、&#x3042;、&#12354; などを文字へ変換します。複数値は半角スペース・改行・カンマ・タブで区切れます。",
    charToUnicode: "入力文字を1文字ずつUnicode形式へ変換し、詳細テーブルへコードポイントとUTF-16表現を表示します。",
    decodeEscapes: "YAML、JSON、ログ、設定ファイルなどの文章構造を保持したまま、Unicodeエスケープだけを読める文字へ変換します。",
  };

  const PLACEHOLDERS = {
    codeToChar: "例: U+3042 U+3044 U+3046",
    charToUnicode: "例: あいう😀",
    decodeEscapes: "例:\ndisplayName: \"\\u3072\\u3088\\u3053\"\nmessage: \"\\u3053\\u3093\\u306B\\u3061\\u306F\\uFF01\"",
  };

  const SAMPLES = {
    code: { mode: "codeToChar", text: "U+3042 U+3044 U+3046" },
    escape: { mode: "codeToChar", text: "\\u3053\\u3093\\u306B\\u3061\\u306F" },
    yaml: {
      mode: "decodeEscapes",
      text: "displayName: \"\\u3072\\u3088\\u3053\"\nmessage: \"\\u3053\\u3093\\u306B\\u3061\\u306F\\uFF01\"\nid: 1\nguid: abcdef1234567890abcdef1234567890",
    },
    emoji: { mode: "charToUnicode", text: "😀🎮✨" },
  };

  const elements = {};
  let currentDetails = [];

  const getHex = (codePoint, minLength = 4) => codePoint.toString(16).toUpperCase().padStart(minLength, "0");
  const isValidCodePoint = (codePoint) => Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= MAX_CODE_POINT;

  const toUtf16Escape = (char) => Array.from(char)
    .join("")
    .split("")
    .map((unit) => `\\u${unit.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join("");

  const describeChar = (char) => {
    const codePoint = char.codePointAt(0);
    const hex = getHex(codePoint, codePoint > 0xffff ? 5 : 4);
    return {
      char,
      unicode: `U+${hex}`,
      hex,
      decimal: String(codePoint),
      utf16: toUtf16Escape(char),
    };
  };

  const formatChar = (char, format) => {
    const codePoint = char.codePointAt(0);
    const hex = getHex(codePoint, codePoint > 0xffff ? 5 : 4);

    switch (format) {
      case "uPlus":
        return `U+${hex}`;
      case "jsEscape":
        return codePoint <= 0xffff ? `\\u${getHex(codePoint)}` : `\\u{${hex}}`;
      case "utf16":
        return toUtf16Escape(char);
      case "htmlHex":
        return `&#x${hex};`;
      case "htmlDec":
        return `&#${codePoint};`;
      default:
        return `U+${hex}`;
    }
  };

  const parseCodeToken = (token) => {
    const trimmed = token.trim();
    let valueText = null;
    let radix = 16;

    const patterns = [
      /^U\+([0-9A-Fa-f]+)$/,
      /^\\u\{([0-9A-Fa-f]+)\}$/,
      /^\\u([0-9A-Fa-f]{4})$/,
      /^&#x([0-9A-Fa-f]+);$/i,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        valueText = match[1];
        break;
      }
    }

    const decimalMatch = trimmed.match(/^&#(\d+);$/);
    if (!valueText && decimalMatch) {
      valueText = decimalMatch[1];
      radix = 10;
    }

    if (!valueText) {
      const plainHexMatch = trimmed.match(/^[0-9A-Fa-f]+$/);
      if (plainHexMatch) {
        valueText = trimmed;
      }
    }

    if (!valueText) {
      return { error: `「${trimmed}」は正しいUnicodeコードではありません。` };
    }

    const codePoint = Number.parseInt(valueText, radix);
    if (!isValidCodePoint(codePoint)) {
      return { error: `「${trimmed}」はUnicodeの範囲外です。` };
    }

    return { codePoint };
  };

  const expandCodeTokens = (input) => input
    .split(/[\s,\t]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((token) => {
      if (/^(?:\\u[0-9A-Fa-f]{4}|\\u\{[0-9A-Fa-f]+\})+$/.test(token)) {
        return token.match(/\\u[0-9A-Fa-f]{4}|\\u\{[0-9A-Fa-f]+\}/g);
      }

      if (/^(?:&#x[0-9A-Fa-f]+;|&#\d+;)+$/i.test(token)) {
        return token.match(/&#x[0-9A-Fa-f]+;|&#\d+;/gi);
      }

      return token;
    });

  const convertCodeToChar = (input) => {
    const tokens = expandCodeTokens(input);
    if (tokens.length === 0) {
      return { output: "", details: [], errors: [] };
    }

    const errors = [];
    const chars = [];
    tokens.forEach((token) => {
      const parsed = parseCodeToken(token);
      if (parsed.error) {
        errors.push(parsed.error);
        return;
      }
      chars.push(String.fromCodePoint(parsed.codePoint));
    });

    const output = chars.join("");
    return { output, details: Array.from(output).map(describeChar), errors };
  };

  const convertChars = (input, format) => {
    const chars = Array.from(input);
    const separator = format === "uPlus" ? " " : "";
    return {
      output: chars.map((char) => formatChar(char, format)).join(separator),
      details: chars.map(describeChar),
      errors: [],
    };
  };

  const decodeEscapesInText = (input) => {
    const warnings = [];
    const convertMatch = (fullMatch, valueText, radix) => {
      const codePoint = Number.parseInt(valueText, radix);
      if (!isValidCodePoint(codePoint)) {
        warnings.push(`「${fullMatch}」はUnicodeの範囲外のため、そのまま残しました。`);
        return fullMatch;
      }
      return String.fromCodePoint(codePoint);
    };

    let output = input
      .replace(/\\u\{([0-9A-Fa-f]+)\}/g, (match, hex) => convertMatch(match, hex, 16))
      .replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) => convertMatch(match, hex, 16))
      .replace(/&#x([0-9A-Fa-f]+);/gi, (match, hex) => convertMatch(match, hex, 16))
      .replace(/&#(\d+);/g, (match, decimal) => convertMatch(match, decimal, 10));

    const invalidEscapes = input.match(/\\u\{[^}]*\}|\\u(?![0-9A-Fa-f]{4})\S{0,8}|&#x[^;\s]*;|&#\D[^;\s]*;/g) || [];
    invalidEscapes.forEach((value) => warnings.push(`「${value}」は変換可能なUnicodeエスケープではないため、そのまま残しました。`));

    return { output, details: Array.from(output).map(describeChar), errors: [], warnings: [...new Set(warnings)] };
  };

  const updateFormatOptions = () => {
    const mode = elements.mode.value;
    const formats = DEFAULT_FORMATS[mode];
    elements.format.innerHTML = formats
      .map((format) => `<option value="${format.value}">${format.label}</option>`)
      .join("");
    elements.formatWrap.hidden = formats.length <= 1;
    elements.hint.textContent = MODE_HINTS[mode];
    elements.input.placeholder = PLACEHOLDERS[mode];
  };

  const renderDetails = (details) => {
    currentDetails = details;
    if (details.length === 0) {
      elements.detailBody.innerHTML = '<tr><td colspan="5" class="unicode-converter-empty">まだ詳細はありません。</td></tr>';
      return;
    }

    elements.detailBody.innerHTML = "";
    details.forEach((detail) => {
      const row = document.createElement("tr");
      [detail.char, detail.unicode, detail.hex, detail.decimal, detail.utf16].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      elements.detailBody.appendChild(row);
    });
  };

  const showMessage = (messages, type = "info") => {
    const list = Array.isArray(messages) ? messages : [messages];
    if (list.length === 0 || list.every((message) => !message)) {
      elements.messageArea.innerHTML = "";
      return;
    }

    const box = document.createElement("div");
    box.className = `message-box ${type}`;
    box.innerHTML = list.map((message) => `<div>${escapeHtml(message)}</div>`).join("");
    elements.messageArea.innerHTML = "";
    elements.messageArea.appendChild(box);
  };

  const escapeHtml = (value) => value.replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[char]);

  const convert = () => {
    const input = elements.input.value;
    const mode = elements.mode.value;
    const format = elements.format.value;
    let result;

    if (mode === "codeToChar") {
      result = convertCodeToChar(input);
    } else if (mode === "charToUnicode") {
      result = convertChars(input, format);
    } else {
      result = decodeEscapesInText(input);
    }

    elements.output.value = result.output;
    renderDetails(result.details);

    if (result.errors.length > 0) {
      showMessage(result.errors, "error");
    } else if (result.warnings && result.warnings.length > 0) {
      showMessage(result.warnings, "info");
    } else {
      showMessage("変換しました。", "success");
    }
  };

  const clearAll = () => {
    elements.input.value = "";
    elements.output.value = "";
    elements.messageArea.innerHTML = "";
    renderDetails([]);
  };

  const copyText = async (text, emptyMessage) => {
    if (!text) {
      showMessage(emptyMessage, "info");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showMessage("コピーしました。", "success");
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      showMessage(copied ? "コピーしました。" : "コピーに失敗しました。", copied ? "success" : "error");
    }
  };

  const copyDetails = () => {
    if (currentDetails.length === 0) {
      showMessage("コピーできる詳細テーブルがありません。", "info");
      return;
    }

    const header = ["文字", "Unicodeコードポイント", "16進数", "10進数", "JavaScript UTF-16表現"];
    const rows = currentDetails.map((detail) => [detail.char, detail.unicode, detail.hex, detail.decimal, detail.utf16]);
    copyText([header, ...rows].map((row) => row.join("\t")).join("\n"), "コピーできる詳細テーブルがありません。");
  };

  const applySample = (sampleName) => {
    const sample = SAMPLES[sampleName];
    if (!sample) {
      return;
    }
    elements.mode.value = sample.mode;
    updateFormatOptions();
    elements.input.value = sample.text;
    convert();
  };

  const initialize = () => {
    elements.mode = document.getElementById("unicodeMode");
    elements.format = document.getElementById("unicodeOutputFormat");
    elements.formatWrap = document.getElementById("unicodeOutputFormatWrap");
    elements.hint = document.getElementById("unicodeModeHint");
    elements.input = document.getElementById("unicodeInput");
    elements.output = document.getElementById("unicodeOutput");
    elements.messageArea = document.getElementById("unicodeMessageArea");
    elements.detailBody = document.getElementById("unicodeDetailBody");

    updateFormatOptions();

    elements.mode.addEventListener("change", updateFormatOptions);
    document.getElementById("unicodeConvertButton").addEventListener("click", convert);
    document.getElementById("unicodeClearButton").addEventListener("click", clearAll);
    document.getElementById("unicodeCopyResult").addEventListener("click", () => copyText(elements.output.value, "コピーできる変換結果がありません。"));
    document.getElementById("unicodeCopyTable").addEventListener("click", copyDetails);
    document.querySelectorAll(".unicode-converter-sample-button").forEach((button) => {
      button.addEventListener("click", () => applySample(button.dataset.sample));
    });
  };

  document.addEventListener("DOMContentLoaded", initialize);
})();
