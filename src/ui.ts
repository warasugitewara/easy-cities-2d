import { GameEngine } from "./engine";
import { StorageManager } from "./storage";
import {
  BUILD_COSTS,
  BUILDING_TOOLS,
  BuildingCategory,
  INFRASTRUCTURE_COLORS,
  LANDMARK_COLORS,
} from "./constants";

/** インフラ選択肢のアイコン/名称。コストは唯一の定義元である constants.BUILD_COSTS から引く。 */
const INFRASTRUCTURE_META: { type: string; name: string; icon: string }[] = [
  { type: "station", name: "駅", icon: "🚉" },
  { type: "park", name: "公園", icon: "🌳" },
  { type: "police", name: "警察署", icon: "🚓" },
  { type: "fire_station", name: "消防署", icon: "🚒" },
  { type: "hospital", name: "病院", icon: "🏥" },
  { type: "school", name: "学校", icon: "🏫" },
  { type: "power_plant", name: "発電所", icon: "⚡" },
  { type: "water_treatment", name: "水処理施設", icon: "💧" },
];

/** ランドマーク選択肢のアイコン/名称。コストは BUILD_COSTS[`landmark_${type}`] から引く。 */
const LANDMARK_META: { type: string; name: string; icon: string }[] = [
  { type: "stadium", name: "スタジアム", icon: "🏟️" },
  { type: "airport", name: "空港", icon: "✈️" },
];

export class UIManager {
  private engine: GameEngine;
  private storage: StorageManager;
  private currentSlot: number = 0;
  private currentTab: BuildingCategory = "road";
  private selectedInfrastructure: string = "station";
  private selectedLandmark: string = "stadium";
  private lastText = new Map<string, string>();

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
        <button id="btn-theme-toggle-mobile" class="mobile-menu-btn">🌙 テーマ</button>
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
    this.createHudBar(container);

    // ビルドツールバー（下端中央、常設）
    this.createBuildMenu(container);

    // コントロールパネル（⚙メニュー、最初は非表示。Step4でドロワー化予定のため現状のまま残置）
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

  /** トップHUDバー（主要指標＋時間コントロール＋⚙メニュー導線）と、その下にスライドダウンする副次指標パネルを構築する。 */
  private createHudBar(container: HTMLElement): void {
    const bar = document.createElement("div");
    bar.id = "dashboard";
    bar.className = "hud-bar glass";
    bar.innerHTML = `
      <div class="hud-primary">
        ${this.statChipHTML("stat-money", "💰", "資金", { primary: true, valueClass: "stat-gold" })}
        ${this.statChipHTML("stat-population", "👥", "人口", { primary: true })}
        ${this.statChipHTML("stat-month", "📅", "月", { primary: true })}
        <span id="hud-pause-pill" class="hud-pill hud-pill-warn hidden">⏸ 一時停止中</span>
        <span id="hud-supply-pill" class="hud-pill hud-pill-warn hidden" data-tip="電力または水道の供給率が不足しています">⚠ 電力/水道不足</span>
        <button id="btn-detail-toggle" class="hud-detail-toggle" aria-expanded="false" aria-controls="hud-detail-panel">▸ 詳細</button>
      </div>
      <div class="hud-time" role="toolbar" aria-label="時間コントロール">
        <button id="btn-pause" class="time-btn" aria-pressed="false" title="ポーズ (Space)">⏸</button>
        <button id="btn-slow" class="time-btn" aria-pressed="false" title="0.5倍速 (1)">0.5x</button>
        <button id="btn-normal" class="time-btn active" aria-pressed="true" title="通常速度 (2)">1x</button>
        <button id="btn-fast" class="time-btn" aria-pressed="false" title="2倍速 (3)">2x</button>
      </div>
      <div class="hud-right">
        <button id="btn-theme-toggle" class="hud-menu-btn" aria-label="テーマ切り替え" title="テーマ切り替え">🌙</button>
        <button id="btn-toggle-gui" class="hud-menu-btn" aria-label="メニュー">⚙</button>
      </div>
    `;
    container.appendChild(bar);

    const detail = document.createElement("div");
    detail.id = "hud-detail-panel";
    detail.className = "hud-detail-panel glass";
    detail.innerHTML = `
      <div class="hud-detail-inner">
        ${this.statChipHTML("stat-comfort", "😊", "快適度", { bar: true })}
        ${this.statChipHTML("stat-security", "🔒", "治安", { bar: true })}
        ${this.statChipHTML("stat-safety", "🛡️", "安全", { bar: true })}
        ${this.statChipHTML("stat-education", "📚", "教育", { bar: true })}
        ${this.statChipHTML("stat-medical", "⚕️", "医療", { bar: true })}
        ${this.statChipHTML("stat-tourism", "🎭", "観光", { bar: true })}
        ${this.statChipHTML("stat-international", "✈️", "国際", { bar: true })}
        ${this.statChipHTML("stat-power", "📡", "電力", { bar: true })}
        ${this.statChipHTML("stat-water", "💧", "水道", { bar: true })}
        ${this.statChipHTML("stat-residential-demand", "🏘️", "住宅需要", { bar: true })}
        ${this.statChipHTML("stat-commercial-demand", "🏪", "商業需要", { bar: true })}
        ${this.statChipHTML("stat-industrial-demand", "🏭", "工業需要", { bar: true })}
      </div>
    `;
    container.appendChild(detail);

    document.getElementById("btn-detail-toggle")?.addEventListener("click", () => {
      const toggle = document.getElementById("btn-detail-toggle");
      const open = detail.classList.toggle("open");
      toggle?.setAttribute("aria-expanded", String(open));
    });
  }

