# Webツール集

自分用に作ったWebツールをまとめたサイトです。  
HTML / CSS / JavaScript だけで作成しており、GitHub Pages で公開する構成を想定しています。

---

## 概要

このサイトは、トップページから各ツールページへ移動できる  
シンプルなWebツール集です。

現在は以下のツールを公開しています。

- JSON整形ツール

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

---

## 使用技術

- HTML
- CSS
- JavaScript

---

## ディレクトリ構成

```text
web-tools/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ main.js
│  └─ json-formatter.js
└─ tools/
   └─ json-formatter.html
```

---

## ライセンス
このプロジェクトは MIT License のもとで公開しています。  
詳細は [LICENSE](./LICENSE) を参照してください。

---