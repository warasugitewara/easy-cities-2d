import { GameEngine, GameSettings } from './engine';
import { StorageManager } from './storage';
import { BUILDING_TOOLS, BuildingCategory } from './constants';

export class UIManager {
  private engine: GameEngine;
  private storage: StorageManager;
  private currentSlot: number = 0;
  private currentTab: BuildingCategory = 'road';

  constructor(engine: GameEngine, storage: StorageManager) {
    this.engine = engine;
    this.storage = storage;
    this.setupUI();
  }

  private setupUI(): void {
    const uiContainer = document.getElementById('ui-container');
    if (!uiContainer) {
      console.error('❌ UI container not found!');
      return;
    }

    console.log('✅ Setting up UI...');

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

    // ビルドメニュー（タブ式）
    this.createBuildMenu(uiContainer);

    // コントロールパネル
    const controls = document.createElement('div');
    controls.id = 'controls-panel';
    controls.className = 'controls-panel';
    controls.innerHTML = `
      <button id="btn-settings" class="btn-icon" title="設定">⚙️</button>
      <button id="btn-save" class="btn-icon" title="セーブ">💾</button>
      <button id="btn-load" class="btn-icon" title="ロード">📂</button>
      <button id="btn-export" class="btn-icon" title="エクスポート">📤</button>
      <button id="btn-import" class="btn-icon" title="インポート">📥</button>
    `;
    uiContainer.appendChild(controls);

    this.attachEventListeners();
  }

  private createBuildMenu(container: HTMLElement): void {
    const menu = document.createElement('div');
    menu.id = 'build-menu';
    menu.className = 'build-menu';

    // タブコンテナ
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';

    const categories: BuildingCategory[] = ['road', 'residential', 'commercial', 'industrial', 'infrastructure', 'landmark', 'demolish'];

    // タブボタン
    categories.forEach((cat) => {
      const tool = BUILDING_TOOLS[cat];
      const tab = document.createElement('button');
      tab.className = `tab-button ${cat === this.currentTab ? 'active' : ''}`;
      tab.dataset.category = cat;
      tab.innerHTML = `${tool.icon} ${tool.label}`;
      tab.addEventListener('click', () => this.switchTab(cat));
      tabContainer.appendChild(tab);
    });

    menu.appendChild(tabContainer);

    // コンテンツエリア
    const contentArea = document.createElement('div');
    contentArea.id = 'build-content';
    contentArea.className = 'build-content';
    menu.appendChild(contentArea);

    container.appendChild(menu);
  }

