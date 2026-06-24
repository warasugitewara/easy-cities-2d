# 品質改善計画 — easy-cities-2d

> 他エージェント（Claude Code / Copilot 等）向けの進捗共有ドキュメント。
> 本ゲームは haiku（小型モデル）で書かれた経緯があり、(1) パフォーマンス、(2) 実装漏れ・バグ・仕様乖離、(3) UX/UI に課題がある。新機能は追加せず、既存実装の質を上げることに集中する。**フェーズ分割**で進め、各フェーズごとにレビュー・コミットする。

最終更新: 2026-06-23（Phase 1 完了 / Phase 1.5 緊急バグ修正を追加 / バージョン 1.1.0）

## 決定事項（ユーザー確認済み）
- 進め方は **P1 → P2 → P3** のフェーズ分割。
- 建物サイズの仕様乖離は **README 仕様に合わせて実装を修正**（README 刷新は別途）。
- 既存セーブデータの後方互換は **割り切る**（バージョン移行に労力をかけない）。
- パフォーマンス改善は **ゲームの挙動・バランスを変えない**（計算量のみ削減）。
- 実装は **Sonnet サブエージェントに委譲**し、メインは設計・レビューに専念（トークン節約）。
- 検証は **Vite+**（`vp check` / `vp test` / `vp dev`）。npm/vitest/oxlint を直接呼ばない。型 strict。`any`/`@ts-ignore`/非nullアサーション乱用は禁止。

---

## Phase 1: パフォーマンス（ラグ解消）— 完了

最大要因は `main.ts:169` で `grow()` が毎フレーム呼ばれ、全16,384タイル×`stationBoost()`(81重ループ)×`centerBias()`(sqrt) を実行していた点。**挙動互換を保ったまま計算量のみ削減**する。キャッシュ類は GameState に入れない（セーブ汚染回避のため `GameEngine` の private フィールドに保持）。

| Step | 内容 | 状態 | コミット |
|------|------|------|----------|
| 1 | dev専用 grow/monthly 実行時間プロファイラ | ✅ | `87b97f0` |
| 2 | `engine.state` を property 化＋キャッシュ無効化フック | ✅ | `87b97f0` |
| 3 | `centerBias` を `biasMap`(Float64Array) 事前計算に | ✅ | `87b97f0` |
| 4 | `stationBoost` を `boostMap`(Float32Array) キャッシュに（駅増減時のみ再構築）※最大効果 | ✅ | `87b97f0` |
| 5 | `grow()` で EMPTY かつ非隣接タイルをスキップ（乱数消費不変） | ✅ | `cc2d4b8` |
| 6 | `spreadPower`/`spreadWater` を施設半径の矩形走査に限定（円形sqrt判定は維持） | ✅ | `cc2d4b8` |
| 7 | `calculateLandmarkCommercialBonus` を半径の矩形走査に限定（重複加算維持） | ✅ | `cc2d4b8` |
| 8 | 描画最適化: オーバーレイRGBAの量子化キャッシュ＋グリッド線1パス化（`renderer.ts`） | ✅ | `6ffb618` |
| 9 | (任意) monthlyUpdate の施設走査を施設インデックスに集約 | ⬜ 保留 | — |

**Phase 1 完了（Step1〜8）。** Step9 は Step6〜7 で月次が十分軽ければ見送り可の保留項目。次は Phase 2 に着手。

---

## Phase 1.5: 緊急バグ修正（新規発見・実機再現済み 2026-06-23）— 一部対応

ユーザー報告を**ブラウザ実機（Playwright, desktop 1440px / mobile 390px）で再現し根本原因を確定済み**。挙動・バランスを壊さない明確なバグ修正のため、Phase 2（バランス影響あり）より優先で着手してよい。

| # | 問題 | 根本原因（確定） | 修正方針 | 状態 |
|---|------|-----------------|---------|------|
| A | バージョン表記が古い（表示 1.0.7 / `package.json` 1.0.6 と不一致） | `constants.ts` の `GAME_VERSION` と `package.json` で二重管理かつ未更新 | `1.1.0` に統一（`constants.ts` / `package.json` / `README.md`） | ✅ |
| B | **スマホで建物を配置できない（高）** | `updateDisplay()`（`ui.ts:740-742`）がモバイルに存在しない `stat-residential-demand` / `stat-commercial-demand` / `stat-industrial-demand` を非null断定(`!`)で参照し例外。さらに `gameLoop`（`main.ts:211`）の `requestAnimationFrame` が `try` 内にあるため、例外で描画ループが1フレームで停止し再描画されない（`build()` 自体は `state.map` を更新するが画面に反映されない） | (a) `updateDisplay` を null 安全化（要素が無ければスキップするヘルパー経由に）。(b) `gameLoop` の再スケジュールを `finally` 化し、1フレームの例外で全停止しないようにする | ✅（実機検証済み: ループ継続・配置が描画反映・コンソールエラー0） |
| C | **PCでメニューパネルの ✕ が効かず閉じられない（高）** | `@media (min-width:1025px)` の `#build-menu, #controls-panel { display:block !important }`（IDセレクタ）が `.controls-panel-overlay.hidden { display:none !important }`（クラスセレクタ）を**詳細度**で上書きし、`.hidden` が無効化。🎛️/✕ のトグルが効かず常時表示になる | デスクトップの当該ルールから `#build-menu, #controls-panel` を除外（`.dashboard-compact` / `.time-panel` / `.toggle-container` は残す）。初期非表示→🎛️で開閉という本来挙動に戻る | ✅（実機検証済み: 起動時非表示→🎛️で表示→✕で非表示） |
| D | 「設定」まわりが操作できない（中）→ **C と同一事象** | 実機調査の結果、設定モーダル自体は正常に開閉・適用できる（ユーザーの言う「項目自体は動く」と一致）。「設定が最初から出ていて✕で閉じられない」はメニュー(=設定)パネルの C のバグそのもの | C の修正で解決 | ✅（C に統合） |

