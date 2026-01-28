import './style.css';
import { GameEngine, GameSettings } from './engine';
import { Renderer } from './renderer';
import { StorageManager } from './storage';
import { UIManager } from './ui';
import { MAP_SIZES, MapSize, setMapSize, getCanvasSize, getTileSize } from './constants';

console.log('🎮 Easy Cities 2D - Initializing...');

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
  console.error('❌ Canvas element not found!');
  throw new Error('Canvas element not found');
}

console.log('✅ Canvas found:', canvas);

// ゲーム開始前の設定画面
function showInitialSettings(): Promise<GameSettings> {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
      <div class="modal-content" style="min-width: 450px;">
        <h2>🎮 Easy Cities 2D</h2>
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

    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      const mapSize = (document.querySelector('input[name="mapsize"]:checked') as HTMLInputElement)?.value || 'medium';
      const difficulty = (document.querySelector('input[name="difficulty"]:checked') as HTMLInputElement)?.value || 'normal';
      const settings: GameSettings = {
        mapSize: mapSize as any,
        difficulty: difficulty as any,
        disastersEnabled: (document.getElementById('init-disasters') as HTMLInputElement)?.checked || false,
        pollutionEnabled: (document.getElementById('init-pollution') as HTMLInputElement)?.checked || false,
        slumEnabled: (document.getElementById('init-slum') as HTMLInputElement)?.checked || false,
      };
      modal.remove();
      resolve(settings);
    });
  });
}

