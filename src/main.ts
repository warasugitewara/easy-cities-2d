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

  // 敷設処理（共通）
  function buildAtMouse(e: MouseEvent): void {
    try {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

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

  // マウスダウン: 長押し開始 または ドラッグ開始
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    lastCameraOffsetX = renderer.cameraOffsetX;
    lastCameraOffsetY = renderer.cameraOffsetY;

    // 右クリック: ドラッグ開始フラグ
    if (e.button === 2) {
      isDragging = true;
      e.preventDefault();
      return;
    }

    // 左クリック: 敷設
    buildAtMouse(e);

    // 連続モードが有効な場合、定期的に敷設
    if (continuousModeEnabled && engine.state.buildMode !== 'demolish') {
      continuousIntervalId = window.setInterval(() => {
        if (isMouseDown) {
          buildAtMouse(e);
        }
      }, 100);
    }
  });

  // マウスムーブ: ドラッグ処理 または 移動中敷設
  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      // ドラッグ中: カメラ移動
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      renderer.cameraOffsetX = lastCameraOffsetX + deltaX;
      renderer.cameraOffsetY = lastCameraOffsetY + deltaY;

      // カメラをクランプして、マップが画面外に出ないようにする
      const mapWidth = 128 * 8 * renderer.zoomLevel; // GRID_SIZE * TILE_SIZE * zoom
      const mapHeight = 128 * 8 * renderer.zoomLevel;
      const maxOffsetX = mapWidth - CANVAS_SIZE;
      const maxOffsetY = mapHeight - CANVAS_SIZE;

      renderer.cameraOffsetX = Math.max(-maxOffsetX, Math.min(0, renderer.cameraOffsetX));
      renderer.cameraOffsetY = Math.max(-maxOffsetY, Math.min(0, renderer.cameraOffsetY));

      e.preventDefault();
    } else if (isMouseDown && continuousModeEnabled && engine.state.buildMode !== 'demolish') {
      // 移動中敷設
      buildAtMouse(e);
    }
  });

  // マウスアップ: ドラッグ終了 または 敷設終了
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
      isDragging = false;
    }
    isMouseDown = false;
    if (continuousIntervalId !== null) {
      clearInterval(continuousIntervalId);
      continuousIntervalId = null;
    }
  });

  // マウスが離れた場合も終了
  canvas.addEventListener('mouseleave', () => {
    isMouseDown = false;
    isDragging = false;
    if (continuousIntervalId !== null) {
      clearInterval(continuousIntervalId);
      continuousIntervalId = null;
    }
  });

  // マウスホイール: ズーム
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const zoomSpeed = 0.1;
    const oldZoom = renderer.zoomLevel;
    renderer.zoomLevel += e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    
    // グリッド全体が画面に収まる最小ズーム: 1024px (128 * 8) / 1024px = 1.0
    // 最大ズーム: 3倍
    renderer.zoomLevel = Math.max(1.0, Math.min(3, renderer.zoomLevel));

    // ズーム中心をマウス位置にする
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomChange = renderer.zoomLevel - oldZoom;
    renderer.cameraOffsetX -= mouseX * zoomChange / oldZoom;
    renderer.cameraOffsetY -= mouseY * zoomChange / oldZoom;

    // カメラをクランプして、マップが画面外に出ないようにする
    const mapWidth = 128 * 8 * renderer.zoomLevel; // GRID_SIZE * TILE_SIZE * zoom
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
