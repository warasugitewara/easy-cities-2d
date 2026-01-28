import { GameEngine, GameSettings } from './engine';
import { StorageManager } from './storage';
import { BUILDING_TOOLS, BuildingCategory } from './constants';

export class UIManager {
  private engine: GameEngine;
  private storage: StorageManager;
  private currentSlot: number = 0;
  private currentTab: BuildingCategory = 'road';
  private guiVisible: boolean = false;

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

    // ダッシュボード（画面左上に常時表示）
    const dashboard = document.createElement('div');
    dashboard.id = 'dashboard';
    dashboard.className = 'dashboard-compact';
    dashboard.innerHTML = `
      <div class="stat-panel-compact">
        <div class="stat-item-compact">
          <span class="stat-label">👥</span>
          <span class="stat-value" id="stat-population">0</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">💰</span>
          <span class="stat-value" id="stat-money">¥250K</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">😊</span>
          <span class="stat-value" id="stat-comfort">50</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">📅</span>
          <span class="stat-value" id="stat-month">0</span>
        </div>
      </div>
    `;
    uiContainer.appendChild(dashboard);

    // トグルボタン（画面下部中央に常時表示）
    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'toggle-container';
    toggleContainer.className = 'toggle-container';
    toggleContainer.innerHTML = `
      <button id="btn-toggle-gui" class="btn-toggle-gui">🎛️</button>
    `;
    uiContainer.appendChild(toggleContainer);

    // ビルドメニュー（オーバーレイ、最初は非表示）
    this.createBuildMenu(uiContainer);

    // コントロールパネル（オーバーレイ、最初は非表示）
    const controls = document.createElement('div');
    controls.id = 'controls-panel';
    controls.className = 'controls-panel-overlay hidden';
    controls.innerHTML = `
      <div class="controls-header">
        <h3>⚙️ メニュー</h3>
        <button id="btn-close-gui" class="btn-close">✕</button>
      </div>
      <button id="btn-settings" class="btn-control">⚙️ 設定</button>
      <button id="btn-save" class="btn-control">💾 セーブ</button>
      <button id="btn-load" class="btn-control">📂 ロード</button>
      <button id="btn-export" class="btn-control">📤 エクスポート</button>
      <button id="btn-import" class="btn-control">📥 インポート</button>
    `;
    uiContainer.appendChild(controls);

    this.attachEventListeners();
  }

  private createBuildMenu(container: HTMLElement): void {
    const menu = document.createElement('div');
    menu.id = 'build-menu';
    menu.className = 'build-menu-overlay hidden';

    // タブコンテナ
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container-overlay';

    const categories: BuildingCategory[] = ['road', 'residential', 'commercial', 'industrial', 'infrastructure', 'landmark', 'demolish'];

    // タブボタン
    categories.forEach((cat) => {
      const tool = BUILDING_TOOLS[cat];
      const tab = document.createElement('button');
      tab.className = `tab-button-overlay ${cat === this.currentTab ? 'active' : ''}`;
      tab.dataset.category = cat;
      tab.innerHTML = `${tool.icon}`;
      tab.title = tool.label;
      tab.addEventListener('click', () => this.switchTab(cat));
      tabContainer.appendChild(tab);
    });

    menu.appendChild(tabContainer);

    // コンテンツエリア
    const contentArea = document.createElement('div');
    contentArea.id = 'build-content';
    contentArea.className = 'build-content-overlay';
    menu.appendChild(contentArea);

    container.appendChild(menu);
  }

  private switchTab(category: BuildingCategory): void {
    this.currentTab = category;
    this.engine.state.buildMode = category;

    // タブ表示の更新
    document.querySelectorAll('.tab-button-overlay').forEach((btn) => {
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
    infoDiv.className = 'build-info-overlay';
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
        console.log('Selected landmark:', opt.type);
      });
      optionsDiv.appendChild(btn);
    });

    container.appendChild(optionsDiv);
  }

  updateDisplay(): void {
    const population = this.engine.state.population;
    const money = this.engine.state.money;
    
    document.getElementById('stat-population')!.textContent = (population / 1000).toFixed(1) + 'K';
    document.getElementById('stat-money')!.textContent = `¥${(money / 1000).toFixed(0)}K`;
    document.getElementById('stat-comfort')!.textContent = Math.round(this.engine.state.comfort).toString();
    document.getElementById('stat-month')!.textContent = this.engine.state.month.toString();
  }

  private attachEventListeners(): void {
    // GUI表示/非表示トグル
    document.getElementById('btn-toggle-gui')?.addEventListener('click', () => this.toggleGUI());
    document.getElementById('btn-close-gui')?.addEventListener('click', () => this.toggleGUI());

    // 設定ボタン
    document.getElementById('btn-settings')?.addEventListener('click', () => this.showSettings());

    // セーブ/ロード
    document.getElementById('btn-save')?.addEventListener('click', () => this.showSaveSlots());
    document.getElementById('btn-load')?.addEventListener('click', () => this.showLoadSlots());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportGame());
    document.getElementById('btn-import')?.addEventListener('click', () => this.importGame());
  }

  private toggleGUI(): void {
    this.guiVisible = !this.guiVisible;
    const menu = document.getElementById('build-menu');
    const controls = document.getElementById('controls-panel');
    
    if (this.guiVisible) {
      menu?.classList.remove('hidden');
      controls?.classList.remove('hidden');
    } else {
      menu?.classList.add('hidden');
      controls?.classList.add('hidden');
    }
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
