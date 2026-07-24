# Easy Cities 2D 🏙️

![version](https://img.shields.io/badge/version-2.0.0-blue) ![license](https://img.shields.io/badge/license-MIT-green)

Cities Skylines 風の戦略性を備えた、ブラウザだけで遊べる 2D 都市建設シミュレーターです。
初期資金を元手に道路・住宅・商業・工業・インフラを配置すると、需給バランスに応じて都市が自動で成長していきます。人口・資金・快適度のバランスを取りながら、災害や公害、スラム化といったリスクにも対応してください。

**🎮 [Play Online - Easy Cities 2D](https://warasugitewara.github.io/easy-cities-2d/)**

## ✨ 特徴

- **自動成長する都市**: 道路や既存の建物に隣接するタイルが確率的に成長・高層化（住宅/商業/工業 L1〜L4）
- **需給バランスモデル**: 住宅（居住人口）と商業・工業（雇用）のバランスから3種類の需要を算出し、成長速度に反映
- **インフラのカバー率モデル**: 警察・消防・学校・病院は人口あたりの必要棟数に対する充足率から治安/安全/教育/医療レベルが滑らかに追従
- **電力・給水網**: 発電所・水処理施設からの供給範囲（円形）に応じて電力供給率・給水率が変動、未供給タイルは成長が大幅に低下
- **災害・公害・スラム化（任意でON/OFF）**: 火災・病気は蔓延すると建物を破壊/永続的に降格させる。工業地帯からの公害とスラム化も再現
- **ランドマーク**: スタジアム・空港の周辺商業地に税収倍率ボーナス、都市全体の観光・国際化レベルも上昇
- **ライト/ダークテーマ**: HUD 右上のボタンでいつでも切り替え可能（既定はダーク）
- **タッチ対応**: PC（マウス）・スマートフォン/タブレット（タッチ）の両対応、レスポンシブな UI
- **セーブ/ロード**: localStorage 3スロット + JSON エクスポート/インポート

## 操作方法

### PC（マウス）

| 操作                    | 効果                             |
| ----------------------- | -------------------------------- |
| 左クリック / 左ドラッグ | 選択中のツールで建設（連続敷設） |
| 右クリックドラッグ      | 画面のパン                       |
| マウスホイール          | ズーム（1.0x〜3.0x）             |

### タッチ（スマートフォン/タブレット）

| 操作                 | 効果                             |
| -------------------- | -------------------------------- |
| 1本指タップ/ドラッグ | 選択中のツールで建設（連続敷設） |
| 2本指ドラッグ        | 画面のパン                       |
| 2本指ピンチ          | ズーム（1.0x〜3.0x）             |

### キーボード

| キー                    | 効果                                          |
| ----------------------- | --------------------------------------------- |
| `R`/`S`/`C`/`I`/`U`/`D` | 道路/住宅/商業/工業/インフラ/削除モードに切替 |
| `Space`                 | 一時停止トグル                                |
| `1`/`2`/`3`             | 速度 0.5x / 1x / 2x                           |
| `Esc`                   | 開いているモーダルを閉じる                    |

HUD 右上の ⚙ メニューから、設定（難易度・災害/公害/スラム化のON/OFF・サンドボックスモード）、セーブ/ロード、JSON エクスポート/インポートを行えます。

## クイックスタート

```bash
git clone https://github.com/warasugitewara/easy-cities-2d.git
cd easy-cities-2d
npm install
npm run dev      # http://localhost:5173
```

このプロジェクトは [Vite+](https://viteplus.dev)（`vp`）で統一管理されています。`npm install` 後は Vite+ のグローバルインストールも必要です（`curl -fsSL https://vite.plus | bash` など、詳細は [viteplus.dev](https://viteplus.dev) 参照）。

```bash
vp dev          # 開発サーバー
vp build        # 本番ビルド（dist/ に出力）
vp check        # フォーマット + リント + 型チェック（コミット前に必ず実行）
vp check --fix  # 自動修正
vp test         # テスト実行（Vitest）
```

## 技術スタック

- **言語**: TypeScript
- **ツールチェーン**: [Vite+](https://viteplus.dev)（vite v8.0.0）— ビルド・リント（Oxlint）・フォーマット（Oxfmt）・型チェックを一元管理
- **バンドラー**: [Rolldown](https://rolldown.rs)（Rust製）
- **レンダリング**: Canvas 2D API（ビューポートカリングによる描画最適化）
- **永続化**: localStorage + JSON
- **デプロイ**: GitHub Pages（`main` push → GitHub Actions → `dist/` 公開）

## ファイル構成

```
src/
├── main.ts        # エントリーポイント（クラスの配線・入力イベント処理・固定タイムステップのゲームループ）
├── engine.ts       # GameEngine（GameState の唯一の所有者。build/grow/monthlyUpdate/reset）
├── renderer.ts     # Canvas 描画（ビューポートカリング、カメラのパン/ズーム）
├── ui.ts           # UIManager（HUD・ビルドツールバー・ドロワー・トースト・モーダル等）
├── storage.ts      # StorageManager（localStorage 3スロット + JSON I/O）
├── constants.ts    # ゲーム定数（バランス数値の唯一の定義元）
├── gameloop.ts     # 固定タイムステップ計算の純粋関数
├── toast.ts        # トースト通知
├── rng.ts          # シード可能な PRNG（テスト用に注入可能）
└── style.css       # スタイル定義
```

より詳しいゲームバランス・数値（建物サイズ/コスト/効果/需要/快適度/ランドマーク等）は [docs/GAMEPLAY.md](docs/GAMEPLAY.md) を、更新履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。実装方針は [CLAUDE.md](CLAUDE.md) にまとめています。

## ライセンス

MIT License

## クレジット

**オリジナル版制作**: 松島さん
**改良・2D版開発**: warasugitewara

バグ報告や機能リクエストは [GitHub Issues](https://github.com/warasugitewara/easy-cities-2d/issues) までお願いします。