  private switchTab(category: BuildingCategory): void {
    this.currentTab = category;
    this.engine.state.buildMode = category;

    // タブ表示の更新
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.category === category);
    });

    // コンテンツ更新
    this.updateBuildContent(category);
  }

  private updateBuildContent(category: BuildingCategory): void {
    const content = document.getElementById('build-content');
    if (!content) return;

    content.innerHTML = '';

    const tool = BUILDING_TOOLS[category];

    const infoDiv = document.createElement('div');
    infoDiv.className = 'build-info';
    infoDiv.innerHTML = `
      <div class="info-title">${tool.icon} ${tool.label}</div>
      <div class="info-description">
        ${this.getDescriptionForCategory(category)}
      </div>
    `;
    content.appendChild(infoDiv);

    // カテゴリ別オプション
    if (category === 'infrastructure') {
      this.createInfrastructureOptions(content);
    } else if (category === 'landmark') {
      this.createLandmarkOptions(content);
    } else {
      // 通常は説明のみ
      const helpDiv = document.createElement('div');
      helpDiv.className = 'help-text';
      helpDiv.innerHTML = `左クリック: 敷設 | ドラッグ: 連続敷設 | 右クリックドラッグ: 画面移動`;
      content.appendChild(helpDiv);
    }
  }

  private getDescriptionForCategory(category: BuildingCategory): string {
    const descriptions: Record<BuildingCategory, string> = {
      road: '道路を敷設します。移動とアクセスが可能になります。',
      residential: '住宅地を敷設します。人口が増加します。',
      commercial: '商業地を敷設します。雇用と収入が増加します。',
      industrial: '工業地を敷設します。雇用が増加しますが、汚染も増えます。',
      infrastructure: 'インフラを建設します。駅、警察、病院など。',
      landmark: 'ランドマークを建設します。観光収入が増加します。',
      demolish: 'クリックして建物を削除します。',
    };
    return descriptions[category] || '';
  }

  private createInfrastructureOptions(container: HTMLElement): void {
    const options = [
      { type: 'station', name: '駅', icon: '🚉', cost: 5000 },
      { type: 'park', name: '公園', icon: '🌳', cost: 1000 },
      { type: 'police', name: '警察署', icon: '🚓', cost: 8000 },
      { type: 'fire_station', name: '消防署', icon: '🚒', cost: 7000 },
      { type: 'hospital', name: '病院', icon: '🏥', cost: 10000 },
      { type: 'school', name: '学校', icon: '🎓', cost: 6000 },
      { type: 'power_plant', name: '発電所', icon: '⚡', cost: 15000 },
      { type: 'water_treatment', name: '水処理施設', icon: '💧', cost: 12000 },
    ];

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'infrastructure-options';

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'infra-btn';
      btn.innerHTML = `${opt.icon} ${opt.name}<br><small>¥${opt.cost.toLocaleString()}</small>`;
      btn.addEventListener('click', () => {
        // TODO: インフラ選択処理
        console.log('Selected infrastructure:', opt.type);
      });
      optionsDiv.appendChild(btn);
    });

    container.appendChild(optionsDiv);
  }

  private createLandmarkOptions(container: HTMLElement): void {
    const options = [
      { type: 'stadium', name: 'スタジアム', icon: '🏟️', cost: 50000 },
      { type: 'airport', name: '空港', icon: '✈️', cost: 80000 },
    ];

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'landmark-options';

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'landmark-btn';
      btn.innerHTML = `${opt.icon} ${opt.name}<br><small>¥${opt.cost.toLocaleString()}</small>`;
      btn.addEventListener('click', () => {
        // TODO: ランドマーク選択処理
        console.log('Selected landmark:', opt.type);
      });
      optionsDiv.appendChild(btn);
    });

    container.appendChild(optionsDiv);
  }

  updateDisplay(): void {
    document.getElementById('stat-population')!.textContent = this.engine.state.population.toLocaleString();
    document.getElementById('stat-money')!.textContent = `¥${this.engine.state.money.toLocaleString()}`;
    document.getElementById('stat-comfort')!.textContent = Math.round(this.engine.state.comfort).toString();
    document.getElementById('stat-month')!.textContent = this.engine.state.month.toString();
  }

  private attachEventListeners(): void {
    // 設定ボタン
    document.getElementById('btn-settings')?.addEventListener('click', () => this.showSettings());

    // セーブ/ロード
    document.getElementById('btn-save')?.addEventListener('click', () => this.showSaveSlots());
    document.getElementById('btn-load')?.addEventListener('click', () => this.showLoadSlots());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportGame());
    document.getElementById('btn-import')?.addEventListener('click', () => this.importGame());
  }

  private showSettings(): void {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>ゲーム設定</h2>
        <div class="settings-group">
          <label>
            <input type="checkbox" id="toggle-disasters" ${this.engine.state.settings.disastersEnabled ? 'checked' : ''}>
            災害システム
          </label>
          <label>
            <input type="checkbox" id="toggle-pollution" ${this.engine.state.settings.pollutionEnabled ? 'checked' : ''}>
            公害システム
          </label>
          <label>
            <input type="checkbox" id="toggle-slum" ${this.engine.state.settings.slumEnabled ? 'checked' : ''}>
            スラム化システム
          </label>
        </div>
        <div class="modal-buttons">
          <button id="btn-settings-apply" class="btn-primary">適用</button>
          <button id="btn-settings-close" class="btn-secondary">キャンセル</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-settings-apply')?.addEventListener('click', () => {
      this.engine.state.settings.disastersEnabled = (document.getElementById('toggle-disasters') as HTMLInputElement).checked;
      this.engine.state.settings.pollutionEnabled = (document.getElementById('toggle-pollution') as HTMLInputElement).checked;
      this.engine.state.settings.slumEnabled = (document.getElementById('toggle-slum') as HTMLInputElement).checked;
      modal.remove();
    });

    document.getElementById('btn-settings-close')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private showSaveSlots(): void {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>セーブ</h2>
        <div class="slots">
          ${[0, 1, 2].map((i) => `<button class="slot-btn" data-slot="${i}">スロット ${i + 1}</button>`).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.querySelectorAll('.slot-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const slot = parseInt((e.target as HTMLElement).dataset.slot || '0');
        this.storage.saveGame(slot, this.engine.state);
        alert(`スロット ${slot + 1} にセーブしました`);
        modal.remove();
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private showLoadSlots(): void {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>ロード</h2>
        <div class="slots">
          ${[0, 1, 2].map((i) => `<button class="slot-btn" data-slot="${i}">スロット ${i + 1}</button>`).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.querySelectorAll('.slot-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const slot = parseInt((e.target as HTMLElement).dataset.slot || '0');
        const state = this.storage.loadGame(slot);
        if (state) {
          this.engine.state = state;
          this.updateDisplay();
          alert(`スロット ${slot + 1} からロードしました`);
        } else {
          alert(`スロット ${slot + 1} にセーブデータがありません`);
        }
        modal.remove();
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private exportGame(): void {
    const data = JSON.stringify(this.engine.state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easy-cities-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private importGame(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          this.engine.state = data;
          this.updateDisplay();
          alert('ゲームをインポートしました');
        } catch (err) {
          alert('ファイルの読み込みに失敗しました');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }
}