**進め方**: B・C を修正し実機（Playwright, desktop/mobile）で再現解消を確認済み（D は C と同一事象のため C で解決）。1.1.0 のバグ修正として `main` マージで公開予定。

---

## Phase 2: バグ・実装漏れ・仕様乖離 — 未着手

挙動・バランスに関わるため Phase 1 完了後に着手。着手時に各項目の詳細（値の統一・存廃判断）を再確認すること。

- **配列負インデックス修正（高）**: `engine.ts:278` 付近の複数マス建物配置判定に `nx < 0 || ny < 0` を追加（`map[-1]` アクセス＝データ破損を防止）。demolish 側も確認。
- **建物サイズを README 仕様に修正（高）**: `constants.ts` の `BUILDING_SIZES` を 発電所1×1・水処理1×1・学校2×2・病院2×2 に。配置/削除/効果範囲の整合を検証。
- **定数の実装組み込み（中）**: `INFRASTRUCTURE_EFFECTS`/`LANDMARK_EFFECTS`/`SYNERGY_EFFECTS`（fireSuppressionRate, diseaseReductionRate, diseaseMultiplier, park.comfortBoost, 各 rangeRadius/growthBoost）を engine のハードコード値と統一。食い違い（給水病気倍率 仕様3倍/実装1.2倍、消火90%/定義75% 等）は項目ごとに採用値を確認。
- **`park.comfortBoost` 未実装の補完（中）**: 公園効果範囲内の快適度加算を `calculateComfort()` に実装。
- **`crimeMap` の扱い（中）**: 完全未使用。治安度システムが既にあるため**削除が有力**（要判断）。
- **負の資金の破産判定（中）**: 火災/病気の `-500` 等で月途中に負になった場合の扱いを統一。
- **キーボード操作後の UI 同期（低）**: `main.ts:527-549` のキー入力で `buildMode` 変更時に UI タブ/ハイライトも同期。
- **セーブのバージョン扱い（低・割り切り前提）**: 欠損フィールドの安全なデフォルト補完のみ。

---

## Phase 3: UX/UI — 未着手

- **建設失敗フィードバック（高）**: `engine.build()` が成功/失敗（資金不足・占有済み・範囲外）を返すよう拡張しトースト通知。`main.ts:244` 等の戻り値無視を修正。
- **`alert()` をトースト通知に置換（高）**: `ui.ts`/`main.ts` の各 alert を自動消滅トーストへ（成功=緑/失敗=赤）。
- **削除モードのプレビュー（高）**: ホバー対象を赤系ハイライト表示（誤削除防止）。
- **選択ツールと UI ハイライトの同期（中）**: `buildMode` 変更を単一経路に集約。モバイルの `categorySelect.value` 同期含む。
- **レスポンシブ再判定（中）**: `ui.ts` の `isMobile`(`<=1024`固定) を resize 時に再評価。ブレークポイント整理。
- **ドラッグ/リサイズの視覚フィードバック（中）**: ドラッグ中パネルの半透明＋影。
- **アクセシビリティ（中）**: 主要ボタンに `aria-label`/`role`、`:focus` スタイル。
- **細部（低）**: 学校アイコン統一（🏫）、需要メータートグルの状態表示、説明文のコントラスト改善。

---

## 検証（全フェーズ共通）
- `vp check`（Oxlint type-aware + Oxfmt + 型チェック）→ `vp test`（※現状テスト未整備）。
- `vp dev`（localhost:5173）で同一操作シナリオを実施し、人口/資金/快適度/各パラメータの推移が改善前と体感同一であること、計測ログ（dev時 fps/grow≈/monthly≈）が改善していることを確認。
- セーブ/ロード往復で街が同一復元・localStorage が肥大化しない（キャッシュ非混入）こと。
- コミットは Conventional Commits（日本語）。commit/push は都度ユーザー承認（自動コミットしない）。