  /** stat chip 1個分の HTML を生成する。既存 ID (stat-*) をそのまま value 要素の ID として使う。 */
  private statChipHTML(
    id: string,
    icon: string,
    label: string,
    opts: { primary?: boolean; bar?: boolean; valueClass?: string } = {},
  ): string {
    const chipClass = opts.primary ? "stat-chip stat-chip-primary" : "stat-chip";
    const valueClass = opts.valueClass ? `stat-value ${opts.valueClass}` : "stat-value";
    const bar = opts.bar
      ? `<span class="stat-bar" id="${id}-bar"><span class="stat-bar-fill"></span></span>`
      : "";
    return `
      <span class="${chipClass}" role="group" aria-label="${label}" tabindex="0" data-tip="${label}">
        <span class="stat-icon" aria-hidden="true">${icon}</span>
        <span class="stat-chip-body">
          <span class="${valueClass}" id="${id}">0</span>
          ${bar}
        </span>
      </span>`;
  }

  /** ビルドツールバー（7カテゴリ常設）とインフラ/ランドマーク用サブパネルを構築する。 */
  private createBuildMenu(container: HTMLElement): void {
    const wrapper = document.createElement("div");
    wrapper.id = "build-toolbar-wrapper";
    wrapper.className = "build-toolbar-wrapper";

    const subpanel = document.createElement("div");
    subpanel.id = "build-subpanel";
    subpanel.className = "build-subpanel glass";
    wrapper.appendChild(subpanel);

    const toolbar = document.createElement("div");
    toolbar.id = "build-toolbar";
    toolbar.className = "build-toolbar glass";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "建設カテゴリ");

    const categories: BuildingCategory[] = [
      "road",
      "residential",
      "commercial",
      "industrial",
      "infrastructure",
      "landmark",
      "demolish",
    ];

    categories.forEach((cat) => {
      const tool = BUILDING_TOOLS[cat];
      const btn = document.createElement("button");
      btn.className = `build-cat-btn build-cat-${cat}${cat === this.currentTab ? " active" : ""}`;
      btn.dataset.category = cat;
      btn.title = tool.label;
      btn.setAttribute("aria-pressed", cat === this.currentTab ? "true" : "false");
      btn.innerHTML = `<span class="build-cat-icon" aria-hidden="true">${tool.icon}</span><span class="build-cat-label">${tool.label}</span>`;
      btn.addEventListener("click", () => this.switchTab(cat));
      toolbar.appendChild(btn);
    });

    wrapper.appendChild(toolbar);
    container.appendChild(wrapper);

