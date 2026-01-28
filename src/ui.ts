import { GameEngine } from './engine';
import { StorageManager } from './storage';

export class UIManager {
  private engine: GameEngine;
  private storage: StorageManager;
  private currentSlot: number = 0;

  constructor(engine: GameEngine, storage: StorageManager) {
    this.engine = engine;
    this.storage = storage;
    this.setupUI();
  }

  private setupUI(): void {
    const uiContainer = document.getElementById('ui-container')!;

    // ダッシュボード
    const dashboard = document.createElement('div');
    dashboard.id = 'dashboard';
    dashboard.className = 'dashboard';
    dashboard.innerHTML = `
      <div class="stat-panel">
        <div class="stat-item">
          <span class="stat-label">人口</span>
          <span class="stat-value" id="stat-population">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">資金</span>
          <span class="stat-value" id="stat-money">¥250,000</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">快適度</span>
          <span class="stat-value" id="stat-comfort">50</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">月</span>
          <span class="stat-value" id="stat-month">0</span>
        </div>
      </div>
    `;
    uiContainer.appendChild(dashboard);

    // ツールバー
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.innerHTML = `
      <div class="tool-group">
        <button class="tool-btn" data-mode="road" title="道路 (R)">🛣 道路</button>
        <button class="tool-btn" data-mode="station" title="駅 (S)">🚉 駅</button>
        <button class="tool-btn" data-mode="park" title="公園 (P)">🌳 公園</button>
        <button class="tool-btn" data-mode="demolish" title="解体 (D)">🗑 解体</button>
      </div>
      <div class="speed-group">
        <button class="speed-btn" data-speed="0" title="停止">⏸ 停止</button>
        <button class="speed-btn" data-speed="0.02" title="通常">▶ 通常</button>
        <button class="speed-btn" data-speed="0.05" title="高速">⚡ 高速</button>
        <button class="speed-btn" data-speed="0.1" title="超高速">🚀 超高速</button>
      </div>
      <div class="save-group">
        <button class="save-btn" id="save-btn">💾 セーブ</button>
        <button class="load-btn" id="load-btn">📂 ロード</button>
        <button class="export-btn" id="export-btn">📤 エクスポート</button>
        <button class="import-btn" id="import-btn">📥 インポート</button>
      </div>
      <div class="reset-group">
        <button class="reset-btn" id="reset-btn">🔄 リセット</button>
      </div>
    `;
    uiContainer.appendChild(toolbar);

    // セーブスロット管理
    const slotManager = document.createElement('div');
    slotManager.className = 'slot-manager';
    slotManager.innerHTML = `
      <div class="slot-label">セーブスロット:</div>
      <div class="slot-buttons">
        <button class="slot-btn" data-slot="0">スロット1</button>
        <button class="slot-btn" data-slot="1">スロット2</button>
        <button class="slot-btn" data-slot="2">スロット3</button>
      </div>
      <div id="slot-info" class="slot-info"></div>
    `;
    uiContainer.appendChild(slotManager);

    this.attachEventListeners();
    this.updateDisplay();
  }

  private attachEventListeners(): void {
    // ツールモード切り替え
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = (e.target as HTMLElement).getAttribute('data-mode') as 'road' | 'station' | 'park' | 'demolish';
        this.engine.state.buildMode = mode;
        this.updateToolSelection();
      });
    });

    // 速度変更
    document.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const speed = parseFloat((e.target as HTMLElement).getAttribute('data-speed')!);
        this.engine.setGrowthRate(speed);
        this.engine.state.paused = speed === 0;
      });
    });

    // スロット選択
    document.querySelectorAll('.slot-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.currentSlot = parseInt((e.target as HTMLElement).getAttribute('data-slot')!);
        this.updateSlotDisplay();
      });
    });

    // セーブ/ロード
    document.getElementById('save-btn')?.addEventListener('click', () => {
      this.save();
    });

    document.getElementById('load-btn')?.addEventListener('click', () => {
      this.load();
    });

    // エクスポート/インポート
    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.export();
    });

    document.getElementById('import-btn')?.addEventListener('click', () => {
      this.import();
    });

    // リセット
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      if (confirm('ゲームをリセットしますか？')) {
        this.engine.reset();
        this.updateDisplay();
      }
    });

    // キーボード操作
    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'r':
          this.engine.state.buildMode = 'road';
          this.updateToolSelection();
          break;
        case 's':
          this.engine.state.buildMode = 'station';
          this.updateToolSelection();
          break;
        case 'p':
          this.engine.state.buildMode = 'park';
          this.updateToolSelection();
          break;
        case 'd':
          this.engine.state.buildMode = 'demolish';
          this.updateToolSelection();
          break;
      }
    });
  }

  private updateToolSelection(): void {
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-mode') === this.engine.state.buildMode) {
        btn.classList.add('active');
      }
    });
  }

  private save(): void {
    if (this.storage.saveSlot(this.currentSlot, this.engine.state)) {
      alert(`スロット ${this.currentSlot + 1} に保存しました`);
      this.updateSlotDisplay();
    } else {
      alert('保存に失敗しました');
    }
  }

  private load(): void {
    const state = this.storage.loadSlot(this.currentSlot);
    if (state) {
      this.engine.state = { ...state };
      this.updateDisplay();
      alert(`スロット ${this.currentSlot + 1} から読み込みました`);
    } else {
      alert('このスロットにセーブデータがありません');
    }
  }

  private export(): void {
    const json = this.storage.exportToJSON(this.engine.state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easy-cities-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private import(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        const state = this.storage.importFromJSON(json);
        if (state) {
          this.engine.state = { ...state };
          this.updateDisplay();
          alert('インポートしました');
        } else {
          alert('インポートに失敗しました');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  private updateSlotDisplay(): void {
    document.querySelectorAll('.slot-btn').forEach((btn) => {
      btn.classList.remove('active');
      if (parseInt(btn.getAttribute('data-slot')!) === this.currentSlot) {
        btn.classList.add('active');
      }
    });

    const info = this.storage.getSlotInfo(this.currentSlot);
    const infoDiv = document.getElementById('slot-info')!;
    if (info) {
      const date = new Date(info.timestamp).toLocaleString('ja-JP');
      infoDiv.textContent = `[スロット${this.currentSlot + 1}] 人口: ${info.population} | 資金: ¥${info.money.toLocaleString()} | ${date}`;
    } else {
      infoDiv.textContent = `[スロット${this.currentSlot + 1}] 空白`;
    }
  }

  updateDisplay(): void {
    this.engine.calculatePopulation();
    this.engine.calculateComfort();

    document.getElementById('stat-population')!.textContent = this.engine.state.population.toLocaleString();
    document.getElementById('stat-money')!.textContent = `¥${this.engine.state.money.toLocaleString()}`;
    document.getElementById('stat-comfort')!.textContent = `${this.engine.state.comfort}`;
    document.getElementById('stat-month')!.textContent = `${this.engine.state.month}`;

    this.updateSlotDisplay();
  }
}
