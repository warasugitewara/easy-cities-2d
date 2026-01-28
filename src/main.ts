import './style.css';
import { GameEngine } from './engine';
import { Renderer } from './renderer';
import { StorageManager } from './storage';
import { UIManager } from './ui';
import { CANVAS_SIZE } from './constants';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const engine = new GameEngine();
const renderer = new Renderer(canvas, engine);
const storage = new StorageManager();
const uiManager = new UIManager(engine, storage);

let monthCounter = 0;

// ゲームループ
function gameLoop(): void {
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
}

// キャンバスクリック処理
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (CANVAS_SIZE / 128));
  const y = Math.floor((e.clientY - rect.top) / (CANVAS_SIZE / 128));

  if (engine.build(x, y)) {
    uiManager.updateDisplay();
  } else if (engine.state.buildMode === 'demolish') {
    engine.build(x, y);
    uiManager.updateDisplay();
  }
});

// マウスホイール（ズーム機能は将来実装）
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
});

// ゲーム開始
gameLoop();
