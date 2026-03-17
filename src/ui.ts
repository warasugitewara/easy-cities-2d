import { GameEngine } from "./engine";
import { StorageManager } from "./storage";
import {
  BUILDING_TOOLS,
  BuildingCategory,
  INFRASTRUCTURE_COLORS,
  LANDMARK_COLORS,
} from "./constants";

export class UIManager {
  private engine: GameEngine;
  private storage: StorageManager;
  private currentSlot: number = 0;
  private currentTab: BuildingCategory = "road";
  private guiVisible: boolean = false;
  private selectedInfrastructure: string = "station";
  private selectedLandmark: string = "stadium";

  private draggingPanel: HTMLElement | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  private resizingPanel: HTMLElement | null = null;
  private resizeDir: string = "";
  private resizeStartX: number = 0;
  private resizeStartY: number = 0;
  private resizeStartWidth: number = 0;
  private resizeStartHeight: number = 0;

  constructor(engine: GameEngine, storage: StorageManager) {
    this.engine = engine;
    this.storage = storage;
    this.setupUI();
    this.setupGlobalDragHandlers();
  }

  private setupGlobalDragHandlers(): void {
    // グローバルなマウスムーブイベント
    document.addEventListener("mousemove", (e: MouseEvent) => {
      // リサイズ中はドラッグ処理をスキップ
      if (this.resizingPanel) {
        const deltaX = e.clientX - this.resizeStartX;
        const deltaY = e.clientY - this.resizeStartY;

        if (this.resizeDir.includes("right") || this.resizeDir.includes("corner")) {
          const newWidth = Math.max(150, this.resizeStartWidth + deltaX);
          this.resizingPanel.style.width = newWidth + "px";
        }
        if (this.resizeDir.includes("bottom") || this.resizeDir.includes("corner")) {
          const newHeight = Math.max(100, this.resizeStartHeight + deltaY);
          this.resizingPanel.style.height = newHeight + "px";
        }
        return;
      }

      // ドラッグ中のみ位置を更新
      if (this.draggingPanel) {
        let newX = e.clientX - this.dragOffsetX;
        let newY = e.clientY - this.dragOffsetY;

        // 画面外に出ないように制限
        const minX = 0;
        const maxX = window.innerWidth - this.draggingPanel.offsetWidth;
        const minY = 0;
        const maxY = window.innerHeight - this.draggingPanel.offsetHeight;

        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));

        this.draggingPanel.style.left = newX + "px";
        this.draggingPanel.style.top = newY + "px";
      }
    });

    // グローバルなマウスアップイベント
    document.addEventListener("mouseup", () => {
      if (this.resizingPanel) {
        this.resizingPanel = null;
        document.body.style.cursor = "default";
      }
      if (this.draggingPanel) {
        this.draggingPanel.style.cursor = "default";
        this.draggingPanel = null;
      }
    });
  }

  private setupUI(): void {
    const uiContainer = document.getElementById("ui-container");
    if (!uiContainer) {
      console.error("❌ UI container not found!");
      return;
    }

    console.log("✅ Setting up UI...");

    // モバイル判定
    const isMobile = window.innerWidth <= 1024;

    if (isMobile) {
      this.setupMobileUI(uiContainer);
    } else {
      this.setupDesktopUI(uiContainer);
    }

    this.attachEventListeners();
  }

  private setupMobileUI(container: HTMLElement): void {
    // モバイル版：シンプルなタブベースUI
    const mobilePanel = document.createElement("div");
    mobilePanel.id = "mobile-panel";
    mobilePanel.className = "mobile-panel";

    // タブボタン
    const tabBar = document.createElement("div");
    tabBar.className = "mobile-tab-bar";
    tabBar.innerHTML = `
      <button class="mobile-tab-btn active" data-tab="stats">📊 ステータス</button>
      <button class="mobile-tab-btn" data-tab="build">🏗️ 建設</button>
      <button class="mobile-tab-btn" data-tab="time">⏱️ 時間</button>
      <button class="mobile-tab-btn" data-tab="menu">⚙️ メニュー</button>
    `;
    mobilePanel.appendChild(tabBar);

    // タブコンテンツ
    const tabContent = document.createElement("div");
    tabContent.className = "mobile-tab-content";
    tabContent.id = "mobile-tab-content";

    // ステータスタブ
    const statsTab = document.createElement("div");
    statsTab.className = "mobile-tab-pane active";
    statsTab.dataset.tab = "stats";
    statsTab.innerHTML = `
      <div class="mobile-stats-grid">
        <div class="stat-compact">
          <span class="stat-label">👥</span>
          <span class="stat-value" id="stat-population">0</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">💰</span>
          <span class="stat-value" id="stat-money">¥250K</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">😊</span>
          <span class="stat-value" id="stat-comfort">50</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">📅</span>
          <span class="stat-value" id="stat-month">0</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">🔒</span>
          <span class="stat-value" id="stat-security">50</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">🛡️</span>
          <span class="stat-value" id="stat-safety">50</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">📚</span>
          <span class="stat-value" id="stat-education">50</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">⚕️</span>
          <span class="stat-value" id="stat-medical">50</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">🎭</span>
          <span class="stat-value" id="stat-tourism">0</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">✈️</span>
          <span class="stat-value" id="stat-international">0</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">📡</span>
          <span class="stat-value" id="stat-power">0%</span>
        </div>
        <div class="stat-compact">
          <span class="stat-label">💧</span>
          <span class="stat-value" id="stat-water">0%</span>
        </div>
      </div>
      <div class="demand-meter-container-mobile" id="demand-meter-container-mobile" style="display: none;">
        <div class="demand-meter-mobile">
          <span>🏘️ <span id="demand-value-residential-mobile">50</span></span>
        </div>
        <div class="demand-meter-mobile">
          <span>🏪 <span id="demand-value-commercial-mobile">50</span></span>
        </div>
        <div class="demand-meter-mobile">
          <span>🏭 <span id="demand-value-industrial-mobile">50</span></span>
        </div>
      </div>
    `;
    tabContent.appendChild(statsTab);

    // ステータスタブにトグルボタンを追加
    const toggleDemandBtn = document.createElement("button");
    toggleDemandBtn.id = "btn-toggle-demand-mobile";
    toggleDemandBtn.className = "btn-toggle-demand-mobile";
    toggleDemandBtn.textContent = "📊 需要メーター";
    toggleDemandBtn.addEventListener("click", () => {
      const container = document.getElementById("demand-meter-container-mobile");
      if (container) {
        container.style.display = container.style.display === "none" ? "block" : "none";
        this.engine.state.showDemandMeters = container.style.display !== "none";
      }
    });
    statsTab.appendChild(toggleDemandBtn);

    // 建設タブ
    const buildTab = document.createElement("div");
    buildTab.className = "mobile-tab-pane";
    buildTab.dataset.tab = "build";
    buildTab.id = "build-tab-content";
    this.createMobileBuildMenu(buildTab);
    tabContent.appendChild(buildTab);

    // 時間制御タブ
    const timeTab = document.createElement("div");
    timeTab.className = "mobile-tab-pane";
    timeTab.dataset.tab = "time";
    timeTab.innerHTML = `
      <div class="mobile-time-controls">
        <button id="btn-pause" class="mobile-time-btn" title="ポーズ">⏸</button>
        <button id="btn-slow" class="mobile-time-btn" title="遅い">⏪</button>
        <button id="btn-normal" class="mobile-time-btn active" title="通常">▶</button>
        <button id="btn-fast" class="mobile-time-btn" title="高速">⏩</button>
      </div>
    `;
    tabContent.appendChild(timeTab);

    // メニュータブ
    const menuTab = document.createElement("div");
    menuTab.className = "mobile-tab-pane";
    menuTab.dataset.tab = "menu";
    menuTab.innerHTML = `
      <div class="mobile-menu-buttons">
        <button id="btn-settings" class="mobile-menu-btn">⚙️ 設定</button>
        <button id="btn-save" class="mobile-menu-btn">💾 セーブ</button>
        <button id="btn-load" class="mobile-menu-btn">📂 ロード</button>
        <button id="btn-export" class="mobile-menu-btn">📤 エクスポート</button>
        <button id="btn-import" class="mobile-menu-btn">📥 インポート</button>
      </div>
    `;
    tabContent.appendChild(menuTab);

    mobilePanel.appendChild(tabContent);
    container.appendChild(mobilePanel);

    // タブ切り替えハンドラ
    tabBar.querySelectorAll(".mobile-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = (e.target as HTMLElement).dataset.tab;
        this.switchMobileTab(tab!);
      });
    });
  }

  private createMobileBuildMenu(container: HTMLElement): void {
    // カテゴリセレクタ
    const categorySelect = document.createElement("select");
    categorySelect.id = "mobile-category-select";
    categorySelect.className = "mobile-category-select";
    categorySelect.innerHTML = `
      <option value="road">🛣️ 道路</option>
      <option value="residential">🏠 住宅</option>
      <option value="commercial">🏢 商業</option>
      <option value="industrial">🏭 工業</option>
      <option value="infrastructure">🔧 インフラ</option>
      <option value="landmark">🎪 ランドマーク</option>
      <option value="demolish">💣 削除</option>
    `;
    container.appendChild(categorySelect);

    // 説明
    const description = document.createElement("div");
    description.id = "mobile-build-description";
    description.className = "mobile-build-description";
    container.appendChild(description);

    // オプション
    const options = document.createElement("div");
    options.id = "mobile-build-options";
    options.className = "mobile-build-options";
    container.appendChild(options);

    categorySelect.addEventListener("change", (e) => {
      const cat = (e.target as HTMLSelectElement).value as BuildingCategory;
      console.log("🏗️ Mobile category changed to:", cat);
      this.switchTab(cat);
      this.updateMobileBuildContent(cat);
      console.log("✅ Engine buildMode set to:", this.engine.state.buildMode);
    });

    // 初期表示
    this.updateMobileBuildContent("road");
  }

  private updateMobileBuildContent(category: BuildingCategory): void {
    const descDiv = document.getElementById("mobile-build-description");
    const optionsDiv = document.getElementById("mobile-build-options");

    if (!descDiv || !optionsDiv) return;

    const tool = BUILDING_TOOLS[category];
    descDiv.innerHTML = `<div class="mobile-build-info">${tool.icon} ${tool.label}<br><small>${this.getDescriptionForCategory(category)}</small></div>`;

    optionsDiv.innerHTML = "";

    if (category === "infrastructure") {
      this.createMobileInfrastructureOptions(optionsDiv);
    } else if (category === "landmark") {
      this.createMobileLandmarkOptions(optionsDiv);
    }
  }

  private createMobileInfrastructureOptions(container: HTMLElement): void {
    const options = [
      { type: "station", name: "駅", icon: "🚉", cost: 5000 },
      { type: "park", name: "公園", icon: "🌳", cost: 1000 },
      { type: "police", name: "警察署", icon: "🚓", cost: 8000 },
      { type: "fire_station", name: "消防署", icon: "🚒", cost: 7000 },
      { type: "hospital", name: "病院", icon: "🏥", cost: 10000 },
      { type: "school", name: "学校", icon: "🏫", cost: 6000 },
      { type: "power_plant", name: "発電所", icon: "⚡", cost: 15000 },
      { type: "water_treatment", name: "水処理施設", icon: "💧", cost: 12000 },
    ];

    options.forEach(({ type, name, icon, cost }) => {
      const btn = document.createElement("button");
      btn.className = `mobile-infra-btn ${this.selectedInfrastructure === type ? "active" : ""}`;
      btn.innerHTML = `${icon} ${name}<br><small>¥${cost}</small>`;
      btn.addEventListener("click", () => {
        this.selectedInfrastructure = type;
        this.engine.state.selectedInfrastructure = type;
        console.log(
          "🔧 Selected infrastructure:",
          type,
          "| buildMode:",
          this.engine.state.buildMode,
        );
        container
          .querySelectorAll(".mobile-infra-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
      container.appendChild(btn);
    });
  }

  private createMobileLandmarkOptions(container: HTMLElement): void {
    const options = [
      { type: "stadium", name: "スタジアム", icon: "⚽", cost: 50000 },
      { type: "airport", name: "空港", icon: "✈️", cost: 80000 },
    ];

    options.forEach(({ type, name, icon, cost }) => {
      const btn = document.createElement("button");
      btn.className = `mobile-landmark-btn ${this.selectedLandmark === type ? "active" : ""}`;
      btn.innerHTML = `${icon} ${name}<br><small>¥${cost}</small>`;
      btn.addEventListener("click", () => {
        this.selectedLandmark = type;
        this.engine.state.selectedLandmark = type;
        console.log("🎪 Selected landmark:", type, "| buildMode:", this.engine.state.buildMode);
        container
          .querySelectorAll(".mobile-landmark-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
      container.appendChild(btn);
    });
  }

  private switchMobileTab(tab: string): void {
    // タブボタン更新
    document.querySelectorAll(".mobile-tab-btn").forEach((btn) => {
      const element = btn as HTMLElement;
      element.classList.toggle("active", element.dataset.tab === tab);
    });

    // コンテンツ更新
    document.querySelectorAll(".mobile-tab-pane").forEach((pane) => {
      const element = pane as HTMLElement;
      element.classList.toggle("active", element.dataset.tab === tab);
    });
  }

  private setupDesktopUI(container: HTMLElement): void {
    // ダッシュボード（画面左上に常時表示）
    const dashboard = document.createElement("div");
    dashboard.id = "dashboard";
    dashboard.className = "dashboard-compact";
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
        <div class="stat-item-compact">
          <span class="stat-label">🔒</span>
          <span class="stat-value" id="stat-security">50</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">🛡️</span>
          <span class="stat-value" id="stat-safety">50</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">📚</span>
          <span class="stat-value" id="stat-education">50</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">⚕️</span>
          <span class="stat-value" id="stat-medical">50</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">🎭</span>
          <span class="stat-value" id="stat-tourism">0</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">✈️</span>
          <span class="stat-value" id="stat-international">0</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">📡</span>
          <span class="stat-value" id="stat-power">0%</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">💧</span>
          <span class="stat-value" id="stat-water">0%</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">🏘️</span>
          <span class="stat-value" id="stat-residential-demand">50</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">🏪</span>
          <span class="stat-value" id="stat-commercial-demand">50</span>
        </div>
        <div class="stat-item-compact">
          <span class="stat-label">🏭</span>
          <span class="stat-value" id="stat-industrial-demand">50</span>
        </div>
      </div>
    `;
    container.appendChild(dashboard);

    // 時間制御パネル（画面上部中央に常時表示）
    const timePanel = document.createElement("div");
    timePanel.id = "time-panel";
    timePanel.className = "time-panel";
    timePanel.innerHTML = `
      <button id="btn-pause" class="time-btn" title="ポーズ">⏸</button>
      <button id="btn-slow" class="time-btn" title="遅い">⏪</button>
      <button id="btn-normal" class="time-btn active" title="通常">▶</button>
      <button id="btn-fast" class="time-btn" title="高速">⏩</button>
    `;
    container.appendChild(timePanel);

    // トグルボタン（画面下部中央に常時表示）
    const toggleContainer = document.createElement("div");
    toggleContainer.id = "toggle-container";
    toggleContainer.className = "toggle-container";
    toggleContainer.innerHTML = `
      <button id="btn-toggle-gui" class="btn-toggle-gui">🎛️</button>
    `;
    container.appendChild(toggleContainer);

    // ビルドメニュー（オーバーレイ、最初は非表示）
    this.createBuildMenu(container);

    // コントロールパネル（オーバーレイ、最初は非表示）
    const controls = document.createElement("div");
    controls.id = "controls-panel";
    controls.className = "controls-panel-overlay hidden";
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
    container.appendChild(controls);
  }

  private createBuildMenu(container: HTMLElement): void {
    const menu = document.createElement("div");
    menu.id = "build-menu";
    menu.className = "build-menu-overlay hidden";

    // タブコンテナ
    const tabContainer = document.createElement("div");
    tabContainer.className = "tab-container-overlay";

    const categories: BuildingCategory[] = [
      "road",
      "residential",
      "commercial",
      "industrial",
      "infrastructure",
      "landmark",
      "demolish",
    ];

    // タブボタン
    categories.forEach((cat) => {
      const tool = BUILDING_TOOLS[cat];
      const tab = document.createElement("button");
      tab.className = `tab-button-overlay ${cat === this.currentTab ? "active" : ""}`;
      tab.dataset.category = cat;
      tab.innerHTML = `${tool.icon}`;
      tab.title = tool.label;
      tab.addEventListener("click", () => this.switchTab(cat));
      tabContainer.appendChild(tab);
    });

    menu.appendChild(tabContainer);

    // コンテンツエリア
    const contentArea = document.createElement("div");
    contentArea.id = "build-content";
    contentArea.className = "build-content-overlay";
    menu.appendChild(contentArea);

    container.appendChild(menu);
  }

  private switchTab(category: BuildingCategory): void {
    this.currentTab = category;
    this.engine.state.buildMode = category;
    this.engine.state.selectedInfrastructure = this.selectedInfrastructure;
    this.engine.state.selectedLandmark = this.selectedLandmark;

    // タブ表示の更新
    document.querySelectorAll(".tab-button-overlay").forEach((btn) => {
      btn.classList.toggle("active", (btn as HTMLElement).dataset.category === category);
    });

    // コンテンツ更新
    this.updateBuildContent(category);
  }

  private updateBuildContent(category: BuildingCategory): void {
    const content = document.getElementById("build-content");
    if (!content) return;

    content.innerHTML = "";

    const tool = BUILDING_TOOLS[category];

    const infoDiv = document.createElement("div");
    infoDiv.className = "build-info-overlay";
    infoDiv.innerHTML = `
      <div class="info-title">${tool.icon} ${tool.label}</div>
      <div class="info-description">
        ${this.getDescriptionForCategory(category)}
      </div>
    `;
    content.appendChild(infoDiv);

    // カテゴリ別オプション
    if (category === "infrastructure") {
      this.createInfrastructureOptions(content);
    } else if (category === "landmark") {
      this.createLandmarkOptions(content);
    }
  }

  private getDescriptionForCategory(category: BuildingCategory): string {
    const descriptions: Record<BuildingCategory, string> = {
      road: "道路を敷設します。移動とアクセスが可能になります。",
      residential: "住宅地を敷設します。人口が増加します。",
      commercial: "商業地を敷設します。雇用と収入が増加します。",
      industrial: "工業地を敷設します。雇用が増加しますが、汚染も増えます。",
      infrastructure: "インフラを建設します。駅、警察、病院など。",
      landmark: "ランドマークを建設します。観光収入が増加します。",
      demolish: "クリックして建物を削除します。",
    };
    return descriptions[category] || "";
  }

  private createInfrastructureOptions(container: HTMLElement): void {
    const options = [
      { type: "station", name: "駅", icon: "🚉", cost: 5000 },
      { type: "park", name: "公園", icon: "🌳", cost: 1000 },
      { type: "police", name: "警察署", icon: "🚓", cost: 8000 },
      { type: "fire_station", name: "消防署", icon: "🚒", cost: 7000 },
      { type: "hospital", name: "病院", icon: "🏥", cost: 10000 },
      { type: "school", name: "学校", icon: "🎓", cost: 6000 },
      { type: "power_plant", name: "発電所", icon: "⚡", cost: 15000 },
      { type: "water_treatment", name: "水処理施設", icon: "💧", cost: 12000 },
    ];

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "infrastructure-options";

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "infra-btn";

      // 色サンプルを取得
      const color = INFRASTRUCTURE_COLORS[opt.type] || "#999";

      btn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
          <div style="width: 24px; height: 24px; background-color: ${color}; border: 1px solid #666; border-radius: 3px;"></div>
          <div style="text-align: left; flex: 1;">
            <div>${opt.icon} ${opt.name}</div>
            <small>¥${opt.cost.toLocaleString()}</small>
          </div>
        </div>
      `;

      btn.addEventListener("click", () => {
        this.selectedInfrastructure = opt.type;
        this.engine.state.selectedInfrastructure = opt.type;
        optionsDiv.querySelectorAll(".infra-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        console.log("Selected infrastructure:", opt.type);
      });

      if (opt.type === this.selectedInfrastructure) {
        btn.classList.add("active");
      }
      optionsDiv.appendChild(btn);
    });

    container.appendChild(optionsDiv);
  }

  private createLandmarkOptions(container: HTMLElement): void {
    const options = [
      { type: "stadium", name: "スタジアム", icon: "🏟️", cost: 50000 },
      { type: "airport", name: "空港", icon: "✈️", cost: 80000 },
    ];

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "landmark-options";

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "landmark-btn";

      // 色サンプルを取得
      const color = LANDMARK_COLORS[opt.type] || "#999";

      btn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
          <div style="width: 24px; height: 24px; background-color: ${color}; border: 1px solid #666; border-radius: 3px;"></div>
          <div style="text-align: left; flex: 1;">
            <div>${opt.icon} ${opt.name}</div>
            <small>¥${opt.cost.toLocaleString()}</small>
          </div>
        </div>
      `;

      btn.addEventListener("click", () => {
        this.selectedLandmark = opt.type;
        this.engine.state.selectedLandmark = opt.type;
        optionsDiv.querySelectorAll(".landmark-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        console.log("Selected landmark:", opt.type);
      });

      if (opt.type === this.selectedLandmark) {
        btn.classList.add("active");
      }
      optionsDiv.appendChild(btn);
    });

    container.appendChild(optionsDiv);
  }

  updateDisplay(): void {
    const population = this.engine.state.population;
    const money = this.engine.state.money;

    document.getElementById("stat-population")!.textContent = (population / 1000).toFixed(1) + "K";

    // サンドボックスモードの場合は∞表記、通常モードは金額表示
    if (this.engine.state.settings.sandbox) {
      document.getElementById("stat-money")!.textContent = "∞";
    } else {
      document.getElementById("stat-money")!.textContent = `¥${(money / 1000).toFixed(0)}K`;
    }

    document.getElementById("stat-comfort")!.textContent = Math.round(
      this.engine.state.comfort,
    ).toString();
    document.getElementById("stat-month")!.textContent = this.engine.state.month.toString();

    // 新パラメータ表示
    document.getElementById("stat-security")!.textContent = Math.round(
      this.engine.state.securityLevel,
    ).toString();
    document.getElementById("stat-safety")!.textContent = Math.round(
      this.engine.state.safetyLevel,
    ).toString();
    document.getElementById("stat-education")!.textContent = Math.round(
      this.engine.state.educationLevel,
    ).toString();
    document.getElementById("stat-medical")!.textContent = Math.round(
      this.engine.state.medicalLevel,
    ).toString();
    document.getElementById("stat-tourism")!.textContent = Math.round(
      this.engine.state.tourismLevel,
    ).toString();
    document.getElementById("stat-international")!.textContent = Math.round(
      this.engine.state.internationalLevel,
    ).toString();
    document.getElementById("stat-power")!.textContent =
      Math.round(this.engine.state.powerSupplyRate).toString() + "%";
    document.getElementById("stat-water")!.textContent =
      Math.round(this.engine.state.waterSupplyRate).toString() + "%";

    // 需要値をダッシュボードに表示
    const residentialDemand = Math.round(this.engine.state.residentialDemand);
    const commercialDemand = Math.round(this.engine.state.commercialDemand);
    const industrialDemand = Math.round(this.engine.state.industrialDemand);

    document.getElementById("stat-residential-demand")!.textContent = residentialDemand.toString();
    document.getElementById("stat-commercial-demand")!.textContent = commercialDemand.toString();
    document.getElementById("stat-industrial-demand")!.textContent = industrialDemand.toString();

    // モバイル版の需要値表示（存在する場合のみ）
    const resMobileElement = document.getElementById("demand-value-residential-mobile");
    const comMobileElement = document.getElementById("demand-value-commercial-mobile");
    const indMobileElement = document.getElementById("demand-value-industrial-mobile");

    if (resMobileElement) resMobileElement.textContent = residentialDemand.toString();
    if (comMobileElement) comMobileElement.textContent = commercialDemand.toString();
    if (indMobileElement) indMobileElement.textContent = industrialDemand.toString();
  }

  private attachEventListeners(): void {
    // GUI表示/非表示トグル
    document.getElementById("btn-toggle-gui")?.addEventListener("click", () => this.toggleGUI());
    document.getElementById("btn-close-gui")?.addEventListener("click", () => this.toggleGUI());

    // 時間制御ボタン
    document.getElementById("btn-pause")?.addEventListener("click", () => this.setGameSpeed(0));
    document.getElementById("btn-slow")?.addEventListener("click", () => this.setGameSpeed(0.5));
    document.getElementById("btn-normal")?.addEventListener("click", () => this.setGameSpeed(1));
    document.getElementById("btn-fast")?.addEventListener("click", () => this.setGameSpeed(2));

    // 設定ボタン
    document.getElementById("btn-settings")?.addEventListener("click", () => this.showSettings());

    // セーブ/ロード
    document.getElementById("btn-save")?.addEventListener("click", () => this.showSaveSlots());
    document.getElementById("btn-load")?.addEventListener("click", () => this.showLoadSlots());
    document.getElementById("btn-export")?.addEventListener("click", () => this.exportGame());
    document.getElementById("btn-import")?.addEventListener("click", () => this.importGame());

    // UI パネルのドラッグ機能
    this.makePanelDraggable("dashboard");
    this.makePanelDraggable("time-panel");
    this.makePanelDraggable("build-menu");
    this.makePanelDraggable("controls-panel");
    this.makeSimpleDraggable("demand-meter-container");
  }

  private setGameSpeed(speed: number): void {
    this.engine.state.gameSpeed = speed;
    this.engine.state.paused = speed === 0; // ポーズボタンで一時停止

    // デスクトップ用ボタンのアクティブ状態を更新
    document.querySelectorAll(".time-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    // モバイル用ボタンのアクティブ状態を更新
    document.querySelectorAll(".mobile-time-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    if (speed === 0) {
      document.getElementById("btn-pause")?.classList.add("active");
    } else if (speed === 0.5) {
      document.getElementById("btn-slow")?.classList.add("active");
    } else if (speed === 1) {
      document.getElementById("btn-normal")?.classList.add("active");
    } else if (speed === 2) {
      document.getElementById("btn-fast")?.classList.add("active");
    }
  }

  private makePanelDraggable(panelId: string): void {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    // ダッシュボードと時間パネルはリサイズ不可
    const noResize = ["dashboard", "time-panel"];

    if (!noResize.includes(panelId)) {
      // パネルにリサイズハンドル追加（底部・右側・コーナー）
      const handles = ["resize-right", "resize-bottom", "resize-corner"];
      handles.forEach((handle) => {
        if (!panel.querySelector(`.${handle}`)) {
          const div = document.createElement("div");
          div.className = handle;
          panel.appendChild(div);
        }
      });

      // リサイズハンドルのマウスダウン
      const resizeHandles = panel.querySelectorAll('[class*="resize-"]');
      resizeHandles.forEach((handle) => {
        (handle as HTMLElement).addEventListener("mousedown", (e: MouseEvent) => {
          // パネルが表示されていない場合はリサイズを無効化
          if (panel.style.display === "none") return;

          e.preventDefault();
          e.stopPropagation();

          // ドラッグ中ならリサイズ開始しない
          if (this.draggingPanel) return;

          this.resizingPanel = panel;
          this.resizeDir = (handle as HTMLElement).className;
          this.resizeStartX = e.clientX;
          this.resizeStartY = e.clientY;
          this.resizeStartWidth = panel.offsetWidth;
          this.resizeStartHeight = panel.offsetHeight;

          const cursorMap: { [key: string]: string } = {
            "resize-right": "ew-resize",
            "resize-bottom": "ns-resize",
            "resize-corner": "nwse-resize",
          };
          document.body.style.cursor = cursorMap[this.resizeDir] || "default";
        });
      });
    }

    // ドラッグ処理（パネル全体をドラッグ対象に）
    panel.addEventListener("mousedown", (e: MouseEvent) => {
      // パネルが表示されていない場合はドラッグを無効化
      if (panel.style.display === "none") return;

      // リサイズ中ならドラッグ開始しない
      if (this.resizingPanel) return;

      // リサイズハンドル上ではドラッグ無効
      if ((e.target as HTMLElement).className.includes("resize-")) return;

      // ボタンやインタラクティブ要素でのドラッグを無効化
      if (
        (e.target as HTMLElement).tagName === "BUTTON" ||
        (e.target as HTMLElement).tagName === "INPUT"
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      this.draggingPanel = panel;

      // transform: translateX(-50%) などの変換を解除し、left/top に正しい位置を設定
      const rect = panel.getBoundingClientRect();
      panel.style.transform = "none";
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";

      // transform 設定後の正確な位置を取得してオフセットを計算
      const rectAfter = panel.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rectAfter.left;
      this.dragOffsetY = e.clientY - rectAfter.top;
      panel.style.cursor = "grabbing";
    });
  }

  private makeSimpleDraggable(panelId: string): void {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    // ドラッグ処理（パネル全体をドラッグ対象に）
    panel.addEventListener("mousedown", (e: MouseEvent) => {
      // パネルが表示されていない場合はドラッグを無効化
      if (panel.style.display === "none") return;

      // ボタンやインタラクティブ要素でのドラッグを無効化
      if (
        (e.target as HTMLElement).tagName === "BUTTON" ||
        (e.target as HTMLElement).tagName === "INPUT"
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      this.draggingPanel = panel;

      // transform を解除し、left/top に正しい位置を設定
      const rect = panel.getBoundingClientRect();
      panel.style.transform = "none";
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";

      // transform 設定後の正確な位置を取得してオフセットを計算
      const rectAfter = panel.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rectAfter.left;
      this.dragOffsetY = e.clientY - rectAfter.top;
      panel.style.cursor = "grabbing";
    });
  }

  private toggleGUI(): void {
    this.guiVisible = !this.guiVisible;
    const menu = document.getElementById("build-menu");
    const controls = document.getElementById("controls-panel");

    if (this.guiVisible) {
      menu?.classList.remove("hidden");
      controls?.classList.remove("hidden");
    } else {
      menu?.classList.add("hidden");
      controls?.classList.add("hidden");
    }
  }

  private showSettings(): void {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2>ゲーム設定</h2>
        <div class="settings-group">
          <label>
            <input type="checkbox" id="toggle-sandbox" ${this.engine.state.settings.sandbox ? "checked" : ""}>
            🎮 サンドボックスモード（資金∞）
          </label>
          <label>
            <input type="checkbox" id="toggle-disasters" ${this.engine.state.settings.disastersEnabled ? "checked" : ""}>
            災害システム
          </label>
          <label>
            <input type="checkbox" id="toggle-pollution" ${this.engine.state.settings.pollutionEnabled ? "checked" : ""}>
            公害システム
          </label>
          <label>
            <input type="checkbox" id="toggle-slum" ${this.engine.state.settings.slumEnabled ? "checked" : ""}>
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

    document.getElementById("btn-settings-apply")?.addEventListener("click", () => {
      this.engine.state.settings.sandbox = (
        document.getElementById("toggle-sandbox") as HTMLInputElement
      ).checked;
      this.engine.state.settings.disastersEnabled = (
        document.getElementById("toggle-disasters") as HTMLInputElement
      ).checked;
      this.engine.state.settings.pollutionEnabled = (
        document.getElementById("toggle-pollution") as HTMLInputElement
      ).checked;
      this.engine.state.settings.slumEnabled = (
        document.getElementById("toggle-slum") as HTMLInputElement
      ).checked;
      modal.remove();
    });

    document.getElementById("btn-settings-close")?.addEventListener("click", () => {
      modal.remove();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private showSaveSlots(): void {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2>セーブ</h2>
        <div class="slots">
          ${[0, 1, 2].map((i) => `<button class="slot-btn" data-slot="${i}">スロット ${i + 1}</button>`).join("")}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.querySelectorAll(".slot-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const slot = parseInt((e.target as HTMLElement).dataset.slot || "0");
        this.storage.saveGame(slot, this.engine.state);
        alert(`スロット ${slot + 1} にセーブしました`);
        modal.remove();
      });
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private showLoadSlots(): void {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2>ロード</h2>
        <div class="slots">
          ${[0, 1, 2].map((i) => `<button class="slot-btn" data-slot="${i}">スロット ${i + 1}</button>`).join("")}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.querySelectorAll(".slot-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const slot = parseInt((e.target as HTMLElement).dataset.slot || "0");
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

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private exportGame(): void {
    const data = JSON.stringify(this.engine.state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `easy-cities-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private importGame(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          this.engine.state = data;
          this.updateDisplay();
          alert("ゲームをインポートしました");
        } catch {
          alert("ファイルの読み込みに失敗しました");
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }
}
