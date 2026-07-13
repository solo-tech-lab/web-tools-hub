# Webツール集

自分用に作ったWebツールをまとめたサイトです。  
HTML / CSS / JavaScript だけで作成しており、GitHub Pages で公開する構成を想定しています。

---

## 概要

このサイトは、トップページから各ツールページへ移動できる  
シンプルなWebツール集です。

現在は以下のツールを公開しています。

- JSON整形ツール
- 文字数カウントツール
- スプライトアニメ確認ツール
- Unicode変換ツール

---

## 機能

### トップページ
- ツール一覧を表示
- 各ツールページへのリンクを表示
- 今後ツールを追加しやすいカード型レイアウト

### JSON整形ツール
- JSON入力
- JSON整形
- エラー表示
- 整形結果のコピー・保存
- サンプルJSON入力
- `Ctrl + Enter` / `Cmd + Enter` で整形
- `Tab` キーで半角スペース2つ入力

### 文字数カウントツール
- 入力テキストの文字数・行数をリアルタイム集計
- 全角 / 半角 / 空白 / 改行除外文字数を表示
- 文字数制限シミュレーター（残り文字数・超過文字数・超過プレビュー）
- 空白ハイライト表示、行ごとの文字数表示
- Undo / Redo、コピー、クリア、サンプル入力
- 空白削除 / 改行削除 / 空白＋改行削除
- タブ追加（最大5件）で入力内容を切り替え

### スプライトアニメ確認ツール
- スプライト画像を読み込み、フレームアニメーションをプレビュー
- 1行あたりのフレーム数・フレームサイズ・総フレーム数を指定可能
- FPS（再生速度）、ループ、拡大表示を切り替え可能
- サンプル画像・サンプル設定JSONを使った動作確認

### Unicode変換ツール
- Unicodeコードポイント（`U+3042` / `3042`）を文字へ変換
- JavaScriptエスケープ（`\u3042` / `\u{3042}`）やHTML文字参照（`&#x3042;` / `&#12354;`）を文字へ変換
- 文字を `U+XXXX`、JavaScriptエスケープ、UTF-16エスケープ、HTML文字参照へ変換
- 文章内のUnicodeエスケープをまとめて解除
- 変換結果・詳細テーブルのコピー、サンプル入力、クリアに対応

---

## 使用技術

- HTML
- CSS
- JavaScript

---

## ディレクトリ構成

```text
web-tools-hub-dev/
├─ index.html
├─ LICENSE
├─ README.md
├─ css/
│  └─ style.css
├─ js/
│  └─ theme-toggle.js
└─ tools/
   ├─ char-counter/
   │  ├─ index.html
   │  ├─ main.js
   │  └─ style.css
   ├─ json-formatter/
   │  ├─ index.html
   │  ├─ main.js
   │  └─ style.css
   ├─ sprite-animation/
   │  ├─ index.html
   │  ├─ main.js
   │  ├─ style.css
   │  └─ samples/
   │     ├─ sample-data.json
   │     ├─ sample_01.png
   │     ├─ sample_02.png
   │     └─ sample_03.png
   └─ unicode-converter/
      ├─ index.html
      ├─ main.js
      └─ style.css
```

---

## ライセンス
このプロジェクトは MIT License のもとで公開しています。  
詳細は [LICENSE](./LICENSE) を参照してください。

---
