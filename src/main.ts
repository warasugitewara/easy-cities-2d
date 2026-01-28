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

  // キャンバスクリック処理
  canvas.addEventListener('click', (e) => {
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
      console.error('❌ Click error:', e);
    }
  });

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
