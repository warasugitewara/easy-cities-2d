import { GameEngine } from "./engine";
import { StorageManager } from "./storage";
import {
  BUILD_COSTS,
  BUILDING_TOOLS,
  BuildingCategory,
  INFRASTRUCTURE_COLORS,
  LANDMARK_COLORS,
} from "./constants";
import { showToast } from "./toast";

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

/** 建設カテゴリの表示順。デスクトップのツールバーとモバイルのカテゴリチップ列で共有する。 */
const BUILD_CATEGORIES: BuildingCategory[] = [
  "road",
  "residential",
  "commercial",
  "industrial",
  "infrastructure",
  "landmark",
  "demolish",
];

export class UIManager {
  private engine: GameEngine;
  private storage: StorageManager;
  private currentSlot: number = 0;
  private currentTab: BuildingCategory = "road";
  private selectedInfrastructure: string = "station";
  private selectedLandmark: string = "stadium";
  private lastText = new Map<string, string>();
  // Step7 UI: 破産の猶予モーダルを多重表示しないための内部フラグ。
  // gameOver=true を検知した最初のフレームでのみ表示し、救済アクション（やり直す/
  // サンドボックスで続ける）実行時に false へ戻す。ロード成功時は state 差し替えにより
  // gameOver が false になるため、次フレームの updateDisplay() で自然に再表示可能になる。
  private bankruptShown = false;

