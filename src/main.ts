import "./style.css";
import { GameEngine, GameSettings } from "./engine";
import { Renderer } from "./renderer";
import { StorageManager } from "./storage";
import { UIManager } from "./ui";
import { setMapSize, getCanvasSize, getTileSize, GAME_VERSION } from "./constants";

// ページタイトルを動的に更新
document.title = `Easy Cities 2D (ver.${GAME_VERSION})`;
const titleElement = document.getElementById("app-title");
if (titleElement) {
  titleElement.textContent = `Easy Cities 2D (ver.${GAME_VERSION})`;
}

console.log(`🎮 Easy Cities 2D (ver.${GAME_VERSION}) - Initializing...`);

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
if (!canvas) {
  console.error("❌ Canvas element not found!");
  throw new Error("Canvas element not found");
}

console.log("✅ Canvas found:", canvas);

// ゲーム開始前の設定画面
function showInitialSettings(): Promise<GameSettings> {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.zIndex = "10000";
    modal.innerHTML = `
      <div class="modal-content" style="min-width: min(450px, 90vw);">
        <h2>🎮 Easy Cities 2D (ver.${GAME_VERSION})</h2>
        <p>ゲーム設定を選択してください</p>
        
        <div style="margin: 20px 0;">
          <h3>マップサイズ</h3>
          <label><input type="radio" name="mapsize" value="small"> 小（512x512） - 64x64グリッド</label><br>
          <label><input type="radio" name="mapsize" value="medium" checked> 中（1024x1024） - 128x128グリッド</label><br>
          <label><input type="radio" name="mapsize" value="large"> 大（2048x2048） - 256x256グリッド</label>
        </div>
        
        <div style="margin: 20px 0;">
          <h3>難易度</h3>
          <label><input type="radio" name="difficulty" value="easy" checked> イージー（資金多）</label><br>
          <label><input type="radio" name="difficulty" value="normal"> ノーマル</label><br>
          <label><input type="radio" name="difficulty" value="hard"> ハード（資金少）</label>
        </div>
        
        <div style="margin: 20px 0;">
          <h3>ゲームシステム</h3>
          <label><input type="checkbox" id="init-sandbox"> 🎮 サンドボックスモード（資金∞）</label><br>
          <label><input type="checkbox" id="init-disasters"> 災害システムを有効にする</label><br>
          <label><input type="checkbox" id="init-pollution"> 公害システムを有効にする</label><br>
          <label><input type="checkbox" id="init-slum"> スラム化システムを有効にする</label>
        </div>
        
        <div class="modal-buttons">
          <button id="btn-start-game" class="btn-primary">ゲーム開始</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btn-start-game")?.addEventListener("click", () => {
      const mapSize =
        (document.querySelector('input[name="mapsize"]:checked') as HTMLInputElement)?.value ||
        "medium";
      const difficulty =
        (document.querySelector('input[name="difficulty"]:checked') as HTMLInputElement)?.value ||
        "normal";
      const settings: GameSettings = {
        mapSize: mapSize as any,
        difficulty: difficulty as any,
        sandbox: (document.getElementById("init-sandbox") as HTMLInputElement)?.checked || false,
        disastersEnabled:
          (document.getElementById("init-disasters") as HTMLInputElement)?.checked || false,
        pollutionEnabled:
          (document.getElementById("init-pollution") as HTMLInputElement)?.checked || false,
        slumEnabled: (document.getElementById("init-slum") as HTMLInputElement)?.checked || false,
      };
      modal.remove();
      resolve(settings);
    });
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

    // ゲームループ
    function gameLoop(): void {
      try {
        // ポーズ状態でない場合のみ成長処理
        if (!engine.state.paused && engine.state.gameSpeed > 0) {
          // 成長処理（毎フレーム）
          engine.grow();

          // 月次更新（ゲーム速度に応じたフレームカウント）
          // gameSpeed: 0.5 = 遅い（40フレーム）、1 = 通常（20フレーム）、2 = 高速（10フレーム）
          const updateInterval = Math.max(1, Math.round(20 / engine.state.gameSpeed));
          monthCounter++;
          if (monthCounter >= updateInterval) {
            engine.monthlyUpdate();
            monthCounter = 0;
          }
        }
        // ポーズ中はカウンターはそのまま保持

        // 描画
        renderer.draw();

        // UI更新
        uiManager.updateDisplay();

        requestAnimationFrame(gameLoop);
      } catch (e) {
        console.error("❌ Game loop error:", e);
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
      e.preventDefault();
    });

    canvas.addEventListener("mouseup", () => {
      handlePointerUp();
    });

    canvas.addEventListener("mouseleave", () => {
      handlePointerUp();
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
    document.addEventListener("keydown", (e) => {
      switch (e.key.toLowerCase()) {
        case "r":
          engine.state.buildMode = "road";
          break;
        case "s":
          engine.state.buildMode = "residential";
          break;
        case "c":
          engine.state.buildMode = "commercial";
          break;
        case "i":
          engine.state.buildMode = "industrial";
          break;
        case "u":
          engine.state.buildMode = "infrastructure";
          break;
        case "d":
          engine.state.buildMode = "demolish";
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
    alert("ゲームの初期化に失敗しました。ブラウザのコンソールを確認してください。");
  }
}

void initializeGame();