    // 初期表示（インフラ/ランドマーク以外はサブパネル非表示）
    this.updateBuildContent(this.currentTab);
  }

  private switchTab(category: BuildingCategory): void {
    this.currentTab = category;
    this.engine.state.buildMode = category;
    this.engine.state.selectedInfrastructure = this.selectedInfrastructure;
    this.engine.state.selectedLandmark = this.selectedLandmark;

    // タブ表示の更新
    document.querySelectorAll(".build-cat-btn").forEach((btn) => {
      const el = btn as HTMLElement;
      const isActive = el.dataset.category === category;
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    // コンテンツ更新
    this.updateBuildContent(category);
  }

  private updateBuildContent(category: BuildingCategory): void {
    const subpanel = document.getElementById("build-subpanel");
    if (!subpanel) return;

    subpanel.innerHTML = "";

    if (category === "infrastructure") {
      this.createInfrastructureOptions(subpanel);
      subpanel.classList.add("open");
    } else if (category === "landmark") {
      this.createLandmarkOptions(subpanel);
      subpanel.classList.add("open");
    } else {
      subpanel.classList.remove("open");
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
    INFRASTRUCTURE_META.forEach(({ type, name, icon }) => {
      const cost = BUILD_COSTS[type] ?? 0;
      const color = INFRASTRUCTURE_COLORS[type] || "#999";
      const card = this.createBuildCard(
        type,
        name,
        icon,
        color,
        cost,
        type === this.selectedInfrastructure,
        () => {
          this.selectedInfrastructure = type;
          this.engine.state.selectedInfrastructure = type;
          container.querySelectorAll(".build-card").forEach((b) => b.classList.remove("active"));
        },
      );
      container.appendChild(card);
    });
  }

  private createLandmarkOptions(container: HTMLElement): void {
    LANDMARK_META.forEach(({ type, name, icon }) => {
      const cost = BUILD_COSTS[`landmark_${type}`] ?? 0;
      const color = LANDMARK_COLORS[type] || "#999";
      const card = this.createBuildCard(
        type,
        name,
        icon,
        color,
        cost,
        type === this.selectedLandmark,
        () => {
          this.selectedLandmark = type;
          this.engine.state.selectedLandmark = type;
          container.querySelectorAll(".build-card").forEach((b) => b.classList.remove("active"));
        },
      );
      container.appendChild(card);
    });
  }

  /** インフラ/ランドマークのサブパネルカードを1個生成する。資金不足時は視覚的に減衰させる。 */
  private createBuildCard(
    type: string,
    name: string,
    icon: string,
    color: string,
    cost: number,
    active: boolean,
    onSelect: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `build-card${active ? " active" : ""}`;
    btn.dataset.type = type;

    const affordable = this.engine.state.settings.sandbox || this.engine.state.money >= cost;
    if (!affordable) btn.classList.add("unaffordable");

    btn.innerHTML = `
      <span class="build-card-swatch" style="background-color: ${color};"></span>
      <span class="build-card-body">
        <span class="build-card-name">${icon} ${name}</span>
        <span class="build-card-cost">¥${cost.toLocaleString()}</span>
      </span>
    `;

    btn.addEventListener("click", () => {
      onSelect();
      btn.classList.add("active");
    });

    return btn;
  }

  /** 要素が存在する場合のみ textContent を更新する（レイアウトにより一部要素が無くても例外を投げない）。
   *  前回書き込んだ値と同一なら DOM 書き込みをスキップする。 */
  private setText(id: string, value: string): void {
    if (this.lastText.get(id) === value) return;
    const el = document.getElementById(id);
    if (el) el.textContent = value;
    this.lastText.set(id, value);
  }

  /** `${id}-bar` 要素内のミニバー（高さ3px）の幅と色を 0-100 の値に応じて更新する（存在しなければ何もしない）。
   *  前回書き込んだ値と同一なら DOM 書き込みをスキップする。 */
  private setBar(id: string, value: number): void {
    const key = `bar:${id}`;
    const rounded = Math.round(value).toString();
    if (this.lastText.get(key) === rounded) return;
    this.lastText.set(key, rounded);

    const fill = document.querySelector<HTMLElement>(`#${id}-bar .stat-bar-fill`);
    if (!fill) return;

    const pct = Math.max(0, Math.min(100, Math.round(value)));
    fill.style.width = `${pct}%`;
    fill.classList.toggle("bar-success", pct >= 60);
    fill.classList.toggle("bar-mid", pct >= 30 && pct < 60);
    fill.classList.toggle("bar-danger", pct < 30);
  }

  updateDisplay(): void {
    const population = this.engine.state.population;
    const money = this.engine.state.money;

    this.setText("stat-population", (population / 1000).toFixed(1) + "K");

    // サンドボックスモードの場合は∞表記、通常モードは金額表示
    if (this.engine.state.settings.sandbox) {
      this.setText("stat-money", "∞");
    } else {
      this.setText("stat-money", `¥${(money / 1000).toFixed(0)}K`);
    }

    this.setText("stat-comfort", Math.round(this.engine.state.comfort).toString());
    this.setBar("stat-comfort", this.engine.state.comfort);
    this.setText("stat-month", this.engine.state.month.toString());

    // 新パラメータ表示
    this.setText("stat-security", Math.round(this.engine.state.securityLevel).toString());
    this.setBar("stat-security", this.engine.state.securityLevel);
    this.setText("stat-safety", Math.round(this.engine.state.safetyLevel).toString());
    this.setBar("stat-safety", this.engine.state.safetyLevel);
    this.setText("stat-education", Math.round(this.engine.state.educationLevel).toString());
    this.setBar("stat-education", this.engine.state.educationLevel);
    this.setText("stat-medical", Math.round(this.engine.state.medicalLevel).toString());
    this.setBar("stat-medical", this.engine.state.medicalLevel);
    this.setText("stat-tourism", Math.round(this.engine.state.tourismLevel).toString());
    this.setBar("stat-tourism", this.engine.state.tourismLevel);
    this.setText("stat-international", Math.round(this.engine.state.internationalLevel).toString());
    this.setBar("stat-international", this.engine.state.internationalLevel);
    this.setText("stat-power", Math.round(this.engine.state.powerSupplyRate).toString() + "%");
    this.setBar("stat-power", this.engine.state.powerSupplyRate);
    this.setText("stat-water", Math.round(this.engine.state.waterSupplyRate).toString() + "%");
    this.setBar("stat-water", this.engine.state.waterSupplyRate);

    // 需要値をダッシュボードに表示
    const residentialDemand = Math.round(this.engine.state.residentialDemand);
    const commercialDemand = Math.round(this.engine.state.commercialDemand);
    const industrialDemand = Math.round(this.engine.state.industrialDemand);

    this.setText("stat-residential-demand", residentialDemand.toString());
    this.setBar("stat-residential-demand", residentialDemand);
    this.setText("stat-commercial-demand", commercialDemand.toString());
    this.setBar("stat-commercial-demand", commercialDemand);
    this.setText("stat-industrial-demand", industrialDemand.toString());
    this.setBar("stat-industrial-demand", industrialDemand);

    // モバイル版の需要値表示（存在する場合のみ）
    this.setText("demand-value-residential-mobile", residentialDemand.toString());
    this.setText("demand-value-commercial-mobile", commercialDemand.toString());
    this.setText("demand-value-industrial-mobile", industrialDemand.toString());

    // 電力/水道が100%未満の場合はトップバーに警告バッジを昇格表示（50%未満はdanger）
    const supplyPill = document.getElementById("hud-supply-pill");
    if (supplyPill) {
      const minSupply = Math.min(
        this.engine.state.powerSupplyRate,
        this.engine.state.waterSupplyRate,
      );
      supplyPill.classList.toggle("hidden", minSupply >= 100);
      supplyPill.classList.toggle("hud-pill-danger", minSupply < 50);
    }
  }

  /** 現在の data-theme に合わせてテーマ切替ボタンの表示を更新する。 */
  private applyThemeIcon(): void {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const btn = document.getElementById("btn-theme-toggle");
    if (btn) btn.textContent = isLight ? "☀️" : "🌙";
    const mbtn = document.getElementById("btn-theme-toggle-mobile");
    if (mbtn) mbtn.textContent = isLight ? "☀️ ライト" : "🌙 ダーク";
  }

  /** ライト/ダークテーマを切り替え、localStorage に記憶する。 */
  private toggleTheme(): void {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("easy-cities-2d-theme", next);
    } catch {
      /* localStorage 不可の環境でも切替自体は機能させる */
    }
    this.applyThemeIcon();
  }

  private attachEventListeners(): void {
    // テーマ切り替え（ダーク/ライト）
    document
      .getElementById("btn-theme-toggle")
      ?.addEventListener("click", () => this.toggleTheme());
    document
      .getElementById("btn-theme-toggle-mobile")
      ?.addEventListener("click", () => this.toggleTheme());
    this.applyThemeIcon();

    // ⚙メニュー（controls-panel）表示/非表示トグル
    document
      .getElementById("btn-toggle-gui")
      ?.addEventListener("click", () => this.toggleControlsPanel());
    document
      .getElementById("btn-close-gui")
      ?.addEventListener("click", () => this.toggleControlsPanel());

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

    // UI パネルのドラッグ機能（HUDバー/ビルドツールバーは常設固定のためドラッグ対象から除外。
    // controls-panel の扱いはStep4でドロワー化予定のため現状のまま維持）
    this.makePanelDraggable("controls-panel");
    this.makeSimpleDraggable("demand-meter-container");
  }

  private setGameSpeed(speed: number): void {
    this.engine.state.gameSpeed = speed;
    this.engine.state.paused = speed === 0; // ポーズボタンで一時停止

    // デスクトップ用ボタンのアクティブ状態を更新
    document.querySelectorAll(".time-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });

    // モバイル用ボタンのアクティブ状態を更新
    document.querySelectorAll(".mobile-time-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    const activate = (id: string) => {
      const btn = document.getElementById(id);
      btn?.classList.add("active");
      btn?.setAttribute("aria-pressed", "true");
    };

    if (speed === 0) {
      activate("btn-pause");
    } else if (speed === 0.5) {
      activate("btn-slow");
    } else if (speed === 1) {
      activate("btn-normal");
    } else if (speed === 2) {
      activate("btn-fast");
    }

    // ポーズ中はトップバー左に警告ピルを表示
    document.getElementById("hud-pause-pill")?.classList.toggle("hidden", speed !== 0);
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

  /** ⚙メニュー（controls-panel：設定/セーブ/ロード等）の表示を切り替える。
   *  ビルドツールバーは常設化されたため、このトグルの対象は controls-panel のみ
   *  （Step4でドロワー化するまでの暫定導線）。 */
  private toggleControlsPanel(): void {
    document.getElementById("controls-panel")?.classList.toggle("hidden");
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