  constructor(engine: GameEngine, storage: StorageManager) {
    this.engine = engine;
    this.storage = storage;
    this.setupUI();
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

  /** モバイル版UI：画面下端固定のボトムシート。上端に主要指標ストリップ（資金/人口/月）を
   *  タブ外で常設し、その下に4タブ（ステータス/建設/時間/メニュー）を配置する。
   *  グラバーハンドルのタップでシート高さを2段階（標準45vh / 縮小25vh）にトグルできる。 */
  private setupMobileUI(container: HTMLElement): void {
    const mobilePanel = document.createElement("div");
    mobilePanel.id = "mobile-panel";
    mobilePanel.className = "mobile-panel glass";

    // グラバーハンドル（シート高さの2段階トグル。クラス付替のみで高さを切り替える）
    const grabber = document.createElement("button");
    grabber.type = "button";
    grabber.id = "mobile-sheet-grabber";
    grabber.className = "mobile-sheet-grabber";
    grabber.setAttribute("aria-label", "パネルの高さを切り替え");
    grabber.setAttribute("aria-expanded", "true");
    grabber.innerHTML = `<span class="mobile-sheet-handle" aria-hidden="true"></span>`;
    grabber.addEventListener("click", () => {
      const collapsed = mobilePanel.classList.toggle("sheet-collapsed");
      grabber.setAttribute("aria-expanded", String(!collapsed));
    });
    mobilePanel.appendChild(grabber);

    // 主要指標ストリップ（資金/人口/月）。stat-money/stat-population/stat-month の
    // 実体はページ全体でここ1箇所のみ（ステータスタブ側には置かない＝ID重複回避）。
    const statStrip = document.createElement("div");
    statStrip.className = "mobile-stat-strip";
    statStrip.setAttribute("role", "group");
    statStrip.setAttribute("aria-label", "主要指標");
    statStrip.innerHTML = `
      ${this.statChipHTML("stat-money", "💰", "資金", { primary: true, valueClass: "stat-gold" })}
      ${this.statChipHTML("stat-population", "👥", "人口", { primary: true })}
      ${this.statChipHTML("stat-month", "📅", "月", { primary: true })}
    `;
    mobilePanel.appendChild(statStrip);

    // タブボタン
    const tabBar = document.createElement("div");
    tabBar.className = "mobile-tab-bar";
    tabBar.setAttribute("role", "tablist");
    tabBar.setAttribute("aria-label", "モバイルメニュー");
    const tabDefs: { tab: string; icon: string; label: string }[] = [
      { tab: "stats", icon: "📊", label: "ステータス" },
      { tab: "build", icon: "🏗️", label: "建設" },
      { tab: "time", icon: "⏱️", label: "時間" },
      { tab: "menu", icon: "⚙️", label: "メニュー" },
    ];
    tabBar.innerHTML = tabDefs
      .map(
        ({ tab, icon, label }) => `
      <button class="mobile-tab-btn${tab === "stats" ? " active" : ""}" data-tab="${tab}"
        role="tab" id="mobile-tab-btn-${tab}" aria-controls="mobile-pane-${tab}"
        aria-selected="${tab === "stats" ? "true" : "false"}">
        <span class="mobile-tab-icon" aria-hidden="true">${icon}</span>
        <span class="mobile-tab-label">${label}</span>
      </button>`,
      )
      .join("");
    mobilePanel.appendChild(tabBar);

    // タブコンテンツ
    const tabContent = document.createElement("div");
    tabContent.className = "mobile-tab-content";
    tabContent.id = "mobile-tab-content";

    // ステータスタブ（副次指標のみ。主要3指標は上のストリップが唯一の実体）
    const statsTab = document.createElement("div");
    statsTab.className = "mobile-tab-pane active";
    statsTab.dataset.tab = "stats";
    statsTab.id = "mobile-pane-stats";
    statsTab.setAttribute("role", "tabpanel");
    statsTab.setAttribute("aria-labelledby", "mobile-tab-btn-stats");
    statsTab.innerHTML = `
      <div class="mobile-stats-grid">
        ${this.statChipHTML("stat-comfort", "😊", "快適度", { bar: true })}
        ${this.statChipHTML("stat-security", "🔒", "治安", { bar: true })}
        ${this.statChipHTML("stat-safety", "🛡️", "安全", { bar: true })}
        ${this.statChipHTML("stat-education", "📚", "教育", { bar: true })}
        ${this.statChipHTML("stat-medical", "⚕️", "医療", { bar: true })}
        ${this.statChipHTML("stat-tourism", "🎭", "観光", { bar: true })}
        ${this.statChipHTML("stat-international", "✈️", "国際", { bar: true })}
        ${this.statChipHTML("stat-power", "📡", "電力", { bar: true })}
        ${this.statChipHTML("stat-water", "💧", "水道", { bar: true })}
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
      <div class="mobile-budget-section">
        <div class="mobile-budget-title">📊 収支</div>
        <div class="budget-row">
          <span class="budget-label">税収</span>
          <span class="budget-value budget-positive" id="budget-revenue-mobile">+¥0</span>
        </div>
        <div class="budget-row">
          <span class="budget-label">維持費</span>
          <span class="budget-value budget-neutral" id="budget-maintenance-mobile">-¥0</span>
        </div>
        <div class="budget-row" id="budget-disaster-row-mobile">
          <span class="budget-label">災害</span>
          <span class="budget-value budget-negative" id="budget-disaster-mobile">-¥0</span>
        </div>
        <div class="budget-row budget-row-net">
          <span class="budget-label">純益</span>
          <span class="budget-value" id="budget-net-mobile">+¥0</span>
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
      const demandContainer = document.getElementById("demand-meter-container-mobile");
      if (demandContainer) {
        demandContainer.style.display = demandContainer.style.display === "none" ? "block" : "none";
        this.engine.state.showDemandMeters = demandContainer.style.display !== "none";
      }
    });
    statsTab.appendChild(toggleDemandBtn);

    // 建設タブ
    const buildTab = document.createElement("div");
    buildTab.className = "mobile-tab-pane";
    buildTab.dataset.tab = "build";
    buildTab.id = "mobile-pane-build";
    buildTab.setAttribute("role", "tabpanel");
    buildTab.setAttribute("aria-labelledby", "mobile-tab-btn-build");
    this.createMobileBuildMenu(buildTab);
    tabContent.appendChild(buildTab);

    // 時間制御タブ（既存4ボタンのID/挙動は維持。表記はデスクトップと同じ0.5x/1x/2x）
    const timeTab = document.createElement("div");
    timeTab.className = "mobile-tab-pane";
    timeTab.dataset.tab = "time";
    timeTab.id = "mobile-pane-time";
    timeTab.setAttribute("role", "tabpanel");
    timeTab.setAttribute("aria-labelledby", "mobile-tab-btn-time");
    timeTab.innerHTML = `
      <div class="mobile-time-controls" role="toolbar" aria-label="時間コントロール">
        <button id="btn-pause" class="mobile-time-btn" aria-pressed="false" title="ポーズ">
          <span aria-hidden="true">⏸</span><span class="mobile-time-label">ポーズ</span>
        </button>
        <button id="btn-slow" class="mobile-time-btn" aria-pressed="false" title="0.5倍速">
          <span aria-hidden="true">⏪</span><span class="mobile-time-label">0.5x</span>
        </button>
        <button id="btn-normal" class="mobile-time-btn active" aria-pressed="true" title="通常速度">
          <span aria-hidden="true">▶</span><span class="mobile-time-label">1x</span>
        </button>
        <button id="btn-fast" class="mobile-time-btn" aria-pressed="false" title="2倍速">
          <span aria-hidden="true">⏩</span><span class="mobile-time-label">2x</span>
        </button>
      </div>
    `;
    tabContent.appendChild(timeTab);

    // メニュータブ
    const menuTab = document.createElement("div");
    menuTab.className = "mobile-tab-pane";
    menuTab.dataset.tab = "menu";
    menuTab.id = "mobile-pane-menu";
    menuTab.setAttribute("role", "tabpanel");
    menuTab.setAttribute("aria-labelledby", "mobile-tab-btn-menu");
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

    // 建設タブの説明文/オプショングリッドの初期表示。document への接続後に行う
    // （接続前だと updateMobileBuildContent 内の document.getElementById が要素を
    //  見つけられず何もしないため、ここで改めて呼び出す）。
    this.updateMobileBuildContent(this.currentTab);

    // タブ切り替えハンドラ
    tabBar.querySelectorAll(".mobile-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab;
        this.switchMobileTab(tab!);
      });
    });
  }

  /** 建設タブの中身：7カテゴリの横スクロールチップ列＋インフラ/ランドマーク用オプショングリッド。 */
  private createMobileBuildMenu(container: HTMLElement): void {
    const chipsRow = document.createElement("div");
    chipsRow.id = "mobile-category-chips";
    chipsRow.className = "mobile-chip-row";
    chipsRow.setAttribute("role", "toolbar");
    chipsRow.setAttribute("aria-label", "建設カテゴリ");

    BUILD_CATEGORIES.forEach((cat) => {
      const tool = BUILDING_TOOLS[cat];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `mobile-chip mobile-chip-${cat}${cat === this.currentTab ? " active" : ""}`;
      btn.dataset.category = cat;
      btn.setAttribute("aria-pressed", cat === this.currentTab ? "true" : "false");
      btn.innerHTML = `
        <span class="mobile-chip-dot" aria-hidden="true"></span>
        <span class="mobile-chip-icon" aria-hidden="true">${tool.icon}</span>
        <span class="mobile-chip-label">${tool.label}</span>
      `;
      btn.addEventListener("click", () => this.switchTab(cat));
      chipsRow.appendChild(btn);
    });
    container.appendChild(chipsRow);

    // 説明
    const description = document.createElement("div");
    description.id = "mobile-build-description";
    description.className = "mobile-build-description";
    container.appendChild(description);

    // オプション（インフラ/ランドマークのみ、デスクトップと同じ build-card を再利用）
    const options = document.createElement("div");
    options.id = "mobile-build-options";
    options.className = "mobile-build-options";
    container.appendChild(options);
  }

  /** モバイル建設タブのカテゴリチップのアクティブ表示・説明文・オプショングリッドを更新する。
   *  カード生成はデスクトップと共通の createInfrastructureOptions/createLandmarkOptions
   *  （＝ INFRASTRUCTURE_META/LANDMARK_META + BUILD_COSTS）を再利用し、コスト定義の重複を避ける。 */
  private updateMobileBuildContent(category: BuildingCategory): void {
    document.querySelectorAll(".mobile-chip").forEach((btn) => {
      const el = btn as HTMLElement;
      const isActive = el.dataset.category === category;
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const descDiv = document.getElementById("mobile-build-description");
    const optionsDiv = document.getElementById("mobile-build-options");
    if (!descDiv || !optionsDiv) return;

    const tool = BUILDING_TOOLS[category];
    descDiv.textContent = `${tool.icon} ${tool.label} — ${this.getDescriptionForCategory(category)}`;

    optionsDiv.innerHTML = "";
    if (category === "infrastructure") {
      this.createInfrastructureOptions(optionsDiv);
    } else if (category === "landmark") {
      this.createLandmarkOptions(optionsDiv);
    }
  }

  private switchMobileTab(tab: string): void {
    // タブボタン更新
    document.querySelectorAll(".mobile-tab-btn").forEach((btn) => {
      const element = btn as HTMLElement;
      const isActive = element.dataset.tab === tab;
      element.classList.toggle("active", isActive);
      element.setAttribute("aria-selected", isActive ? "true" : "false");
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

    // 月次収支パネル（左下、折畳）
    this.createBudgetPanel(container);

    // ⚙メニュー（右サイドのスライドインドロワー）
    this.createMenuDrawer(container);
  }

  /** 月次収支パネル（左下折畳、§4-d。デスクトップのみ）。ヘッダは常に今月純益のサマリーを
   *  表示し、クリックで税収/維持費/災害/純益の内訳を展開する。数値は updateDisplay() 内の
   *  updateBudgetPanel() が engine.state.lastReport から反映する。 */
  private createBudgetPanel(container: HTMLElement): void {
    const panel = document.createElement("div");
    panel.id = "budget-panel";
    panel.className = "budget-panel glass";
    panel.innerHTML = `
      <button id="budget-panel-toggle" class="budget-panel-header" aria-expanded="false" aria-controls="budget-panel-body">
        <span class="budget-panel-title">📊 収支</span>
        <span class="budget-panel-net" id="budget-net-summary">今月純益 +¥0</span>
        <span class="budget-panel-caret" aria-hidden="true">▾</span>
      </button>
      <div id="budget-panel-body" class="budget-panel-body">
        <div class="budget-panel-body-inner">
          <div class="budget-row">
            <span class="budget-label">税収</span>
            <span class="budget-value budget-positive" id="budget-revenue">+¥0</span>
          </div>
          <div class="budget-row">
            <span class="budget-label">維持費</span>
            <span class="budget-value budget-neutral" id="budget-maintenance">-¥0</span>
          </div>
          <div class="budget-row" id="budget-disaster-row">
            <span class="budget-label">災害</span>
            <span class="budget-value budget-negative" id="budget-disaster">-¥0</span>
          </div>
          <div class="budget-row budget-row-net">
            <span class="budget-label">純益</span>
            <span class="budget-value" id="budget-net">+¥0</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(panel);

    const toggle = panel.querySelector<HTMLButtonElement>("#budget-panel-toggle");
    toggle?.addEventListener("click", () => {
      const open = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /** ⚙メニュー（設定/セーブ/ロード/エクスポート/インポート）を右サイドのスライドインドロワーとして構築する。
   *  閉時は transform でオフスクリーンに退避し、開くと --t-med で translateX(0) にスライドする。 */
  private createMenuDrawer(container: HTMLElement): void {
    const overlay = document.createElement("div");
    overlay.id = "menu-drawer-overlay";
    overlay.className = "menu-drawer-overlay hidden";
    container.appendChild(overlay);

    const drawer = document.createElement("div");
    drawer.id = "controls-panel";
    drawer.className = "menu-drawer glass";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", "メニュー");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="menu-drawer-header">
        <h3>⚙️ メニュー</h3>
        <button id="btn-close-gui" class="btn-close" aria-label="メニューを閉じる">✕</button>
      </div>
      <div class="menu-drawer-body">
        <button id="btn-settings" class="btn-control">⚙️ 設定</button>
        <button id="btn-save" class="btn-control">💾 セーブ</button>
        <button id="btn-load" class="btn-control">📂 ロード</button>
        <button id="btn-export" class="btn-control">📤 エクスポート</button>
        <button id="btn-import" class="btn-control">📥 インポート</button>
      </div>
    `;
    container.appendChild(drawer);

    overlay.addEventListener("click", () => this.closeControlsPanel());
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
        <button id="btn-detail-toggle" class="hud-detail-toggle" aria-expanded="false" aria-controls="hud-detail-panel" aria-label="詳細指標の表示切り替え">▸ 詳細</button>
      </div>
      <div class="hud-time" role="toolbar" aria-label="時間コントロール">
        <button id="btn-pause" class="time-btn" aria-pressed="false" aria-label="ポーズ" title="ポーズ (Space)">⏸</button>
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

    BUILD_CATEGORIES.forEach((cat) => {
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

  /** キーボードショートカット等、UI外からビルドカテゴリを切り替えるための公開ラッパー。
   *  ツールバーのアクティブ表示・サブパネル・aria が switchTab と同じ経路で追従する。 */
  public selectCategory(category: BuildingCategory): void {
    this.switchTab(category);
  }

  private switchTab(category: BuildingCategory): void {
    this.currentTab = category;
    this.engine.state.buildMode = category;
    this.engine.state.selectedInfrastructure = this.selectedInfrastructure;
    this.engine.state.selectedLandmark = this.selectedLandmark;

    // デスクトップ：ツールバーのアクティブ表示＋サブパネル更新
    document.querySelectorAll(".build-cat-btn").forEach((btn) => {
      const el = btn as HTMLElement;
      const isActive = el.dataset.category === category;
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    this.updateBuildContent(category);

    // モバイル：カテゴリチップのアクティブ表示＋オプショングリッド更新
    // （モバイルレイアウトが構築されていない場合は対象要素が無く何もしない）
    this.updateMobileBuildContent(category);
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

    // Step7 UI: 月次収支パネル（デスクトップ左下折畳＋モバイル・ステータスタブ）を反映
    this.updateBudgetPanel();

    // Step7 UI: 破産の穏当化。engine.state.gameOver=true を検知したフレームで一度だけ
    // 猶予モーダルを表示する（多重表示は bankruptShown で防止）。gameOver が false の間は
    // 常に bankruptShown をリセットしておく（例: ロードで gameOver=false の保存データに
    // 差し替わった場合など、モーダル側のボタンハンドラを経由しない救済経路でも、次に
    // 本当に破産した際に確実に再表示されるようにするため）。
    if (!this.engine.state.gameOver) {
      this.bankruptShown = false;
    } else if (!this.bankruptShown) {
      this.bankruptShown = true;
      this.showBankruptModal();
    }
  }

  /** engine.state.lastReport（税収/維持費/災害/純益）をデスクトップの収支パネルと
   *  モバイルのステータスタブ内セクションの両方に反映する。 */
  private updateBudgetPanel(): void {
    const report = this.engine.state.lastReport;

    this.setBudgetMagnitude("budget-revenue", report.revenue, "+");
    this.setBudgetMagnitude("budget-revenue-mobile", report.revenue, "+");
    this.setBudgetMagnitude("budget-maintenance", report.maintenance, "-");
    this.setBudgetMagnitude("budget-maintenance-mobile", report.maintenance, "-");
    this.setBudgetMagnitude("budget-disaster", report.disaster, "-");
    this.setBudgetMagnitude("budget-disaster-mobile", report.disaster, "-");

    this.setBudgetNet("budget-net", report.net);
    this.setBudgetNet("budget-net-mobile", report.net);
    this.setBudgetNet("budget-net-summary", report.net, "今月純益 ");

    // 災害被害が0の月は行ごと非表示にする
    const hideDisaster = report.disaster === 0;
    document.getElementById("budget-disaster-row")?.classList.toggle("hidden", hideDisaster);
    document.getElementById("budget-disaster-row-mobile")?.classList.toggle("hidden", hideDisaster);
  }

  /** 収支内訳1行分（税収/維持費/災害）を書き込む。値は常に非負の金額として渡し、
   *  行の意味に応じた符号（+/-）を prefix で固定する。 */
  private setBudgetMagnitude(id: string, amount: number, prefix: "+" | "-"): void {
    const rounded = Math.max(0, Math.round(amount));
    this.setText(id, `${prefix}¥${rounded.toLocaleString()}`);
  }

  /** 純益（符号付き）を書き込み、正負に応じて success/danger の色クラスを切り替える。 */
  private setBudgetNet(id: string, amount: number, labelPrefix = ""): void {
    const rounded = Math.round(amount);
    const positive = rounded >= 0;
    this.setText(id, `${labelPrefix}${positive ? "+" : "-"}¥${Math.abs(rounded).toLocaleString()}`);

    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle("budget-positive", positive);
      el.classList.toggle("budget-negative", !positive);
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

    // ⚙メニュードロワーの開閉
    document
      .getElementById("btn-toggle-gui")
      ?.addEventListener("click", () => this.toggleControlsPanel());
    document
      .getElementById("btn-close-gui")
      ?.addEventListener("click", () => this.closeControlsPanel());

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

    // Escキーでメニュードロワーを閉じる（開いているモーダルがある場合はモーダル側のEscで処理される）
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") this.closeControlsPanel();
    });
  }

  /** キーボードショートカット（Space/1/2/3）等、UI外からゲーム速度を切り替えるための公開ラッパー。
   *  時間ボタンのアクティブ表示・aria-pressed が setGameSpeed と同じ経路で追従する。 */
  public setSpeed(speed: number): void {
    this.setGameSpeed(speed);
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
      btn.setAttribute("aria-pressed", "false");
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

  /** ⚙メニュードロワーの開閉をトグルする。開くときは閉じるボタンへ、
   *  閉じるときは⚙ボタンへフォーカスを戻す。 */
  private toggleControlsPanel(): void {
    const panel = document.getElementById("controls-panel");
    if (!panel) return;
    if (panel.classList.contains("open")) {
      this.closeControlsPanel();
      return;
    }

    const overlay = document.getElementById("menu-drawer-overlay");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    overlay?.classList.remove("hidden");
    document.getElementById("btn-close-gui")?.focus();
  }

  /** ⚙メニュードロワーを閉じる（既に閉じている場合は何もしない）。 */
  private closeControlsPanel(): void {
    const panel = document.getElementById("controls-panel");
    if (!panel || !panel.classList.contains("open")) return;

    const overlay = document.getElementById("menu-drawer-overlay");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    overlay?.classList.add("hidden");
    document.getElementById("btn-toggle-gui")?.focus();
  }

  /** チェックボックス1個分のトグルスイッチ行 (`.toggle-row` + `.switch`) の HTML を生成する。 */
  private toggleRowHTML(id: string, label: string, checked: boolean | undefined): string {
    return `
      <label class="toggle-row" for="${id}">
        <span class="toggle-row-label">${label}</span>
        <span class="switch">
          <input type="checkbox" id="${id}" ${checked ? "checked" : ""}>
          <span class="switch-track" aria-hidden="true"></span>
        </span>
      </label>`;
  }

  /** モーダル共通の a11y 挙動をセットアップする：
   *  - 開時に最初のフォーカス可能要素へフォーカス
   *  - 背景（オーバーレイ）クリックで close()（dismissible=false の場合は無効）
   *  - Escキーで close()（dismissible=false の場合は無効）
   *  - Tabキーでモーダル内をループするフォーカストラップ
   *  dismissible=false は、破産の猶予モーダル（§5-5）のように3択のいずれかを必ず
   *  選ばせたい場合に使う（未指定時は従来通り true）。 */
  private setupModalBehavior(
    modal: HTMLElement,
    content: HTMLElement,
    close: () => void,
    options: { dismissible?: boolean } = {},
  ): void {
    const dismissible = options.dismissible ?? true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    // タイトル（h2/h3、id付き）があれば aria-labelledby で紐付ける
    const heading = content.querySelector<HTMLElement>("h2[id], h3[id]");
    if (heading) modal.setAttribute("aria-labelledby", heading.id);

    const focusable = (): HTMLElement[] =>
      Array.from(
        content.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

    focusable()[0]?.focus();

    modal.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!dismissible) return;
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    modal.addEventListener("click", (e) => {
      if (!dismissible) return;
      if (e.target === modal) close();
    });
  }

  private showSettings(): void {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2 id="modal-title-settings">ゲーム設定</h2>
        <div class="settings-group">
          ${this.toggleRowHTML("toggle-sandbox", "🎮 サンドボックスモード（資金∞）", this.engine.state.settings.sandbox)}
          ${this.toggleRowHTML("toggle-disasters", "災害システム", this.engine.state.settings.disastersEnabled)}
          ${this.toggleRowHTML("toggle-pollution", "公害システム", this.engine.state.settings.pollutionEnabled)}
          ${this.toggleRowHTML("toggle-slum", "スラム化システム", this.engine.state.settings.slumEnabled)}
        </div>
        <section class="modal-section">
          <h3 class="modal-section-title">キーボードショートカット</h3>
          <dl class="shortcut-list">
            <div class="shortcut-row"><dt><kbd>R</kbd></dt><dd>道路</dd></div>
            <div class="shortcut-row"><dt><kbd>S</kbd></dt><dd>住宅</dd></div>
            <div class="shortcut-row"><dt><kbd>C</kbd></dt><dd>商業</dd></div>
            <div class="shortcut-row"><dt><kbd>I</kbd></dt><dd>工業</dd></div>
            <div class="shortcut-row"><dt><kbd>U</kbd></dt><dd>インフラ</dd></div>
            <div class="shortcut-row"><dt><kbd>D</kbd></dt><dd>削除</dd></div>
            <div class="shortcut-row"><dt><kbd>Space</kbd></dt><dd>一時停止／再開</dd></div>
            <div class="shortcut-row"><dt><kbd>1</kbd></dt><dd>0.5倍速</dd></div>
            <div class="shortcut-row"><dt><kbd>2</kbd></dt><dd>通常速度</dd></div>
            <div class="shortcut-row"><dt><kbd>3</kbd></dt><dd>2倍速</dd></div>
            <div class="shortcut-row"><dt><kbd>Esc</kbd></dt><dd>メニュー／モーダルを閉じる</dd></div>
          </dl>
        </section>
        <div class="modal-buttons">
          <button id="btn-settings-apply" class="btn-primary">適用</button>
          <button id="btn-settings-close" class="btn-secondary">キャンセル</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const content = modal.querySelector<HTMLElement>(".modal-content");
    if (!content) return;

    const close = (): void => modal.remove();
    this.setupModalBehavior(modal, content, close);

    content.querySelector("#btn-settings-apply")?.addEventListener("click", () => {
      const sandbox = content.querySelector<HTMLInputElement>("#toggle-sandbox");
      const disasters = content.querySelector<HTMLInputElement>("#toggle-disasters");
      const pollution = content.querySelector<HTMLInputElement>("#toggle-pollution");
      const slum = content.querySelector<HTMLInputElement>("#toggle-slum");
      if (sandbox) this.engine.state.settings.sandbox = sandbox.checked;
      if (disasters) this.engine.state.settings.disastersEnabled = disasters.checked;
      if (pollution) this.engine.state.settings.pollutionEnabled = pollution.checked;
      if (slum) this.engine.state.settings.slumEnabled = slum.checked;
      close();
    });

    content.querySelector("#btn-settings-close")?.addEventListener("click", close);
  }

  private showSaveSlots(): void {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2 id="modal-title-save">セーブ</h2>
        <div class="slots">
          ${[0, 1, 2].map((i) => `<button class="slot-btn" data-slot="${i}">スロット ${i + 1}</button>`).join("")}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const content = modal.querySelector<HTMLElement>(".modal-content");
    if (!content) return;

    const close = (): void => modal.remove();
    this.setupModalBehavior(modal, content, close);

    content.querySelectorAll(".slot-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const slot = parseInt((e.target as HTMLElement).dataset.slot || "0");
        this.storage.saveGame(slot, this.engine.state);
        showToast(`スロット ${slot + 1} にセーブしました`, "success");
        close();
      });
    });
  }

  private showLoadSlots(): void {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2 id="modal-title-load">ロード</h2>
        <div class="slots">
          ${[0, 1, 2].map((i) => `<button class="slot-btn" data-slot="${i}">スロット ${i + 1}</button>`).join("")}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const content = modal.querySelector<HTMLElement>(".modal-content");
    if (!content) return;

    const close = (): void => modal.remove();
    this.setupModalBehavior(modal, content, close);

    content.querySelectorAll(".slot-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const slot = parseInt((e.target as HTMLElement).dataset.slot || "0");
        const state = this.storage.loadGame(slot, this.engine.state.gridSize);
        if (state) {
          this.engine.state = state;
          // powerGrid/waterGridは保存されない派生値のため、ロード直後に再計算する。
          this.engine.updateInfrastructure();
          this.updateDisplay();
          showToast(`スロット ${slot + 1} からロードしました`, "success");
        } else {
          showToast("セーブデータを読み込めませんでした", "error");
        }
        close();
      });
    });
  }

  /** 破産の猶予モーダル（§5-5）。engine.state.gameOver=true を検知した updateDisplay() の
   *  フレームで一度だけ呼ばれる。3択で必ずどれかを選ばせるため、他モーダルと異なり
   *  Esc/背景クリックでは閉じない（dismissible: false）。 */
  private showBankruptModal(): void {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2 id="modal-title-bankrupt">💸 財政破綻</h2>
        <p class="modal-lead">資金がマイナスになりました。都市の立て直し方法を選んでください。</p>
        <div class="modal-buttons-vertical">
          <button id="btn-bankrupt-sandbox" class="btn-primary">🎮 サンドボックスで続ける</button>
          <button id="btn-bankrupt-load" class="btn-secondary">📂 セーブをロード</button>
          <button id="btn-bankrupt-restart" class="btn-secondary">🔄 最初からやり直す</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const content = modal.querySelector<HTMLElement>(".modal-content");
    if (!content) return;

    const close = (): void => modal.remove();
    this.setupModalBehavior(modal, content, close, { dismissible: false });

    content.querySelector("#btn-bankrupt-restart")?.addEventListener("click", () => {
      this.engine.reset();
      this.bankruptShown = false;
      close();
      this.updateDisplay();
      showToast("新しい都市を始めました", "info");
    });

    content.querySelector("#btn-bankrupt-load")?.addEventListener("click", () => {
      close();
      this.showLoadSlots();
    });

    content.querySelector("#btn-bankrupt-sandbox")?.addEventListener("click", () => {
      this.engine.state.settings.sandbox = true;
      this.engine.state.gameOver = false;
      this.engine.state.paused = false;
      this.bankruptShown = false;
      close();
      this.updateDisplay();
      showToast("サンドボックスモードで続行します", "info");
    });
  }

  private exportGame(): void {
    const data = this.storage.exportToJSON(this.engine.state);
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
        const jsonString = event.target?.result;
        if (typeof jsonString !== "string") {
          showToast("セーブデータを読み込めませんでした", "error");
          return;
        }
        const state = this.storage.importFromJSON(jsonString, this.engine.state.gridSize);
        if (state) {
          this.engine.state = state;
          // powerGrid/waterGridは保存されない派生値のため、インポート直後に再計算する。
          this.engine.updateInfrastructure();
          this.updateDisplay();
          showToast("ゲームをインポートしました", "success");
        } else {
          showToast("セーブデータを読み込めませんでした", "error");
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }
}
