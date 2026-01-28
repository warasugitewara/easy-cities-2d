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
      const x = Math.floor((e.clientX - rect.left) / (CANVAS_SIZE / 128));
      const y = Math.floor((e.clientY - rect.top) / (CANVAS_SIZE / 128));

      if (engine.build(x, y)) {
        uiManager.updateDisplay();
      } else if (engine.state.buildMode === 'demolish') {
        engine.build(x, y);
        uiManager.updateDisplay();
      }
    } catch (e) {
      console.error('❌ Build error:', e);
    }
  }

  // マウスダウン: 長押し開始
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
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

  // マウスムーブ: 移動中に敷設（連続モード有効時）
  canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown && continuousModeEnabled && engine.state.buildMode !== 'demolish') {
      buildAtMouse(e);
    }
  });

  // マウスアップ: 長押し終了
  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
    if (continuousIntervalId !== null) {
      clearInterval(continuousIntervalId);
      continuousIntervalId = null;
    }
  });

  // マウスが離れた場合も終了
  canvas.addEventListener('mouseleave', () => {
    isMouseDown = false;
    if (continuousIntervalId !== null) {
      clearInterval(continuousIntervalId);
      continuousIntervalId = null;
    }
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

  // マウスホイール（ズーム機能は将来実装）
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
  });

  // ゲーム開始
  console.log('🚀 Game loop started');
  gameLoop();
} catch (e) {
  console.error('❌ Initialization error:', e);
  alert('ゲームの初期化に失敗しました。ブラウザのコンソールを確認してください。');
}
