import "./style.css";
import { GameEngine, GameSettings } from "./engine";
import { Renderer } from "./renderer";
import { StorageManager } from "./storage";
import { UIManager } from "./ui";
import {
  setMapSize,
  getCanvasSize,
  getTileSize,
  GAME_VERSION,
  MapSize,
  TileType,
  BUILD_COSTS,
  BUILDING_SIZES,
} from "./constants";
import { computeSteps, SIM_TICK_MS } from "./gameloop";
import { showToast } from "./toast";

// 保存済みテーマを最初に適用（描画前に設定してテーマのちらつきを防ぐ）。既定はダーク。
(() => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("easy-cities-2d-theme");
  } catch {
    /* localStorage 不可でも既定テーマで動作させる */
  }
  document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
})();

// ページタイトルを動的に更新
document.title = `Easy Cities 2D (ver.${GAME_VERSION})`;

console.log(`🎮 Easy Cities 2D (ver.${GAME_VERSION}) - Initializing...`);

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
if (!canvas) {
  console.error("❌ Canvas element not found!");
  throw new Error("Canvas element not found");
}

console.log("✅ Canvas found:", canvas);

/** チェックボックス1個分のトグルスイッチ行 (`.toggle-row` + `.switch`) の HTML を生成する。
 *  ui.ts の UIManager#toggleRowHTML と同等の見た目（独立モジュールのため小規模に複製）。 */
function toggleRowHTML(id: string, label: string): string {
  return `
    <label class="toggle-row" for="${id}">
      <span class="toggle-row-label">${label}</span>
      <span class="switch">
        <input type="checkbox" id="${id}">
        <span class="switch-track" aria-hidden="true"></span>
      </span>
    </label>`;
}

/** カード型ラジオボタン群（`name` で束ねる）1グループ分の HTML を生成する。 */
function optionCardsHTML(
  name: string,
  groupLabel: string,
  options: { value: string; title: string; sub: string; checked?: boolean }[],
): string {
  const cards = options
    .map(
      ({ value, title, sub, checked }) => `
      <label class="option-card${checked ? " selected" : ""}">
        <input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""}>
        <span class="option-card-title">${title}</span>
        <span class="option-card-sub">${sub}</span>
      </label>`,
    )
    .join("");
  return `<div class="option-cards" role="radiogroup" aria-label="${groupLabel}">${cards}</div>`;
}

/** ラジオカード群の選択状態に応じて `.selected` クラスを追従させる。 */
function bindOptionCardGroup(root: HTMLElement, name: string): void {
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      inputs.forEach((i) => i.closest(".option-card")?.classList.toggle("selected", i.checked));
    });
  });
}

