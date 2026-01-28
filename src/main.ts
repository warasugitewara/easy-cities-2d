import './style.css';
import { GameEngine } from './engine';
import { Renderer } from './renderer';
import { StorageManager } from './storage';
import { UIManager } from './ui';
import { CANVAS_SIZE } from './constants';

console.log('🎮 Easy Cities 2D - Initializing...');

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
  console.error('❌ Canvas element not found!');
  throw new Error('Canvas element not found');
}

console.log('✅ Canvas found:', canvas);

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

try {
  const engine = new GameEngine();
  const renderer = new Renderer(canvas, engine);
  const storage = new StorageManager();
  const uiManager = new UIManager(engine, storage);

  console.log('✅ Game engine initialized');

  let monthCounter = 0;
  let continuousModeEnabled = false;
  let isMouseDown = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastCameraOffsetX = 0;
  let lastCameraOffsetY = 0;
  let continuousIntervalId: number | null = null;

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
      const x = Math.floor(worldCoords.x / 8); // TILE_SIZE = 8
      const y = Math.floor(worldCoords.y / 8);

      if (x >= 0 && x < 128 && y >= 0 && y < 128) {
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

    // 連続モードが有効な場合、定期的に敷設
    if (continuousModeEnabled && engine.state.buildMode !== 'demolish') {
      continuousIntervalId = window.setInterval(() => {
        if (isMouseDown) {
          buildAtMouse(clientX, clientY);
        }
      }, 100);
    }
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
      const mapWidth = 128 * 8 * renderer.zoomLevel;
      const mapHeight = 128 * 8 * renderer.zoomLevel;
      const maxOffsetX = mapWidth - CANVAS_SIZE;
      const maxOffsetY = mapHeight - CANVAS_SIZE;

      renderer.cameraOffsetX = Math.max(-maxOffsetX, Math.min(0, renderer.cameraOffsetX));
      renderer.cameraOffsetY = Math.max(-maxOffsetY, Math.min(0, renderer.cameraOffsetY));
    } else if (isMouseDown && engine.state.buildMode !== 'demolish') {
      // 左ドラッグ敷設
      const rect = canvas.getBoundingClientRect();
      const currentScreenX = clientX - rect.left;
      const currentScreenY = clientY - rect.top;

      const startWorldCoords = renderer.screenToWorld(dragStartX - rect.left, dragStartY - rect.top);
      const currentWorldCoords = renderer.screenToWorld(currentScreenX, currentScreenY);

      const startX = Math.floor(startWorldCoords.x / 8);
      const startY = Math.floor(startWorldCoords.y / 8);
      const endX = Math.floor(currentWorldCoords.x / 8);
      const endY = Math.floor(currentWorldCoords.y / 8);

      const tilesOnLine = bresenhamLine(startX, startY, endX, endY);
      tilesOnLine.forEach(({ x, y }) => {
        if (x >= 0 && x < 128 && y >= 0 && y < 128) {
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
    if (continuousIntervalId !== null) {
      clearInterval(continuousIntervalId);
      continuousIntervalId = null;
    }
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

  // 連続敷設モード切り替え
  function toggleContinuousMode(): boolean {
    continuousModeEnabled = !continuousModeEnabled;
    console.log(`🔄 連続敷設モード: ${continuousModeEnabled ? 'ON' : 'OFF'}`);
    return continuousModeEnabled;
  }

  // グローバルスコープに公開（UIからアクセスするため）
  (window as any).toggleContinuousMode = toggleContinuousMode;
  (window as any).getContinuousModeState = () => continuousModeEnabled;

  // キーボード操作
  document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'r':
        engine.state.buildMode = 'road';
        break;
      case 's':
        engine.state.buildMode = 'station';
        break;
      case 'p':
        engine.state.buildMode = 'park';
        break;
      case 'd':
        engine.state.buildMode = 'demolish';
        break;
      case 'c':
        toggleContinuousMode();
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
