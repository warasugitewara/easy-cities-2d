# Easy Cities 2D 🏙️

[![Version](https://img.shields.io/badge/version-2.0.0-blue?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#license)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square)](#)
[![Vite+](https://img.shields.io/badge/Vite%2B-8.x-646cff?style=flat-square)](#)

> 🎮 Cities Skylines 風の戦略性を備えた、ブラウザだけで遊べる 2D 都市建設シミュレーター

**[🕹️ プレイする](https://warasugitewara.github.io/easy-cities-2d/)** • **[📖 ゲームガイド](docs/GAMEPLAY.md)** • **[💬 Issues](https://github.com/warasugitewara/easy-cities-2d/issues)**

## 🎮 概要

初期資金を元手に道路・住宅・商業・工業・インフラを配置すると、需給バランスに応じて都市が自動で成長していきます。人口・資金・快適度のバランスを保ちながら、大都市の建設を目指しましょう。

## 🎨 ゲームプレイ

<details>
<summary><strong>📸 スクリーンショット（クリックして展開）</strong></summary>

### ゲーム画面の進化

| ビフォー（明るいテーマ） | アフター（ダークテーマ） |
|:---:|:---:|
| ![ビフォー - 駅を選択中](https://github.com/warasugitewara/easy-cities-2d/blob/main/docs/images/before-light.png?raw=true) | ![アフター - ダークモード UI](https://github.com/warasugitewara/easy-cities-2d/blob/main/docs/images/after-dark.png?raw=true) |

### メニュー・ビルドツール

![メニュー画面 - ビルドツール選択](https://github.com/warasugitewara/easy-cities-2d/blob/main/docs/images/menu-build.png?raw=true)

</details>

## ✨ 主な特徴

- **🏘️ 自動成長する都市** — 道路や既存の建物に隣接するタイルが確率的に成長・高層化（L1〜L4）
- **⚖️ 需給バランスモデル** — 住宅と商業・工業のバランスから成長速度を自動計算
- **🛡️ インフラ充足率システム** — 警察・消防・学校・病院の必要棟数に応じた効果量
- **⚡ 電力・給水ネットワーク** — 供給範囲による電力供給率・給水率の動的変動
- **🔥 災害・公害・スラム化** — 火災や病気の蔓延、公害による建物劣化（ON/OFF 選択可）
- **🏟️ ランドマーク** — スタジアムと空港の周辺商業地に税収ボーナス
- **🎨 ライト/ダークテーマ** — HUD で切り替え可能（デフォルト：ダーク）
- **📱 マルチプラットフォーム** — PC（マウス）・スマートフォン・タブレット対応
- **💾 セーブシステム** — localStorage 3スロット + JSON エクスポート/インポート

## 🎮 操作方法

### マウス（PC）

| 操作 | 効果 |
|------|------|
| **左クリック / ドラッグ** | ツール実行（連続敷設可） |
| **右ドラッグ** | 画面パン |
| **ホイール** | ズーム（1.0x – 3.0x） |

### タッチ（モバイル）

| 操作 | 効果 |
|------|------|
| **1本指タップ / ドラッグ** | ツール実行（連続敷設可） |
| **2本指ドラッグ** | 画面パン |
| **2本指ピンチ** | ズーム（1.0x – 3.0x） |

### キーボード

| キー | 効果 |
|------|------|
| `R` / `S` / `C` / `I` / `U` / `D` | 道路 / 住宅 / 商業 / 工業 / インフラ / 削除 |
| `Space` | 一時停止トグル |
| `1` / `2` / `3` | 速度 0.5x / 1x / 2x |
| `Esc` | モーダルを閉じる |

💡 詳細な設定・セーブ/ロードは HUD 右上の ⚙️ メニューから

## 🚀 クイックスタート

### 前提条件

- Node.js 18.x 以上
- [Vite+](https://viteplus.dev) グローバル CLI

### インストール＆実行

```bash
# リポジトリをクローン
git clone https://github.com/warasugitewara/easy-cities-2d.git
cd easy-cities-2d

# 依存関係をインストール
npm install

# 開発サーバーを起動
vp dev  # http://localhost:5173
```

### よく使うコマンド

```bash
vp dev          # 開発サーバー起動
vp build        # 本番ビルド（dist/ に出力）
vp check        # フォーマット + リント + 型チェック
vp check --fix  # 自動修正
vp test         # テスト実行（Vitest）
vp lint         # リント のみ
vp fmt          # フォーマット のみ
```

> **💡 ヒント**: コミット前に必ず `vp check` を実行してください

## 🏗️ アーキテクチャ

### ファイル構成

```
src/
├── main.ts          # エントリーポイント＆ゲームループ・入力処理
├── engine.ts        # GameEngine（ゲーム状態の唯一の所有者）
├── renderer.ts      # Canvas 2D レンダリング
├── ui.ts            # UIManager（HUD・パネル・モーダル等）
├── storage.ts       # StorageManager（セーブ/ロード）
├── constants.ts     # ゲームバランス定数
├── gameloop.ts      # 固定タイムステップ計算
├── toast.ts         # 通知システム
├── rng.ts           # シード可能な乱数生成器
└── style.css        # スタイル定義
```

### 設計原則

- **単一責任**: `GameEngine.state` が唯一の真実の源
- **効率的レンダリング**: ビューポートカリング、Canvas 内部ピクセル管理
- **バランス集約**: すべての数値は `constants.ts` に集約
- **型安全**: TypeScript strict mode + ESLint + Oxfmt

詳細は [docs/GAMEPLAY.md](docs/GAMEPLAY.md) を参照

## 📊 技術スタック

| 層 | 技術 |
|----|------|
| **言語** | TypeScript 5.x |
| **ビルドツール** | [Vite+](https://viteplus.dev) 8.x |
| **バンドラー** | [Rolldown](https://rolldown.rs)（Rust） |
| **レンダリング** | Canvas 2D API |
| **テスト** | Vitest |
| **リント** | [Oxlint](https://oxc-project.github.io/) |
| **フォーマット** | [Oxfmt](https://oxc-project.github.io/) |
| **永続化** | localStorage + JSON |
| **デプロイ** | GitHub Pages（GitHub Actions） |

## 📦 デプロイ

`main` ブランチへの push で自動的に以下が実行されます:

1. `npm run build` で本番ビルド
2. `dist/` を GitHub Pages に公開
3. 以下の URL でライブ: https://warasugitewara.github.io/easy-cities-2d/

## 📖 ドキュメント

- **[ゲームプレイガイド](docs/GAMEPLAY.md)** — ゲームバランス、建物コスト、インフラ効果の詳細
- **[変更履歴](CHANGELOG.md)** — バージョン履歴と更新内容

## 🤝 貢献

バグ報告や機能リクエストは [GitHub Issues](https://github.com/warasugitewara/easy-cities-2d/issues) までお願いします。

## 📄 ライセンス

MIT License — 自由に利用、改変、配布が可能です

## 👥 クレジット

| 役割 | 名前 |
|------|------|
| **オリジナル版制作** | 松島さん |
| **改良・2D 版開発** | [warasugitewara](https://github.com/warasugitewara) |

---

**ぜひプレイしてみてください！** 🎮✨