// ゲーム開始前の設定画面
function showInitialSettings(): Promise<GameSettings> {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content modal-content-wide">
        <h2 id="modal-title-init-settings">🎮 Easy Cities 2D (ver.${GAME_VERSION})</h2>
        <p class="modal-lead">ゲーム設定を選択してください</p>

        <div class="modal-section">
          <h3 class="modal-section-title">マップサイズ</h3>
          ${optionCardsHTML("mapsize", "マップサイズ", [
            { value: "small", title: "小", sub: "512×512<br>64×64グリッド" },
            { value: "medium", title: "中", sub: "1024×1024<br>128×128グリッド", checked: true },
            { value: "large", title: "大", sub: "2048×2048<br>256×256グリッド" },
          ])}
        </div>

        <div class="modal-section">
          <h3 class="modal-section-title">難易度</h3>
          ${optionCardsHTML("difficulty", "難易度", [
            { value: "easy", title: "イージー", sub: "資金多め", checked: true },
            { value: "normal", title: "ノーマル", sub: "標準" },
            { value: "hard", title: "ハード", sub: "資金少なめ" },
          ])}
        </div>

        <div class="modal-section">
          <h3 class="modal-section-title">ゲームシステム</h3>
          <div class="settings-group">
            ${toggleRowHTML("init-sandbox", "🎮 サンドボックスモード（資金∞）")}
            ${toggleRowHTML("init-disasters", "災害システムを有効にする")}
            ${toggleRowHTML("init-pollution", "公害システムを有効にする")}
            ${toggleRowHTML("init-slum", "スラム化システムを有効にする")}
          </div>
        </div>

        <div class="modal-buttons">
          <button id="btn-start-game" class="btn-primary">ゲーム開始</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const content = modal.querySelector<HTMLElement>(".modal-content");
    if (!content) {
      // content が取得できない異常系でも既定設定でゲームを開始できるようにする
      modal.remove();
      resolve({
        mapSize: "medium",
        difficulty: "normal",
        sandbox: false,
        disastersEnabled: false,
        pollutionEnabled: false,
        slumEnabled: false,
      });
      return;
    }

    bindOptionCardGroup(content, "mapsize");
    bindOptionCardGroup(content, "difficulty");

    const focusable = (): HTMLElement[] =>
      Array.from(
        content.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
    focusable()[0]?.focus();

    // このモーダルは「キャンセルして元の状態に戻る」先が存在しないため、
    // Esc / 背景クリックは「ゲーム開始」ボタンと同じ確定操作として扱う
    // （設定を破棄して閉じるだけの動作にはしない）。
    const start = (): void => {
      const mapSize =
        content.querySelector<HTMLInputElement>('input[name="mapsize"]:checked')?.value || "medium";
      const difficulty =
        content.querySelector<HTMLInputElement>('input[name="difficulty"]:checked')?.value ||
        "normal";
      const settings: GameSettings = {
        mapSize: mapSize as MapSize,
        difficulty: difficulty as GameSettings["difficulty"],
        sandbox: content.querySelector<HTMLInputElement>("#init-sandbox")?.checked || false,
        disastersEnabled:
          content.querySelector<HTMLInputElement>("#init-disasters")?.checked || false,
        pollutionEnabled:
          content.querySelector<HTMLInputElement>("#init-pollution")?.checked || false,
        slumEnabled: content.querySelector<HTMLInputElement>("#init-slum")?.checked || false,
      };
      modal.remove();
      resolve(settings);
    };

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title-init-settings");
    modal.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        start();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) start();
    });

    document.getElementById("btn-start-game")?.addEventListener("click", start);
  });
}

// Bresenhamのラインアルゴリズム: 2点間の直線上のタイルを取得
function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