// Bresenhamのラインアルゴリズム: 2点間の直線上のタイルを取得
function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
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

  // キャンバスサイズを設定
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  try {
    const engine = new GameEngine(settings);
    const renderer = new Renderer(canvas, engine);
    const storage = new StorageManager();
    const uiManager = new UIManager(engine, storage);

    console.log('✅ Game engine initialized with settings:', settings);

    let monthCounter = 0;
    let isMouseDown = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let lastCameraOffsetX = 0;
    let lastCameraOffsetY = 0;

    // ゲームループ
    function gameLoop(): void {
      try {
        // 成長処理（毎フレーム）
        engine.grow();

        // 月次更新（20フレームごと）
        monthCounter++;
        if (monthCounter >= 20) {
          engine.monthlyUpdate();
          monthCounter = 0;
        }

        // 描画
        renderer.draw();

        // UI更新
        uiManager.updateDisplay();

        requestAnimationFrame(gameLoop);
      } catch (e) {
        console.error('❌ Game loop error:', e);
      }
    }

    // スクリーン座標を取得（マウス/タッチ両対応）
    function getClientCoordinates(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
      if ('touches' in e && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      } else if (e instanceof MouseEvent) {
        return { clientX: e.clientX, clientY: e.clientY };
      }
      return { clientX: 0, clientY: 0 };
    }

    // 敷設処理（共通）
    function buildAtMouse(clientX: number, clientY: number): void {
      try {
        const rect = canvas.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        // スクリーン座標をワールド座標に変換
        const worldCoords = renderer.screenToWorld(screenX, screenY);
        const tileSize = getTileSize();
        const x = Math.floor(worldCoords.x / tileSize);
        const y = Math.floor(worldCoords.y / tileSize);

        const gridSize = engine.state.gridSize;
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
          if (engine.build(x, y)) {
            uiManager.updateDisplay();
          } else if (engine.state.buildMode === 'demolish') {
            engine.build(x, y);
            uiManager.updateDisplay();
          }
        }
      } catch (e) {
        console.error('❌ Build error:', e);
      }
    }

    // ポインターダウン処理（マウス＆タッチ共用）
    function handlePointerDown(clientX: number, clientY: number, isRightClick: boolean = false): void {
      isMouseDown = true;
      dragStartX = clientX;
      dragStartY = clientY;
      lastCameraOffsetX = renderer.cameraOffsetX;
      lastCameraOffsetY = renderer.cameraOffsetY;

      // 右クリック: ドラッグ開始フラグ
      if (isRightClick) {
        isDragging = true;
        return;
      }

      // 左クリック: 敷設
      buildAtMouse(clientX, clientY);
    }

    // ポインタームーブ処理（マウス＆タッチ共用）
    function handlePointerMove(clientX: number, clientY: number): void {
      if (isDragging) {
        // ドラッグ中: カメラ移動
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;
        renderer.cameraOffsetX = lastCameraOffsetX + deltaX;
        renderer.cameraOffsetY = lastCameraOffsetY + deltaY;

        // カメラをクランプして、マップが画面外に出ないようにする
        const gridSize = engine.state.gridSize;
        const tileSize = getTileSize();
        const mapWidth = gridSize * tileSize * renderer.zoomLevel;
        const mapHeight = gridSize * tileSize * renderer.zoomLevel;
        const canvasSize = getCanvasSize();
        const maxOffsetX = mapWidth - canvasSize;
        const maxOffsetY = mapHeight - canvasSize;

        renderer.cameraOffsetX = Math.max(-maxOffsetX, Math.min(0, renderer.cameraOffsetX));
        renderer.cameraOffsetY = Math.max(-maxOffsetY, Math.min(0, renderer.cameraOffsetY));
      } else if (isMouseDown && engine.state.buildMode !== 'demolish') {
        // 左ドラッグ敷設
        const rect = canvas.getBoundingClientRect();
        const currentScreenX = clientX - rect.left;
        const currentScreenY = clientY - rect.top;

        const startWorldCoords = renderer.screenToWorld(dragStartX - rect.left, dragStartY - rect.top);
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

    // ポインターアップ処理
    function handlePointerUp(): void {
      isDragging = false;
      isMouseDown = false;
    }

    // マウスイベント
    canvas.addEventListener('mousedown', (e) => {
      const coords = getClientCoordinates(e);
      handlePointerDown(coords.clientX, coords.clientY, e.button === 2);
      e.preventDefault();
    });

    canvas.addEventListener('mousemove', (e) => {
      const coords = getClientCoordinates(e);
      handlePointerMove(coords.clientX, coords.clientY);
      e.preventDefault();
    });

    canvas.addEventListener('mouseup', (e) => {
      handlePointerUp();
    });

    canvas.addEventListener('mouseleave', () => {
      handlePointerUp();
    });

    // タッチイベント
    canvas.addEventListener('touchstart', (e) => {
      const coords = getClientCoordinates(e);
      handlePointerDown(coords.clientX, coords.clientY, false);
      e.preventDefault();
    });

    canvas.addEventListener('touchmove', (e) => {
      const coords = getClientCoordinates(e);
      handlePointerMove(coords.clientX, coords.clientY);
      e.preventDefault();
    });

    canvas.addEventListener('touchend', (e) => {
      handlePointerUp();
      e.preventDefault();
    });

    canvas.addEventListener('touchcancel', (e) => {
      handlePointerUp();
      e.preventDefault();
    });

    // マウスホイール: ズーム
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const zoomSpeed = 0.1;
      const oldZoom = renderer.zoomLevel;
      renderer.zoomLevel += e.deltaY > 0 ? -zoomSpeed : zoomSpeed;

      renderer.zoomLevel = Math.max(1.0, Math.min(3, renderer.zoomLevel));

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomChange = renderer.zoomLevel - oldZoom;
      renderer.cameraOffsetX -= mouseX * zoomChange / oldZoom;
      renderer.cameraOffsetY -= mouseY * zoomChange / oldZoom;

      const mapWidth = 128 * 8 * renderer.zoomLevel;
      const mapHeight = 128 * 8 * renderer.zoomLevel;
      const maxOffsetX = mapWidth - CANVAS_SIZE;
      const maxOffsetY = mapHeight - CANVAS_SIZE;

      renderer.cameraOffsetX = Math.max(-maxOffsetX, Math.min(0, renderer.cameraOffsetX));
      renderer.cameraOffsetY = Math.max(-maxOffsetY, Math.min(0, renderer.cameraOffsetY));

      console.log(`🔍 Zoom: ${renderer.zoomLevel.toFixed(2)}x`);
    });

    // キーボード操作
    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'r':
          engine.state.buildMode = 'road';
          break;
        case 's':
          engine.state.buildMode = 'residential';
          break;
        case 'c':
          engine.state.buildMode = 'commercial';
          break;
        case 'i':
          engine.state.buildMode = 'industrial';
          break;
        case 'u':
          engine.state.buildMode = 'infrastructure';
          break;
        case 'd':
          engine.state.buildMode = 'demolish';
          break;
      }
    });

    // 右クリックメニューを無効化
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // ゲーム開始
    console.log('🚀 Game loop started');
    gameLoop();
  } catch (e) {
    console.error('❌ Initialization error:', e);
    alert('ゲームの初期化に失敗しました。ブラウザのコンソールを確認してください。');
  }
}

initializeGame();