// ゲーム初期化（非同期）
async function initializeGame(): Promise<void> {
  // 初期設定画面を表示
  const settings = await showInitialSettings();

  // マップサイズを設定
  setMapSize(settings.mapSize);
  const canvasSize = getCanvasSize();

  // キャンバスの内部解像度をゲームの論理サイズに固定する
  // （CSSで表示サイズを調整し、タッチ座標はscaleX/Yで変換する）
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  console.log(`✅ Canvas setup: ${canvas.width}x${canvas.height}px (logical game size)`);

  try {
    const engine = new GameEngine(settings);
    const renderer = new Renderer(canvas, engine);
    const storage = new StorageManager();
    const uiManager = new UIManager(engine, storage);

    console.log("✅ Game engine initialized with settings:", settings);

    let monthCounter = 0;

    // 固定タイムステップ（フレームレート非依存化）用の状態
    // - accumulator: 未消化の経過時間（ミリ秒）を貯めるバッファ
    // - lastTime: 前回 gameLoop が呼ばれた時刻（performance.now()基準）
    // - MAX_STEPS: 1フレームあたりに追いつくために進めるステップ数の上限
    //   （タブ非アクティブからの復帰など巨大なギャップでも処理が無限に溜まらないようにする）
    // - MAX_FRAME_TIME_MS: frameTime自体の上限クランプ（巨大ギャップを丸ごと吸収しない）
    let accumulator = 0;
    let lastTime = 0;
    const MAX_STEPS = 5;
    const MAX_FRAME_TIME_MS = 250;

    let isMouseDown = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let lastCameraOffsetX = 0;
    let lastCameraOffsetY = 0;

    // タッチ操作用の状態
    // 'idle': 何もしていない
    // 'building': 1本指で建設中
    // 'panning': 2本指でパン・ピンチ中
    let touchMode: "idle" | "building" | "panning" = "idle";
    let pinchLastDist = 0;

    // dev専用パフォーマンス計測（本番ビルドでは import.meta.env.DEV が false になり無効化される）
    let devLastFrameTime = 0;
    let devLastLogTime = 0;

    // シミュレーションを1ステップ分進める（従来の「1フレーム分」の処理と同一）
    function runSimulationStep(): void {
      // 成長処理
      engine.grow();

      // 月次更新（ゲーム速度に応じたステップカウント）
      // gameSpeed: 0.5 = 遅い（40ステップ）、1 = 通常（20ステップ）、2 = 高速（10ステップ）
      const updateInterval = Math.max(1, Math.round(20 / engine.state.gameSpeed));
      monthCounter++;
      if (monthCounter >= updateInterval) {
        engine.monthlyUpdate();
        monthCounter = 0;
      }
    }

    // ゲームループ（固定タイムステップ）
    // requestAnimationFrame の呼び出し頻度（＝モニタのリフレッシュレート）に依存せず、
    // SIM_TICK_MS（1000/60ms）刻みでシミュレーションを進めることで、
    // 60fps環境と挙動を一致させつつ120Hz/144Hz環境での加速・低フレームレート環境での減速を防ぐ。
    function gameLoop(now: number = performance.now()): void {
      try {
        const __frameNow = import.meta.env.DEV ? performance.now() : 0;

        if (lastTime === 0) {
          lastTime = now;
        }
        const rawFrameTime = now - lastTime;
        lastTime = now;

        // ポーズ状態でない場合のみ成長処理
        if (!engine.state.paused && engine.state.gameSpeed > 0) {
          // タブ非アクティブからの復帰などによる巨大なギャップをクランプしてから
          // 固定刻みのステップ数を計算する
          const frameTime = Math.min(rawFrameTime, MAX_FRAME_TIME_MS);
          const plan = computeSteps(accumulator, frameTime, SIM_TICK_MS, MAX_STEPS);
          accumulator = plan.accumulator;

          for (let i = 0; i < plan.steps; i++) {
            runSimulationStep();
          }
        } else {
          // ポーズ中はaccumulatorを溜め込まない
          // （溜め込むと再開直後に一気にシミュレーションが進んでしまうため）
          accumulator = 0;
        }
        // ポーズ中でも月次カウンター(monthCounter)はそのまま保持する（従来挙動と同様）

        // 描画（ポーズ中でも毎フレーム実行）
        renderer.draw();

        // UI更新
        uiManager.updateDisplay();

        // dev専用: 1秒に1回、fps/grow/monthlyの計測値をログ出力（本番ビルドでは到達しない）
        if (import.meta.env.DEV) {
          const frameDelta = devLastFrameTime > 0 ? __frameNow - devLastFrameTime : 0;
          devLastFrameTime = __frameNow;

          if (devLastLogTime === 0) {
            devLastLogTime = __frameNow;
          } else if (__frameNow - devLastLogTime >= 1000) {
            const fps = frameDelta > 0 ? Math.round(1000 / frameDelta) : 0;
            const profile = engine.getProfile();
            console.log(
              `[perf] fps≈${fps} grow≈${profile.growMs.toFixed(2)}ms monthly≈${profile.monthlyMs.toFixed(2)}ms`,
            );
            devLastLogTime = __frameNow;
          }
        }
      } catch (e) {
        console.error("❌ Game loop error:", e);
      } finally {
        // 1フレームの例外で描画ループ全体を停止させない（再スケジュールを保証）
        requestAnimationFrame(gameLoop);
      }
    }

    // スクリーン座標を取得（マウス/タッチ両対応）
    function getClientCoordinates(e: MouseEvent | TouchEvent): {
      clientX: number;
      clientY: number;
    } {
      if ("touches" in e && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      } else if (e instanceof MouseEvent) {
        return { clientX: e.clientX, clientY: e.clientY };
      }
      return { clientX: 0, clientY: 0 };
    }

    // CSSピクセル座標をキャンバス内部ピクセルに変換するスケール比を計算
    function getCanvasScale(): { scaleX: number; scaleY: number } {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return { scaleX: 1, scaleY: 1 };
      return {
        scaleX: canvas.width / rect.width,
        scaleY: canvas.height / rect.height,
      };
    }

    // カメラ位置をマップ範囲内にクランプする共通関数
    function clampCamera(): void {
      const gridSize = engine.state.gridSize;
      const tileSize = getTileSize();
      const mapWidth = gridSize * tileSize * renderer.zoomLevel;
      const mapHeight = gridSize * tileSize * renderer.zoomLevel;
      const cs = canvas.width; // キャンバス内部解像度を使用
      renderer.cameraOffsetX = Math.max(-(mapWidth - cs), Math.min(0, renderer.cameraOffsetX));
      renderer.cameraOffsetY = Math.max(-(mapHeight - cs), Math.min(0, renderer.cameraOffsetY));
    }

    // 敷設処理（共通）
    function buildAtMouse(clientX: number, clientY: number): void {
      try {
        const rect = canvas.getBoundingClientRect();
        const { scaleX, scaleY } = getCanvasScale();
        // CSSピクセル → キャンバス内部ピクセルに変換
        const screenX = (clientX - rect.left) * scaleX;
        const screenY = (clientY - rect.top) * scaleY;

        const worldCoords = renderer.screenToWorld(screenX, screenY);
        const tileSize = getTileSize();
        const x = Math.floor((worldCoords.x + tileSize * 0.5) / tileSize);
        const y = Math.floor((worldCoords.y + tileSize * 0.5) / tileSize);

        const gridSize = engine.state.gridSize;
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
          if (engine.build(x, y)) {
            uiManager.updateDisplay();
          } else if (engine.state.buildMode === "demolish") {
            engine.build(x, y);
            uiManager.updateDisplay();
          }
        }
      } catch (e) {
        console.error("❌ Build error:", e);
      }
    }

    // 現在の buildMode/selectedInfrastructure/selectedLandmark から、設置予定の TileType を導出する
    // （engine.build() 内の switch と同じ対応関係。engine 側は手を入れず main 側で読むだけ）。
    // "demolish" は削除対象であり新規設置タイルが無いため null を返す。
    function getPlannedTileType(): TileType | null {
      switch (engine.state.buildMode) {
        case "road":
          return TileType.ROAD;
        case "residential":
          return TileType.RESIDENTIAL_L1;
        case "commercial":
          return TileType.COMMERCIAL_L1;
        case "industrial":
          return TileType.INDUSTRIAL_L1;
        case "infrastructure":
          switch (engine.state.selectedInfrastructure) {
            case "station":
              return TileType.STATION;
            case "park":
              return TileType.PARK;
            case "police":
              return TileType.POLICE;
            case "fire_station":
              return TileType.FIRE_STATION;
            case "hospital":
              return TileType.HOSPITAL;
            case "school":
              return TileType.SCHOOL;
            case "power_plant":
              return TileType.POWER_PLANT;
            case "water_treatment":
              return TileType.WATER_TREATMENT;
            default:
              return TileType.STATION;
          }
        case "landmark":
          switch (engine.state.selectedLandmark) {
            case "stadium":
              return TileType.LANDMARK_STADIUM;
            case "airport":
              return TileType.LANDMARK_AIRPORT;
            default:
              return TileType.LANDMARK_STADIUM;
          }
        default:
          return null;
      }
    }

    // 設置予定の建設コストを engine.getCost() と同じ対応関係で算出する（BUILD_COSTS を直接参照）。
    function getPlannedCost(): number {
      const mode = engine.state.buildMode;
      if (mode === "infrastructure") {
        return BUILD_COSTS[engine.state.selectedInfrastructure] ?? 0;
      } else if (mode === "landmark") {
        return BUILD_COSTS[`landmark_${engine.state.selectedLandmark}`] ?? 0;
      }
      return BUILD_COSTS[mode] ?? 0;
    }

    // 設置予定タイルのフットプリントが「範囲内 かつ 全マス空き地 かつ 資金が足りる
    // （サンドボックス時は常にtrue）」であればホバープレビューを有効（緑）とする。
    function computeHoverValidity(tileType: TileType, x: number, y: number): boolean {
      const size = BUILDING_SIZES[tileType] || { width: 1, height: 1 };
      const gridSize = engine.state.gridSize;
      if (x < 0 || y < 0 || x + size.width > gridSize || y + size.height > gridSize) return false;

      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          if (engine.state.map[y + dy][x + dx] !== TileType.EMPTY) return false;
        }
      }

      if (!engine.state.settings.sandbox && engine.state.money < getPlannedCost()) return false;

      return true;
    }

    // canvas の CSS カーソルを buildMode に応じて更新する（削除モード中は crosshair）。
    function updateCursor(): void {
      canvas.style.cursor = engine.state.buildMode === "demolish" ? "crosshair" : "";
    }

    // マウスホバー中のタイル座標を算出し、renderer に建設ゴーストプレビュー用の状態を反映する。
    // buildAtMouse と同じ変換（CSS→canvas→world、タイル中心オフセット +tileSize*0.5）を使う。
    function updateHoverPreview(clientX: number, clientY: number): void {
      updateCursor();

      const rect = canvas.getBoundingClientRect();
      const { scaleX, scaleY } = getCanvasScale();
      const screenX = (clientX - rect.left) * scaleX;
      const screenY = (clientY - rect.top) * scaleY;

      const worldCoords = renderer.screenToWorld(screenX, screenY);
      const tileSize = getTileSize();
      const x = Math.floor((worldCoords.x + tileSize * 0.5) / tileSize);
      const y = Math.floor((worldCoords.y + tileSize * 0.5) / tileSize);

      renderer.hoverTile = { x, y };

      if (engine.state.buildMode === "demolish") {
        renderer.hoverSize = { width: 1, height: 1 };
        renderer.hoverValid = false;
        return;
      }

      const tileType = getPlannedTileType();
      if (tileType === null) {
        renderer.hoverTile = null;
        return;
      }

      renderer.hoverSize = BUILDING_SIZES[tileType] || { width: 1, height: 1 };
      renderer.hoverValid = computeHoverValidity(tileType, x, y);
    }

    // ポインターダウン処理（マウス用）
    function handlePointerDown(
      clientX: number,
      clientY: number,
      isRightClick: boolean = false,
    ): void {
      isMouseDown = true;
      dragStartX = clientX;
      dragStartY = clientY;
      lastCameraOffsetX = renderer.cameraOffsetX;
      lastCameraOffsetY = renderer.cameraOffsetY;

      // 右クリック: カメラドラッグ開始
      if (isRightClick) {
        isDragging = true;
        return;
      }

      // 左クリック: 敷設
      buildAtMouse(clientX, clientY);
    }

    // ポインタームーブ処理（マウス用）
    function handlePointerMove(clientX: number, clientY: number): void {
      const rect = canvas.getBoundingClientRect();
      const { scaleX, scaleY } = getCanvasScale();

      if (isDragging) {
        // 右ドラッグ: カメラ移動
        // マウス移動量はCSSピクセルだが、キャンバス座標系に合わせてスケール
        const deltaX = (clientX - dragStartX) * scaleX;
        const deltaY = (clientY - dragStartY) * scaleY;
        renderer.cameraOffsetX = lastCameraOffsetX + deltaX;
        renderer.cameraOffsetY = lastCameraOffsetY + deltaY;
        clampCamera();
      } else if (isMouseDown && engine.state.buildMode !== "demolish") {
        // 左ドラッグ: 線を引いて敷設
        const currentScreenX = (clientX - rect.left) * scaleX;
        const currentScreenY = (clientY - rect.top) * scaleY;
        const startScreenX = (dragStartX - rect.left) * scaleX;
        const startScreenY = (dragStartY - rect.top) * scaleY;

        const startWorldCoords = renderer.screenToWorld(startScreenX, startScreenY);
        const currentWorldCoords = renderer.screenToWorld(currentScreenX, currentScreenY);

        const tileSize = getTileSize();
        const startX = Math.floor(startWorldCoords.x / tileSize);
        const startY = Math.floor(startWorldCoords.y / tileSize);
        const endX = Math.floor(currentWorldCoords.x / tileSize);
        const endY = Math.floor(currentWorldCoords.y / tileSize);

        const gridSize = engine.state.gridSize;
        const tilesOnLine = bresenhamLine(startX, startY, endX, endY);
        tilesOnLine.forEach(({ x, y }) => {
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            engine.build(x, y);
          }
        });

        dragStartX = clientX;
        dragStartY = clientY;
        uiManager.updateDisplay();
      }
    }

    // ポインターアップ処理（マウス用）
    function handlePointerUp(): void {
      isDragging = false;
      isMouseDown = false;
    }

    // マウスイベント
    canvas.addEventListener("mousedown", (e) => {
      const coords = getClientCoordinates(e);
      handlePointerDown(coords.clientX, coords.clientY, e.button === 2);
      e.preventDefault();
    });

    canvas.addEventListener("mousemove", (e) => {
      const coords = getClientCoordinates(e);
      handlePointerMove(coords.clientX, coords.clientY);
      updateHoverPreview(coords.clientX, coords.clientY);
      e.preventDefault();
    });

    canvas.addEventListener("mouseup", () => {
      handlePointerUp();
    });

    canvas.addEventListener("mouseleave", () => {
      handlePointerUp();
      renderer.hoverTile = null;
    });

    // タッチイベント（モバイル専用・全面改修）
    // 1本指タップ/ドラッグ: 建設・連続描画
    // 2本指ドラッグ: カメラ移動（パン）
    // 2本指ピンチ: ズームイン/アウト

    function getTouchDist(touches: TouchList): number {
      return Math.hypot(
        touches[1].clientX - touches[0].clientX,
        touches[1].clientY - touches[0].clientY,
      );
    }

    function getTouchCenter(touches: TouchList): { x: number; y: number } {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    }

    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        // タッチ操作中はゴーストプレビューを表示しない
        renderer.hoverTile = null;

        if (e.touches.length === 1) {
          // 1本指: 建設モード開始
          touchMode = "building";
          const touch = e.touches[0];
          isMouseDown = true;
          dragStartX = touch.clientX;
          dragStartY = touch.clientY;
          lastCameraOffsetX = renderer.cameraOffsetX;
          lastCameraOffsetY = renderer.cameraOffsetY;
          buildAtMouse(touch.clientX, touch.clientY);
        } else if (e.touches.length === 2) {
          // 2本指: パン＋ピンチモード開始（建設キャンセル）
          touchMode = "panning";
          isMouseDown = false;

          const center = getTouchCenter(e.touches);
          pinchLastDist = getTouchDist(e.touches);
          dragStartX = center.x;
          dragStartY = center.y;
          lastCameraOffsetX = renderer.cameraOffsetX;
          lastCameraOffsetY = renderer.cameraOffsetY;
        }
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        // タッチ操作中はゴーストプレビューを表示しない
        renderer.hoverTile = null;

        if (touchMode === "building" && e.touches.length === 1) {
          // 1本指ドラッグ: Bresenhamで連続建設
          const touch = e.touches[0];
          if (engine.state.buildMode !== "demolish") {
            const rect = canvas.getBoundingClientRect();
            const { scaleX, scaleY } = getCanvasScale();

            const startScreenX = (dragStartX - rect.left) * scaleX;
            const startScreenY = (dragStartY - rect.top) * scaleY;
            const currentScreenX = (touch.clientX - rect.left) * scaleX;
            const currentScreenY = (touch.clientY - rect.top) * scaleY;

            const startWorld = renderer.screenToWorld(startScreenX, startScreenY);
            const currentWorld = renderer.screenToWorld(currentScreenX, currentScreenY);

            const tileSize = getTileSize();
            const startTileX = Math.floor(startWorld.x / tileSize);
            const startTileY = Math.floor(startWorld.y / tileSize);
            const endTileX = Math.floor(currentWorld.x / tileSize);
            const endTileY = Math.floor(currentWorld.y / tileSize);

            const gridSize = engine.state.gridSize;
            bresenhamLine(startTileX, startTileY, endTileX, endTileY).forEach(({ x, y }) => {
              if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                engine.build(x, y);
              }
            });
            uiManager.updateDisplay();
          }
          dragStartX = touch.clientX;
          dragStartY = touch.clientY;
        } else if (touchMode === "panning" && e.touches.length === 2) {
          // 2本指: パン + ピンチズーム
          const center = getTouchCenter(e.touches);
          const currentDist = getTouchDist(e.touches);

          // パン（中心点の移動量）
          const deltaX = center.x - dragStartX;
          const deltaY = center.y - dragStartY;
          renderer.cameraOffsetX = lastCameraOffsetX + deltaX * getCanvasScale().scaleX;
          renderer.cameraOffsetY = lastCameraOffsetY + deltaY * getCanvasScale().scaleY;

          // ピンチズーム（距離の変化比率でズーム倍率を調整）
          if (pinchLastDist > 0) {
            const distRatio = currentDist / pinchLastDist;
            const oldZoom = renderer.zoomLevel;
            const newZoom = Math.max(1.0, Math.min(3.0, oldZoom * distRatio));

            // ピンチ中心を基点にズーム
            const rect = canvas.getBoundingClientRect();
            const { scaleX, scaleY } = getCanvasScale();
            const cx = (center.x - rect.left) * scaleX;
            const cy = (center.y - rect.top) * scaleY;
            const zoomChange = newZoom - oldZoom;
            renderer.cameraOffsetX -= (cx * zoomChange) / oldZoom;
            renderer.cameraOffsetY -= (cy * zoomChange) / oldZoom;
            renderer.zoomLevel = newZoom;
          }

          pinchLastDist = currentDist;
          // 次フレーム用に基準点を更新
          lastCameraOffsetX = renderer.cameraOffsetX;
          lastCameraOffsetY = renderer.cameraOffsetY;
          dragStartX = center.x;
          dragStartY = center.y;

          clampCamera();
        }
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        if (e.touches.length === 0) {
          // 全指が離れた: 状態リセット
          touchMode = "idle";
          isMouseDown = false;
        } else if (e.touches.length === 1 && touchMode === "panning") {
          // 2本指→1本指: パンモードを維持してビルドしない
          touchMode = "idle";
          isMouseDown = false;
        }
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchcancel",
      (e) => {
        e.preventDefault();
        touchMode = "idle";
        isMouseDown = false;
      },
      { passive: false },
    );

    // マウスホイール: ズーム
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();

        const zoomSpeed = 0.1;
        const oldZoom = renderer.zoomLevel;
        renderer.zoomLevel += e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        renderer.zoomLevel = Math.max(1.0, Math.min(3, renderer.zoomLevel));

        const rect = canvas.getBoundingClientRect();
        const { scaleX, scaleY } = getCanvasScale();
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        const zoomChange = renderer.zoomLevel - oldZoom;
        renderer.cameraOffsetX -= (mouseX * zoomChange) / oldZoom;
        renderer.cameraOffsetY -= (mouseY * zoomChange) / oldZoom;

        clampCamera();
      },
      { passive: false },
    );

    // キーボード操作
    // R/S/C/I/U/D=カテゴリ切替、Space=一時停止トグル、1/2/3=速度切替。
    // モーダルの入力欄等にフォーカスがある時はショートカットを無効化する。
    document.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTypingTarget =
        target?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (isTypingTarget) return;

      switch (e.key.toLowerCase()) {
        case "r":
          uiManager.selectCategory("road");
          updateCursor();
          break;
        case "s":
          uiManager.selectCategory("residential");
          updateCursor();
          break;
        case "c":
          uiManager.selectCategory("commercial");
          updateCursor();
          break;
        case "i":
          uiManager.selectCategory("industrial");
          updateCursor();
          break;
        case "u":
          uiManager.selectCategory("infrastructure");
          updateCursor();
          break;
        case "d":
          uiManager.selectCategory("demolish");
          updateCursor();
          break;
        case " ":
          e.preventDefault();
          uiManager.setSpeed(engine.state.gameSpeed === 0 ? 1 : 0);
          break;
        case "1":
          uiManager.setSpeed(0.5);
          break;
        case "2":
          uiManager.setSpeed(1);
          break;
        case "3":
          uiManager.setSpeed(2);
          break;
      }
    });

    // 右クリックメニューを無効化
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    // ゲーム開始
    console.log("🚀 Game loop started");
    gameLoop();
  } catch (e) {
    console.error("❌ Initialization error:", e);
    showToast("ゲームの初期化に失敗しました。ブラウザのコンソールを確認してください。", "error");
  }
}

void initializeGame();
