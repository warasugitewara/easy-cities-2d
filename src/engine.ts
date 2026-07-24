import {
  MapSize,
  MAP_SIZES,
  TileType,
  POPULATION_TABLE,
  TAX_REVENUE,
  MAINTENANCE_COSTS,
  BUILD_COSTS,
  BuildingCategory,
  BUILDING_SIZES,
  INITIAL_PARAMETERS,
  INFRASTRUCTURE_REQUIREMENTS,
  INFRASTRUCTURE_EFFECTS,
  DISASTER_BALANCE,
  LANDMARK_EFFECTS,
  SYNERGY_EFFECTS,
  CITY_LEVEL_MODEL,
  DEMAND_MODEL,
  GROWTH_BALANCE,
  COMFORT_MODEL,
} from "./constants";
import type { RNG } from "./rng";
import { defaultRng } from "./rng";

// ゲーム設定インターフェース
export interface GameSettings {
  difficulty: "easy" | "normal" | "hard";
  mapSize: MapSize;
  disastersEnabled: boolean;
  pollutionEnabled: boolean;
  slumEnabled: boolean;
  sandbox?: boolean; // サンドボックスモード（資金∞）
}

export interface GameState {
  map: number[][];
  population: number;
  money: number;
  comfort: number;
  month: number;
  paused: boolean;
  buildMode: BuildingCategory;
  settings: GameSettings;
  gridSize: number;
  selectedInfrastructure: string;
  selectedLandmark: string;
  gameSpeed: number;
  // インフラシステム
  powerGrid: boolean[][];
  waterGrid: boolean[][];
  fireMap: number[][]; // 火災レベル（0=なし、1-10=火の強さ）
  diseaseMap: number[][]; // 病気レベル（0=なし、1-10=病気の強さ）
  pollutionMap: number[][]; // 汚染度（0-100）
  slumMap: number[][]; // スラム化レベル（0=なし、1-10=スラム化の強さ）
  // 詳細パラメータ
  securityLevel: number; // 治安度（0-100）
  safetyLevel: number; // 安全度（0-100）
  educationLevel: number; // 教育度（0-100）
  medicalLevel: number; // 医療度（0-100）
  tourismLevel: number; // 観光度（0-100）
  internationalLevel: number; // 国際化度（0-100）
  powerSupplyRate: number; // 電力供給率（％）
  waterSupplyRate: number; // 給水率（％）
  pollutionLevel: number; // 全体汚染度（0-100）
  slumRate: number; // スラム化率（0-100）
  // 需要メータ
  residentialDemand: number; // 住宅地需要（0-100）
  commercialDemand: number; // 商業地需要（0-100）
  industrialDemand: number; // 工業地需要（0-100）
  showDemandMeters: boolean; // 需要メータ表示フラグ
  // ペナルティシステム
  growthPenalty: number; // 成長速度補正係数（1.0 = 通常、0.5 = 50%低下）
  revenuePenalty: number; // 税収補正係数（1.0 = 通常）
}

export class GameEngine {
  private _state: GameState;
  // Step4リバランス: 初期値を GROWTH_BALANCE.baseRate から取る（値自体は旧 0.02 のまま不変）。
  private growthRate: number = GROWTH_BALANCE.baseRate;
  private gridSize: number;
  private maintenanceMultiplier: number = 1.0;
  private disasterRateMultiplier: number = 1.0;
  private initialMoney: number = 250000; // 難易度別の初期資金。快適度の fundScore の基準に使う。
  // Step2リバランス: 火災/病気による被害費を月次で台帳化するための集計フィールド。
  // monthlyUpdate() の冒頭（updateDisasters() 呼出前）でリセットし、収支適用時に一括反映する。
  // GameState には含めない（セーブデータを汚染しない派生値のため）。
  private disasterDamage = 0;
  // Step3リバランス: 駅+学校+警察の三者シナジー成立時の商業高層化確率乗数。
  // updateInfrastructureEffects() 内で毎月再計算する派生値（GameStateには含めない）。
  private commercialGrowthMult = 1.0;

  // --- grow() 高速化用キャッシュ（GameStateには含めない: 派生値のため） ---
  private biasMap: Float64Array | null = null;
  private boostMap: Float32Array | null = null;

  // --- dev計測用（GameStateには含めない: セーブデータを汚染しないため） ---
  private static readonly PROFILE_SAMPLE_SIZE = 60;
  private growSamples: number[] = [];
  private monthlySamples: number[] = [];

  // state へのアクセスは getter/setter 経由（setter はキャッシュ無効化のフックを持つ）
  get state(): GameState {
    return this._state;
  }

  set state(value: GameState) {
    this._state = value;
    this.invalidateCaches();
  }

  // state 差し替え時に再構築が必要なキャッシュを無効化する
  private invalidateCaches(): void {
    this.biasMap = null;
    this.boostMap = null;
  }

  constructor(
    settings?: GameSettings,
    private rng: RNG = defaultRng,
  ) {
    const mapSize = settings?.mapSize || "medium";
    const difficulty = settings?.difficulty || "normal";
    this.gridSize = MAP_SIZES[mapSize].gridSize;

    // 難易度に応じた初期資金・維持費・災害率を設定
    const difficultyConfig = {
      easy: { initialMoney: 350000, maintenanceMultiplier: 0.8, disasterRateMultiplier: 0.5 },
      normal: { initialMoney: 250000, maintenanceMultiplier: 1.0, disasterRateMultiplier: 1.0 },
      hard: { initialMoney: 150000, maintenanceMultiplier: 1.2, disasterRateMultiplier: 1.5 },
    };

    const config = difficultyConfig[difficulty];
    this.maintenanceMultiplier = config.maintenanceMultiplier;
    this.disasterRateMultiplier = config.disasterRateMultiplier;
    this.initialMoney = config.initialMoney;

    this._state = {
      map: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(TileType.EMPTY)),
      population: 0,
      money: config.initialMoney,
      comfort: 50,
      month: 0,
      paused: false,
      buildMode: "road",
      gridSize: this.gridSize,
      selectedInfrastructure: "station",
      selectedLandmark: "stadium",
      gameSpeed: 1,
      powerGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      waterGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      fireMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      diseaseMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      pollutionMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      slumMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      securityLevel: INITIAL_PARAMETERS.securityLevel,
      safetyLevel: INITIAL_PARAMETERS.safetyLevel,
      educationLevel: INITIAL_PARAMETERS.educationLevel,
      medicalLevel: INITIAL_PARAMETERS.medicalLevel,
      tourismLevel: INITIAL_PARAMETERS.tourismLevel,
      internationalLevel: INITIAL_PARAMETERS.internationalLevel,
      powerSupplyRate: INITIAL_PARAMETERS.powerSupplyRate,
      waterSupplyRate: INITIAL_PARAMETERS.waterSupplyRate,
      pollutionLevel: 0,
      slumRate: 0,
      residentialDemand: 50,
      commercialDemand: 50,
      industrialDemand: 50,
      showDemandMeters: false,
      growthPenalty: 1.0,
      revenuePenalty: 1.0,
      settings: settings || {
        difficulty: "normal",
        mapSize: "medium",
        disastersEnabled: false,
        pollutionEnabled: false,
        slumEnabled: false,
        sandbox: false,
      },
    };
    // 初期に中央に駅を配置
    this.placeInitialStation();

    console.log(
      `🎮 Game initialized - Difficulty: ${difficulty}, Initial Money: ${config.initialMoney}, Maintenance: ${config.maintenanceMultiplier}x, Disasters: ${config.disasterRateMultiplier}x`,
    );
  }

  // 建設処理
  build(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) return false;

    const cost = this.getCost(this.state.buildMode);
    console.log("💰 Cost for", this.state.buildMode, ":", cost, "Money:", this.state.money);

    // サンドボックスモードでない場合のみ資金チェック
    if (!this.state.settings.sandbox && this.state.money < cost) {
      console.log("❌ Not enough money");
      return false;
    }

    if (this.state.buildMode === "demolish") {
      if (this.state.map[y][x] !== TileType.EMPTY) {
        const tileType = this.state.map[y][x];

        if (tileType === TileType.STATION) {
          this.boostMap = null;
        }

        // 複数マス占有建築物の場合、全体を削除
        if (BUILDING_SIZES[tileType]) {
          const size = BUILDING_SIZES[tileType];
          // 建築物の左上を探す（クリックされたタイルから推測）
          let startX = x;
          let startY = y;

          // 同じタイプのタイルをスキャンして左上を見つける
          for (let sy = Math.max(0, y - size.height); sy <= Math.min(this.gridSize - 1, y); sy++) {
            for (let sx = Math.max(0, x - size.width); sx <= Math.min(this.gridSize - 1, x); sx++) {
              if (this.state.map[sy][sx] === tileType) {
                // この位置が左上の候補
                let isLeftTop = true;
                // 左上に同じタイプがないか確認
                if (sx > 0 && this.state.map[sy][sx - 1] === tileType) isLeftTop = false;
                if (sy > 0 && this.state.map[sy - 1][sx] === tileType) isLeftTop = false;

                if (isLeftTop) {
                  startX = sx;
                  startY = sy;
                }
              }
            }
          }

          // 左上から始まる全タイルを削除
          for (let dy = 0; dy < size.height; dy++) {
            for (let dx = 0; dx < size.width; dx++) {
              const nx = startX + dx;
              const ny = startY + dy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                this.state.map[ny][nx] = TileType.EMPTY;
              }
            }
          }
        } else {
          // 1マス建築物の場合は通常削除
          this.state.map[y][x] = TileType.EMPTY;
        }
      }
      return true;
    }

    if (this.state.map[y][x] !== TileType.EMPTY) {
      console.log("❌ Tile not empty:", this.state.map[y][x]);
      return false;
    }

    let tileType: TileType | null = null;

    switch (this.state.buildMode) {
      case "road":
        tileType = TileType.ROAD;
        break;
      case "residential":
        tileType = TileType.RESIDENTIAL_L1;
        break;
      case "commercial":
        tileType = TileType.COMMERCIAL_L1;
        break;
      case "industrial":
        tileType = TileType.INDUSTRIAL_L1;
        break;
      case "infrastructure":
        // 選択されたインフラストラクチャータイプに応じて設置
        switch (this.state.selectedInfrastructure) {
          case "station":
            tileType = TileType.STATION;
            break;
          case "park":
            tileType = TileType.PARK;
            break;
          case "police":
            tileType = TileType.POLICE;
            break;
          case "fire_station":
            tileType = TileType.FIRE_STATION;
            break;
          case "hospital":
            tileType = TileType.HOSPITAL;
            break;
          case "school":
            tileType = TileType.SCHOOL;
            break;
          case "power_plant":
            tileType = TileType.POWER_PLANT;
            break;
          case "water_treatment":
            tileType = TileType.WATER_TREATMENT;
            break;
          default:
            tileType = TileType.STATION;
        }
        break;
      case "landmark":
        // 選択されたランドマークタイプに応じて設置
        switch (this.state.selectedLandmark) {
          case "stadium":
            tileType = TileType.LANDMARK_STADIUM;
            break;
          case "airport":
            tileType = TileType.LANDMARK_AIRPORT;
            break;
          default:
            tileType = TileType.LANDMARK_STADIUM;
        }
        break;
    }

    if (tileType !== null) {
      // 建物のサイズを取得
      const size = BUILDING_SIZES[tileType] || { width: 1, height: 1 };

      // 建物を配置可能か確認（複数マス占有対応）
      // 注: x, y は関数冒頭で 0 <= x,y < gridSize を確認済みで dx,dy は常に 0 以上のため
      // nx,ny が負になることは実際には無い（防御的にチェックのみ追加）。
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= this.gridSize ||
            ny >= this.gridSize ||
            this.state.map[ny][nx] !== TileType.EMPTY
          ) {
            console.log("❌ Not enough space for", tileType);
            return false;
          }
        }
      }

      // 建物を配置（上の確認ループで全マスの範囲内・空き地を保証済み）
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
            this.state.map[ny][nx] = tileType;
          }
        }
      }

      if (tileType === TileType.STATION) {
        this.boostMap = null;
      }

      console.log(
        "✅ Building placed, tileType:",
        tileType,
        "size:",
        size,
        "mode:",
        this.state.buildMode,
        "infrastructure:",
        this.state.selectedInfrastructure,
        "landmark:",
        this.state.selectedLandmark,
      );
      this.state.money -= cost;
      return true;
    }

    console.log("❌ tileType is null");
    return false;
  }

  // インフラ/ランドマークの個別コストは constants.ts の BUILD_COSTS に一元化されている
  // （station/park/police/... はそのままのキー、ランドマークは `landmark_${type}` キー）。
  // 値は変更前とすべて一致することを確認済み（station:5000, park:1000, police:8000,
  // fire_station:7000, hospital:10000, school:6000, power_plant:15000, water_treatment:12000,
  // landmark_stadium:50000, landmark_airport:80000）。
  private getCost(mode: BuildingCategory): number {
    if (mode === "infrastructure") {
      // 選択されたインフラのコストを返す
      return BUILD_COSTS[this.state.selectedInfrastructure] || 5000;
    } else if (mode === "landmark") {
      // 選択されたランドマークのコストを返す
      return BUILD_COSTS[`landmark_${this.state.selectedLandmark}`] || 50000;
    }
    return BUILD_COSTS[mode] || 0;
  }

  // 都心バイアスの lookup table を構築（未構築時のみ）。grow() から参照。
  private ensureBiasMap(): Float64Array {
    const cached = this.biasMap;
    if (cached !== null) return cached;

    const map = new Float64Array(this.gridSize * this.gridSize);
    const center = this.gridSize / 2;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        map[y * this.gridSize + x] = Math.max(0.3, 1 - dist / center);
      }
    }
    this.biasMap = map;
    return map;
  }

  // 隣接判定
  private hasAdjacent(x: number, y: number, condition: (tile: number) => boolean): boolean {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    return dirs.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return (
        nx >= 0 &&
        ny >= 0 &&
        nx < this.gridSize &&
        ny < this.gridSize &&
        condition(this.state.map[ny][nx])
      );
    });
  }

  // 駅ブーストの lookup table を構築（未構築時のみ）。grow() から参照。
  // 各 STATION タイルの ±station.growthRadius チェビシェフ矩形を station.growthMultiplier
  // で塗る（個別判定と数学的に等価）。
  private ensureBoostMap(): Float32Array {
    const cached = this.boostMap;
    if (cached !== null) return cached;

    const { growthRadius, growthMultiplier } = INFRASTRUCTURE_EFFECTS.station;
    const map = new Float32Array(this.gridSize * this.gridSize).fill(1.0);
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.map[y][x] === TileType.STATION) {
          const yMin = Math.max(0, y - growthRadius);
          const yMax = Math.min(this.gridSize - 1, y + growthRadius);
          const xMin = Math.max(0, x - growthRadius);
          const xMax = Math.min(this.gridSize - 1, x + growthRadius);
          for (let ny = yMin; ny <= yMax; ny++) {
            for (let nx = xMin; nx <= xMax; nx++) {
              map[ny * this.gridSize + nx] = growthMultiplier;
            }
          }
        }
      }
    }
    this.boostMap = map;
    return map;
  }

  // 需要値(0-100)を成長倍率に線形変換する（DEMAND_MODEL.neutralDemandを基準に、
  // growthMultSlopeの傾きでgrowthMultMin~growthMultMaxへクランプ）。
  // Step4リバランス: 旧来の「demand>50でboost/demand<10で0.7固定」という不感帯付き
  // 分岐（10~50の間で成長倍率が1.0に張り付く）を、demand全域で連続な線形モデルに置換した。
  private demandMult(demand: number): number {
    const { neutralDemand, growthMultSlope, growthMultMin, growthMultMax } = DEMAND_MODEL;
    const mult = 1 + (demand - neutralDemand) * growthMultSlope;
    return Math.min(growthMultMax, Math.max(growthMultMin, mult));
  }

  // 新規建設・波及建設が成功した際に配置するゾーン種別を、各需要を重みとした抽選で決める。
  // Step4リバランス: 旧実装は常にRESIDENTIAL_L1を配置していたため、商業・工業は
  // 既存ゾーンからの高層化でしか増えなかった。ここで需要に応じた自然発生を可能にする。
  // rng()を1回だけ消費する。
  private spawnZoneTile(): TileType {
    const wR = DEMAND_MODEL.spawnResidentialWeight * this.state.residentialDemand + 1;
    const wC = this.state.commercialDemand;
    const wI = this.state.industrialDemand;
    const roll = this.rng() * (wR + wC + wI);
    if (roll < wR) return TileType.RESIDENTIAL_L1;
    if (roll < wR + wC) return TileType.COMMERCIAL_L1;
    return TileType.INDUSTRIAL_L1;
  }

  // 成長処理
  grow(): void {
    if (this.state.paused || this.state.gameSpeed === 0) return;

    const __growStart = performance.now();

    // gameSpeed に応じた処理回数
    const iterations = this.state.gameSpeed >= 1 ? Math.floor(this.state.gameSpeed) : 1;
    const probability = this.state.gameSpeed < 1 ? this.state.gameSpeed : 1;

    const biasMap = this.ensureBiasMap();
    const boostMap = this.ensureBoostMap();

    for (let iter = 0; iter < iterations; iter++) {
      if (this.state.gameSpeed < 1 && this.rng() > probability) continue;

      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          // EMPTY かつ道路・建物(1-24)のいずれにも隣接していないタイルは、新規建設・波及建設の
          // hasAdjacent 判定が必ず false になり、高層化も EMPTY では発火しないため、
          // 以降の全分岐が不成立。this.rng() を一切消費せずスキップ可能（消費回数は不変）。
          if (
            this.state.map[y][x] === TileType.EMPTY &&
            !this.hasAdjacent(x, y, (t) => t === TileType.ROAD || (t >= 1 && t <= 24))
          ) {
            continue;
          }

          const idx = y * this.gridSize + x;
          const bias = biasMap[idx] * boostMap[idx];

          // ローカルペナルティを計算（電力・給水供給があるか）
          let localPenalty = this.state.growthPenalty;
          if (!this.state.powerGrid[y][x]) localPenalty *= 0.6; // 電力なし：60%に低下
          if (!this.state.waterGrid[y][x]) localPenalty *= 0.3; // 給水なし：30%に低下

          // 需要に応じたボーナス/ペナルティを適用（Step4: 線形モデルに置換）
          const tile = this.state.map[y][x];
          if (tile >= TileType.RESIDENTIAL_L1 && tile <= TileType.RESIDENTIAL_L4) {
            localPenalty *= this.demandMult(this.state.residentialDemand);
          } else if (tile >= TileType.COMMERCIAL_L1 && tile <= TileType.COMMERCIAL_L4) {
            localPenalty *= this.demandMult(this.state.commercialDemand);
          } else if (tile >= TileType.INDUSTRIAL_L1 && tile <= TileType.INDUSTRIAL_L4) {
            localPenalty *= this.demandMult(this.state.industrialDemand);
          }

          // 新規建設・波及建設は全ゾーン需要の平均を参照した demandBonus を共有する
          const avgDemand =
            (this.state.residentialDemand +
              this.state.commercialDemand +
              this.state.industrialDemand) /
            3;
          const demandBonus = this.demandMult(avgDemand);

          // 新規建設（道路隣接）
          if (
            this.state.map[y][x] === TileType.EMPTY &&
            this.hasAdjacent(x, y, (t) => t === TileType.ROAD)
          ) {
            if (this.rng() < this.growthRate * bias * localPenalty * demandBonus) {
              this.state.map[y][x] = this.spawnZoneTile();
            }
          }

          // 波及建設（spilloverFactor倍）- 他の建物に隣接していても成長
          if (
            this.state.map[y][x] === TileType.EMPTY &&
            this.hasAdjacent(x, y, (t) => t >= 1 && t <= 24)
          ) {
            if (
              this.rng() <
              this.growthRate * GROWTH_BALANCE.spilloverFactor * bias * localPenalty * demandBonus
            ) {
              this.state.map[y][x] = this.spawnZoneTile();
            }
          }

          // 高層化（最大Lv4）- 住宅のみ
          if (
            this.state.map[y][x] >= TileType.RESIDENTIAL_L1 &&
            this.state.map[y][x] < TileType.RESIDENTIAL_L4
          ) {
            if (this.rng() < this.growthRate * GROWTH_BALANCE.upgradeFactor * bias * localPenalty) {
              this.state.map[y][x]++;
            }
          }

          // 商業地の高層化
          // Step3リバランス: 駅+学校+警察の三者シナジー成立時、commercialGrowthMult(1.2)を
          // 乗算して商業高層化確率をブースト（住宅・工業には掛けない）。
          if (
            this.state.map[y][x] >= TileType.COMMERCIAL_L1 &&
            this.state.map[y][x] < TileType.COMMERCIAL_L4
          ) {
            if (
              this.rng() <
              this.growthRate *
                GROWTH_BALANCE.upgradeFactor *
                bias *
                localPenalty *
                this.commercialGrowthMult
            ) {
              this.state.map[y][x]++;
            }
          }

          // 工業地の高層化
          if (
            this.state.map[y][x] >= TileType.INDUSTRIAL_L1 &&
            this.state.map[y][x] < TileType.INDUSTRIAL_L4
          ) {
            if (this.rng() < this.growthRate * GROWTH_BALANCE.upgradeFactor * bias * localPenalty) {
              this.state.map[y][x]++;
            }
          }
        }
      }
    }

    this.recordSample(this.growSamples, performance.now() - __growStart);
  }

  // 初期の中央駅を 2x2（STATION の建物サイズ）で配置する。
  // 1タイルだけ置くと countBuildings() で round(1/4)=0 棟と数えられ、
  // 維持費・駅系の効果/シナジー計算から漏れてしまうため、正規の 2x2 で配置する。
  private placeInitialStation(): void {
    const c = Math.floor(this.gridSize / 2);
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        this.state.map[c + dy][c + dx] = TileType.STATION;
      }
    }
  }

  // タイル種別ごとの「建物数」を数える。
  // 多マス建物（駅・公園・警察・消防・病院・学校・ランドマーク等）は
  // 占有タイル数を BUILDING_SIZES の面積（width×height、未定義は1x1）で割り、
  // Math.round で建物数に丸める。
  // 例: 2x2の病院が3棟建っていれば12タイル → round(12/4) = 3棟。
  // 火災等で一部タイルが焼失した多マス建物にも丸めで寛容に対応する
  // （火災ロジック自体はこのStepでは変更しない）。
  countBuildings(): Map<number, number> {
    const tileCounts = new Map<number, number>();
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile === TileType.EMPTY) continue;
        tileCounts.set(tile, (tileCounts.get(tile) || 0) + 1);
      }
    }

    const buildingCounts = new Map<number, number>();
    for (const [tile, tileCount] of tileCounts) {
      const size = BUILDING_SIZES[tile];
      const area = size ? size.width * size.height : 1;
      buildingCounts.set(tile, Math.round(tileCount / area));
    }
    return buildingCounts;
  }

  // 月次更新（税収・維持費）
  monthlyUpdate(): void {
    if (this.state.paused) return;

    const __monthlyStart = performance.now();

    // インフラシステム更新
    this.updateInfrastructure();

    // Step2リバランス: 災害被害費の台帳をリセット（updateDisasters() 呼出前）。
    // 月中の被害はここから収支適用までのあいだ this.disasterDamage に積算され、
    // 月末の収支反映時に一括で差し引かれる。
    this.disasterDamage = 0;

    // 災害処理
    this.updateDisasters();

    // インフラ効果計算（詳細パラメータ更新）
    this.updateInfrastructureEffects();

    // インフラ不足ペナルティ計算
    this.calculatePenalties();

    // 人口と快適度を計算
    this.calculatePopulation();
    this.calculateComfort();

    let revenue = 0;
    let maintenance = 0;

    // Step1リバランス: タイル単位ではなく「建物単位」で税収・維持費を計上する
    // （多マス建物がタイル数倍で課金/課税されるのを防ぐ）。
    const buildingCounts = this.countBuildings();
    for (const [tile, count] of buildingCounts) {
      revenue += (TAX_REVENUE[tile] || 0) * count;
      maintenance += (MAINTENANCE_COSTS[tile] || 0) * count;
    }

    // ペナルティを税収に適用
    revenue *= this.state.revenuePenalty;

    // 教育度が高いと税収ボーナス（educationLevel >= 60 で +15%、さらに高いほどボーナス）
    if (this.state.educationLevel >= 60) {
      const educationBonus = 0.15 + (this.state.educationLevel - 60) * 0.0025; // 最大 +15% + (40 * 0.0025) = +16%
      revenue *= 1 + educationBonus;
    }

    // 観光度が商業収入に反映（観光度が高いほど商業地収入が増加）
    if (this.state.tourismLevel > 0 || this.state.internationalLevel > 0) {
      const tourismBonus = this.state.tourismLevel * 0.01 + this.state.internationalLevel * 0.01;
      revenue *= 1 + tourismBonus;
    }

    // ランドマーク商業ボーナス（スタジアム・空港周辺商業地への観光収入）
    revenue += this.calculateLandmarkCommercialBonus();

    // サンドボックスモードでない場合のみ維持費を適用
    // Step2リバランス: 火災/病気による被害費（disasterDamage）も収支適用時に一括で
    // 差し引く（サンドボックスモードでも被害費を引く現行挙動は踏襲）。
    if (!this.state.settings.sandbox) {
      // 難易度に応じた維持費倍率を適用
      maintenance *= this.maintenanceMultiplier;
      this.state.money += revenue - maintenance - this.disasterDamage;
    } else {
      // サンドボックスモード：税収のみ加算、維持費なし（被害費は引く）
      this.state.money += revenue - this.disasterDamage;
    }

    this.state.month++;

    // 破産判定（サンドボックスモードでは破産しない）
    if (!this.state.settings.sandbox && this.state.money < 0) {
      alert("資金がなくなりました！ゲームオーバーです");
      this.reset();
    }

    this.recordSample(this.monthlySamples, performance.now() - __monthlyStart);
  }

  // dev計測用: サンプルをリングバッファ的に保持（直近 PROFILE_SAMPLE_SIZE 件）
  private recordSample(samples: number[], value: number): void {
    samples.push(value);
    if (samples.length > GameEngine.PROFILE_SAMPLE_SIZE) {
      samples.shift();
    }
  }

  // dev計測用: grow()/monthlyUpdate() の直近実行時間の平均(ms)を返す
  getProfile(): { growMs: number; monthlyMs: number } {
    const average = (samples: number[]): number =>
      samples.length === 0 ? 0 : samples.reduce((sum, v) => sum + v, 0) / samples.length;
    return {
      growMs: average(this.growSamples),
      monthlyMs: average(this.monthlySamples),
    };
  }

  // インフラ効果の計算・反映
  // Step3リバランス: 治安/安全/教育/医療/観光/国際化の各レベルを
  // 「カバー率(count/required)→目標値(target)→毎月 smoothing 割合だけ target に平滑追従」
  // というモデルに全面書き換えした（旧: 効果範囲内で加算し続けて100に張り付くモデル）。
  private updateInfrastructureEffects(): void {
    // 供給率計算（電力・給水の実カバー率。旧・人口スケーリング処理による deficit の
    // 二重掛けはStep3で当該処理を削除して解消したため、ここで計算した値をそのまま採用する）
    this.calculateSupplyRates();

    const buildingCounts = this.countBuildings();
    const policeCount = buildingCounts.get(TileType.POLICE) || 0;
    const fireCount = buildingCounts.get(TileType.FIRE_STATION) || 0;
    const schoolCount = buildingCounts.get(TileType.SCHOOL) || 0;
    const hospitalCount = buildingCounts.get(TileType.HOSPITAL) || 0;
    const stadiumCount = buildingCounts.get(TileType.LANDMARK_STADIUM) || 0;
    const airportCount = buildingCounts.get(TileType.LANDMARK_AIRPORT) || 0;

    const requiredPolice = this.requiredUnits("police");
    const requiredFire = this.requiredUnits("fire_station");
    const requiredSchool = this.requiredUnits("school");
    const requiredHospital = this.requiredUnits("hospital");

    // シナジー成立フラグ・加算量を先に算出してから target に反映する
    // （三者シナジーは commercialGrowthMult として grow() の商業高層化確率に使う）
    const synergy = this.calculateSynergyBonuses();
    this.commercialGrowthMult = synergy.tripleSynergy
      ? SYNERGY_EFFECTS.station_school_police.commercialGrowthMult
      : 1.0;

    const securityTarget = this.calculateLevelTarget(
      policeCount,
      requiredPolice,
      synergy.securityBonus,
    );
    const safetyTarget = this.calculateLevelTarget(fireCount, requiredFire, 0);
    const educationTarget = this.calculateLevelTarget(
      schoolCount,
      requiredSchool,
      synergy.educationBonus,
    );
    const medicalTarget = this.calculateLevelTarget(
      hospitalCount,
      requiredHospital,
      synergy.medicalBonus,
    );

    this.state.securityLevel = this.smoothToward(this.state.securityLevel, securityTarget);
    this.state.safetyLevel = this.smoothToward(this.state.safetyLevel, safetyTarget);
    this.state.educationLevel = this.smoothToward(this.state.educationLevel, educationTarget);
    this.state.medicalLevel = this.smoothToward(this.state.medicalLevel, medicalTarget);

    // 観光度/国際化度（必要数なし・施設数ベースの目標値に平滑追従）
    const tourismTarget = Math.min(
      100,
      LANDMARK_EFFECTS.stadium.tourismPerBuilding * stadiumCount +
        LANDMARK_EFFECTS.airport.tourismPerBuilding * airportCount,
    );
    const internationalTarget = Math.min(
      100,
      LANDMARK_EFFECTS.airport.internationalPerBuilding * airportCount,
    );
    this.state.tourismLevel = this.smoothToward(this.state.tourismLevel, tourismTarget);
    this.state.internationalLevel = this.smoothToward(
      this.state.internationalLevel,
      internationalTarget,
    );

    // 需要計算
    this.calculateDemands();
  }

  // 人口に対する必要棟数（INFRASTRUCTURE_REQUIREMENTS より）
  private requiredUnits(kind: keyof typeof INFRASTRUCTURE_REQUIREMENTS): number {
    const req = INFRASTRUCTURE_REQUIREMENTS[kind];
    return Math.max(req.base, Math.ceil(this.state.population / req.populationPerUnit));
  }

  // カバー率(count/required)から目標レベルを算出する（CITY_LEVEL_MODEL参照）。
  // ratio=0→baseLevel, ratio=1→fullLevel, ratio>=overProvisionRatio→overProvisionMax
  // の3点をつなぐ区分線形。synergyBonus はシナジー加算分（synergyCapで上限）。
  private calculateLevelTarget(count: number, required: number, synergyBonus: number): number {
    const { baseLevel, fullLevel, overProvisionMax, overProvisionRatio, synergyCap } =
      CITY_LEVEL_MODEL;
    const ratio = required > 0 ? count / required : 0;

    let target = baseLevel + (fullLevel - baseLevel) * Math.min(1, ratio);
    const overRatio =
      Math.max(0, Math.min(ratio, overProvisionRatio) - 1) / (overProvisionRatio - 1);
    target += (overProvisionMax - fullLevel) * overRatio;

    return Math.min(synergyCap, target + synergyBonus);
  }

  // 現在値から目標値へ smoothing の割合だけ平滑追従させる（0-100にクランプ）
  private smoothToward(current: number, target: number): number {
    const next = current + (target - current) * CITY_LEVEL_MODEL.smoothing;
    return Math.min(100, Math.max(0, next));
  }

  // 供給率計算
  private calculateSupplyRates(): void {
    let powerSupplied = 0;
    let waterSupplied = 0;
    let totalBuildings = 0;

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];

        // インフラ以外の建物をカウント
        if (tile !== TileType.EMPTY && tile < 0) continue;
        if (tile > 0) {
          totalBuildings++;

          // 電力供給チェック
          if (this.state.powerGrid[y][x]) powerSupplied++;
          // 給水チェック
          if (this.state.waterGrid[y][x]) waterSupplied++;
        }
      }
    }

    this.state.powerSupplyRate = totalBuildings > 0 ? (powerSupplied / totalBuildings) * 100 : 0;
    this.state.waterSupplyRate = totalBuildings > 0 ? (waterSupplied / totalBuildings) * 100 : 0;
  }

  // 需要計算
  // Step4リバランス: マップ全タイル数に対する占有率をベースにしていた旧モデル（マップサイズに
  // 依存し、大マップほど需要が下がりにくい/上がりにくいバグを持っていた）を廃止し、
  // POPULATION_TABLE を「住宅=居住人口／商業・工業=雇用数」として読む雇用バランスモデルに
  // 全面置換した（マップ面積に一切依存しない）。
  // - jobs = 商業+工業の人口合計（求人数とみなす）
  // - workers = 住宅人口 × employmentRate（働き手の数）
  // - residentialDemand は「雇用に対して住宅が足りているか」（jobs/workers 比）
  // - businessDemand は「住宅（働き手）に対して商業+工業が足りているか」（workers/jobs 比）
  // - commercialDemand/industrialDemand は businessDemand を商業/工業の現シェアで配分し直す
  //   （どちらかに偏っていれば、少ない方の需要が相対的に高くなる）
  private calculateDemands(): void {
    let resPop = 0;
    let comPop = 0;
    let indPop = 0;

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile >= TileType.RESIDENTIAL_L1 && tile <= TileType.RESIDENTIAL_L4) {
          resPop += POPULATION_TABLE[tile] || 0;
        } else if (tile >= TileType.COMMERCIAL_L1 && tile <= TileType.COMMERCIAL_L4) {
          comPop += POPULATION_TABLE[tile] || 0;
        } else if (tile >= TileType.INDUSTRIAL_L1 && tile <= TileType.INDUSTRIAL_L4) {
          indPop += POPULATION_TABLE[tile] || 0;
        }
      }
    }

    const { employmentRate, neutralDemand, bootstrapDemand } = DEMAND_MODEL;
    const jobs = comPop + indPop;
    const workers = employmentRate * resPop;

    // 住宅も雇用も0の起点状態: 何を建ててもよい高需要（bootstrapDemand）を全ゾーンに与える
    if (resPop === 0 && jobs === 0) {
      this.state.residentialDemand = bootstrapDemand;
      this.state.commercialDemand = bootstrapDemand;
      this.state.industrialDemand = bootstrapDemand;
      return;
    }

    const clamp = (v: number): number => Math.min(100, Math.max(0, v));

    const residentialDemand = clamp(Math.round((neutralDemand * jobs) / Math.max(1, workers)));
    const businessDemand = clamp(Math.round((neutralDemand * workers) / Math.max(1, jobs)));
    const comShare = jobs > 0 ? comPop / jobs : 0.5;
    const indShare = jobs > 0 ? indPop / jobs : 0.5;
    const commercialDemand = clamp(Math.round(businessDemand * 2 * (1 - comShare)));
    const industrialDemand = clamp(Math.round(businessDemand * 2 * (1 - indShare)));

    this.state.residentialDemand = residentialDemand;
    this.state.commercialDemand = commercialDemand;
    this.state.industrialDemand = industrialDemand;
  }

  // Step3リバランス: シナジー成立判定（ブール型・ペアごとの重複加算はしない）。
  // updateInfrastructureEffects() の target 計算に加算する量を先にまとめて返す。
  // station+school+police の三者シナジーは security/education/medical には加算せず、
  // tripleSynergy フラグとして返し、呼び出し側で commercialGrowthMult に反映する。
  private calculateSynergyBonuses(): {
    securityBonus: number;
    educationBonus: number;
    medicalBonus: number;
    tripleSynergy: boolean;
  } {
    // 施設の位置を取得（存在判定のみに使うのでタイル単位の走査でよい）
    const facilities: {
      police: { x: number; y: number }[];
      school: { x: number; y: number }[];
      hospital: { x: number; y: number }[];
      station: { x: number; y: number }[];
    } = { police: [], school: [], hospital: [], station: [] };

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile === TileType.POLICE) facilities.police.push({ x, y });
        if (tile === TileType.SCHOOL) facilities.school.push({ x, y });
        if (tile === TileType.HOSPITAL) facilities.hospital.push({ x, y });
        if (tile === TileType.STATION) facilities.station.push({ x, y });
      }
    }

    const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    let securityBonus = 0;
    let educationBonus = 0;
    let medicalBonus = 0;

    // シナジー1: 警察+学校が距離threshold以内に1組でも存在
    const policeSchoolThreshold = SYNERGY_EFFECTS.police_school.distanceThreshold;
    const policeSchool = facilities.police.some((p) =>
      facilities.school.some((s) => manhattan(p, s) <= policeSchoolThreshold),
    );
    if (policeSchool) {
      securityBonus += SYNERGY_EFFECTS.police_school.securityBoost;
      educationBonus += SYNERGY_EFFECTS.police_school.educationBoost;
    }

    // シナジー2: 学校+病院が距離threshold以内に1組でも存在
    const schoolHospitalThreshold = SYNERGY_EFFECTS.school_hospital.distanceThreshold;
    const schoolHospital = facilities.school.some((s) =>
      facilities.hospital.some((h) => manhattan(s, h) <= schoolHospitalThreshold),
    );
    if (schoolHospital) {
      educationBonus += SYNERGY_EFFECTS.school_hospital.educationBoost;
      medicalBonus += SYNERGY_EFFECTS.school_hospital.medicalBoost;
    }

    // シナジー3: 駅+学校+警察の3種が距離threshold以内に揃って存在
    const tripleThreshold = SYNERGY_EFFECTS.station_school_police.distanceThreshold;
    const tripleSynergy = facilities.station.some(
      (st) =>
        facilities.school.some((s) => manhattan(st, s) <= tripleThreshold) &&
        facilities.police.some((p) => manhattan(st, p) <= tripleThreshold),
    );

    return { securityBonus, educationBonus, medicalBonus, tripleSynergy };
  }

  // ランドマーク商業ボーナス計算
  private calculateLandmarkCommercialBonus(): number {
    let bonus = 0;

    // スタジアムと空港の位置を取得
    const stadiums = [];
    const airports = [];

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile === TileType.LANDMARK_STADIUM) stadiums.push({ x, y });
        if (tile === TileType.LANDMARK_AIRPORT) airports.push({ x, y });
      }
    }

    // スタジアム周辺の商業地
    for (const stadium of stadiums) {
      const stadiumRadius = 40;
      const yMin = Math.max(0, stadium.y - stadiumRadius);
      const yMax = Math.min(this.gridSize - 1, stadium.y + stadiumRadius);
      const xMin = Math.max(0, stadium.x - stadiumRadius);
      const xMax = Math.min(this.gridSize - 1, stadium.x + stadiumRadius);
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          const tile = this.state.map[y][x];
          const dist = Math.abs(x - stadium.x) + Math.abs(y - stadium.y);

          // スタジアムから40マス以内の商業地
          if (
            dist <= stadiumRadius &&
            tile >= TileType.COMMERCIAL_L1 &&
            tile <= TileType.COMMERCIAL_L4
          ) {
            const level = tile - TileType.COMMERCIAL_L1 + 1; // 1～4
            const bonusValues = [500, 1166, 2333, 3000];
            bonus += bonusValues[level - 1];
          }
        }
      }
    }

    // 空港周辺の商業地
    for (const airport of airports) {
      const airportRadius = 50;
      const yMin = Math.max(0, airport.y - airportRadius);
      const yMax = Math.min(this.gridSize - 1, airport.y + airportRadius);
      const xMin = Math.max(0, airport.x - airportRadius);
      const xMax = Math.min(this.gridSize - 1, airport.x + airportRadius);
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          const tile = this.state.map[y][x];
          const dist = Math.abs(x - airport.x) + Math.abs(y - airport.y);

          // 空港から50マス以内の商業地
          if (
            dist <= airportRadius &&
            tile >= TileType.COMMERCIAL_L1 &&
            tile <= TileType.COMMERCIAL_L4
          ) {
            const level = tile - TileType.COMMERCIAL_L1 + 1; // 1～4
            const bonusValues = [1000, 2333, 3666, 5000];
            bonus += bonusValues[level - 1];
          }
        }
      }
    }

    return bonus;
  }

  // インフラ不足ペナルティ計算
  private calculatePenalties(): void {
    let growthPenalty = 1.0;
    let revenuePenalty = 1.0;

    // 電力供給不足ペナルティ
    if (this.state.powerSupplyRate < 50) {
      const shortage = (50 - this.state.powerSupplyRate) / 50; // 0～1
      growthPenalty *= Math.max(0.6, 1 - shortage * 0.4); // 最大40%低下
      revenuePenalty *= Math.max(0.8, 1 - shortage * 0.2); // 最大20%低下
    }

    // 給水不足ペナルティ
    if (this.state.waterSupplyRate < 50) {
      const shortage = (50 - this.state.waterSupplyRate) / 50;
      growthPenalty *= Math.max(0.3, 1 - shortage * 0.7); // 最大70%低下
      revenuePenalty *= Math.max(0.7, 1 - shortage * 0.3); // 最大30%低下
      // Step6: 「給水なしで病気3倍」は updateDiseases の発生確率 ×noWaterMultiplier に移設。
      // ここでの diseaseMap ×1.2 増幅（意味論が発生率でなくレベルで README と不一致）は廃止した。
    }

    // 治安度不足ペナルティ（住宅成長）
    if (this.state.securityLevel < 40) {
      const deficit = (40 - this.state.securityLevel) / 40;
      growthPenalty *= Math.max(0.5, 1 - deficit * 0.5); // 最大50%低下
    }

    // 安全度不足ペナルティ（火災増加）
    if (this.state.safetyLevel < 40) {
      const deficit = (40 - this.state.safetyLevel) / 40;
      // 火災発生確率をdeficitに応じて増加（最大2倍）
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if (this.state.fireMap[y][x] > 0) {
            this.state.fireMap[y][x] = Math.min(10, this.state.fireMap[y][x] * (1 + deficit));
          }
        }
      }
    }

    // 教育度不足ペナルティ（商業成長）
    if (this.state.educationLevel < 40) {
      const deficit = (40 - this.state.educationLevel) / 40;
      growthPenalty *= Math.max(0.6, 1 - deficit * 0.4); // 最大40%低下
      revenuePenalty *= Math.max(0.85, 1 - deficit * 0.15); // 最大15%低下
    }

    // 医療度不足ペナルティ（病気増加、人口流出）
    if (this.state.medicalLevel < 40) {
      const deficit = (40 - this.state.medicalLevel) / 40;
      // 病気発生倍率がdeficitに応じて増加（最大1.5倍）
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if (this.state.diseaseMap[y][x] > 0) {
            this.state.diseaseMap[y][x] = Math.min(
              10,
              this.state.diseaseMap[y][x] * (1 + deficit * 0.5),
            );
          }
        }
      }
      // （旧・快適度への直接減算は calculateComfort の service/汚染乗算に一本化したため削除）
    }

    // Step6: スラム化率に応じた成長ペナルティ（最大 -50%）。
    if (this.state.slumRate > 0) {
      growthPenalty *= Math.max(0.5, 1 - this.state.slumRate / 200);
    }

    this.state.growthPenalty = growthPenalty;
    this.state.revenuePenalty = revenuePenalty;
  }

  // 人口計算
  calculatePopulation(): number {
    let total = 0;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        total += POPULATION_TABLE[tile] || 0;
      }
    }
    this.state.population = total;
    return total;
  }

  // 快適度計算
  // 快適度を純粋関数として算出する（唯一の算出元）。
  // monthlyUpdate 内で pollution/slum 計算の後に呼ばれ、緑地/交通/密度/資金/サービスの
  // 重み付き合成に、汚染・スラムの乗算ペナルティを掛けて求める。
  // （以前は updatePollution/updateSlums/calculatePenalties に comfort *= が散在していたが、
  //  それらは本メソッドの再計算で毎回上書きされ全て無効だった。Step5でここに一本化した。）
  calculateComfort(): number {
    const {
      weights,
      parkCoverRadius,
      stationCoverRadius,
      densityComfortCap,
      densitySlope,
      maxResidentsPerHouseTile,
      pollutionPenaltyMax,
      slumPenaltyMax,
    } = COMFORT_MODEL;

    // 公園・駅のカバー範囲（±radius チェビシェフ矩形）を bool グリッドにスタンプ
    const parkCovered = this.stampCoverage(TileType.PARK, parkCoverRadius);
    const stationCovered = this.stampCoverage(TileType.STATION, stationCoverRadius);

    let zoneTiles = 0;
    let houseTiles = 0;
    let parkCoveredZones = 0;
    let stationCoveredZones = 0;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile >= 1 && tile <= 24) {
          zoneTiles++;
          const idx = y * this.gridSize + x;
          if (parkCovered[idx]) parkCoveredZones++;
          if (stationCovered[idx]) stationCoveredZones++;
          if (tile >= TileType.RESIDENTIAL_L1 && tile <= TileType.RESIDENTIAL_L4) houseTiles++;
        }
      }
    }

    // 緑地（公園カバー率）・交通（駅カバー率）: ゾーンタイルが無ければ中立50
    const greenScore = zoneTiles > 0 ? (parkCoveredZones / zoneTiles) * 100 : 50;
    const transportScore = zoneTiles > 0 ? (stationCoveredZones / zoneTiles) * 100 : 50;

    // 密度: 住宅の平均充足率 u（最適帯 <=cap は満点、過密のみ減点）。住宅無しは中立50
    let densityScore = 50;
    if (houseTiles > 0) {
      const u = this.state.population / (maxResidentsPerHouseTile * houseTiles);
      densityScore =
        u <= densityComfortCap ? 100 : Math.max(0, 100 - (u - densityComfortCap) * densitySlope);
    }

    // 資金
    const fundScore = Math.min(100, Math.max(0, (this.state.money / this.initialMoney) * 50));

    // サービス（治安/安全/教育/医療の平均）
    const serviceScore =
      (this.state.securityLevel +
        this.state.safetyLevel +
        this.state.educationLevel +
        this.state.medicalLevel) /
      4;

    const base =
      greenScore * weights.green +
      transportScore * weights.transport +
      densityScore * weights.density +
      fundScore * weights.fund +
      serviceScore * weights.service;

    const pollutionMult = 1 - pollutionPenaltyMax * (this.state.pollutionLevel / 100);
    const slumMult = 1 - slumPenaltyMax * (this.state.slumRate / 100);

    this.state.comfort = Math.round(Math.max(0, Math.min(100, base * pollutionMult * slumMult)));
    return this.state.comfort;
  }

  // 指定タイル種別の各タイルを中心に ±radius（チェビシェフ）の矩形を被覆済みとして
  // マークした bool グリッド（フラット）を返す。快適度の公園/駅カバー率算出に使う。
  private stampCoverage(type: TileType, radius: number): Uint8Array {
    const covered = new Uint8Array(this.gridSize * this.gridSize);
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.map[y][x] !== type) continue;
        const yMin = Math.max(0, y - radius);
        const yMax = Math.min(this.gridSize - 1, y + radius);
        const xMin = Math.max(0, x - radius);
        const xMax = Math.min(this.gridSize - 1, x + radius);
        for (let ny = yMin; ny <= yMax; ny++) {
          for (let nx = xMin; nx <= xMax; nx++) {
            covered[ny * this.gridSize + nx] = 1;
          }
        }
      }
    }
    return covered;
  }

  // リセット
  reset(): void {
    const difficultyConfig = {
      easy: 350000,
      normal: 250000,
      hard: 150000,
    };
    const initialMoney = difficultyConfig[this.state.settings.difficulty] ?? 250000;
    this.initialMoney = initialMoney;
    this.state = {
      map: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(TileType.EMPTY)),
      population: 0,
      money: initialMoney,
      comfort: 50,
      month: 0,
      paused: false,
      buildMode: "road",
      gridSize: this.gridSize,
      selectedInfrastructure: "station",
      selectedLandmark: "stadium",
      gameSpeed: 1,
      powerGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      waterGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      fireMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      diseaseMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      pollutionMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      slumMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      securityLevel: INITIAL_PARAMETERS.securityLevel,
      safetyLevel: INITIAL_PARAMETERS.safetyLevel,
      educationLevel: INITIAL_PARAMETERS.educationLevel,
      medicalLevel: INITIAL_PARAMETERS.medicalLevel,
      tourismLevel: INITIAL_PARAMETERS.tourismLevel,
      internationalLevel: INITIAL_PARAMETERS.internationalLevel,
      powerSupplyRate: INITIAL_PARAMETERS.powerSupplyRate,
      waterSupplyRate: INITIAL_PARAMETERS.waterSupplyRate,
      pollutionLevel: 0,
      slumRate: 0,
      residentialDemand: 50,
      commercialDemand: 50,
      industrialDemand: 50,
      showDemandMeters: false,
      growthPenalty: 1.0,
      revenuePenalty: 1.0,
      settings: this.state.settings,
    };
    this.placeInitialStation();
  }

  // 速度設定
  setGrowthRate(rate: number): void {
    this.growthRate = rate;
  }

  // インフラストラクチャシステム更新
  updateInfrastructure(): void {
    // 電力グリッド再計算
    this.updatePowerGrid();
    // 水道グリッド再計算
    this.updateWaterGrid();
  }

  private updatePowerGrid(): void {
    // 全ての電力グリッドをリセット
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        this.state.powerGrid[y][x] = false;
      }
    }

    // 発電所から半径20マス以内に電力供給
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.map[y][x] === TileType.POWER_PLANT) {
          this.spreadPower(x, y, 20);
        }
      }
    }
  }

  private spreadPower(cx: number, cy: number, radius: number): void {
    const yMin = Math.max(0, cy - radius);
    const yMax = Math.min(this.gridSize - 1, cy + radius);
    const xMin = Math.max(0, cx - radius);
    const xMax = Math.min(this.gridSize - 1, cx + radius);
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= radius) {
          this.state.powerGrid[y][x] = true;
        }
      }
    }
  }

  private updateWaterGrid(): void {
    // 全ての水道グリッドをリセット
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        this.state.waterGrid[y][x] = false;
      }
    }

    // 水処理施設から半径15マス以内に供給
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.map[y][x] === TileType.WATER_TREATMENT) {
          this.spreadWater(x, y, 15);
        }
      }
    }
  }

  private spreadWater(cx: number, cy: number, radius: number): void {
    const yMin = Math.max(0, cy - radius);
    const yMax = Math.min(this.gridSize - 1, cy + radius);
    const xMin = Math.max(0, cx - radius);
    const xMax = Math.min(this.gridSize - 1, cx + radius);
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= radius) {
          this.state.waterGrid[y][x] = true;
        }
      }
    }
  }

  // 災害処理（毎月実行）
  updateDisasters(): void {
    if (!this.state.settings.disastersEnabled) return;

    // 火災発生
    this.updateFires();
    // 病気発生
    this.updateDiseases();
    // 公害システム
    if (this.state.settings.pollutionEnabled) {
      this.updatePollution();
    }
    // スラム化システム
    if (this.state.settings.slumEnabled) {
      this.updateSlums();
    }
  }

  private updatePollution(): void {
    // 工業地から汚染が発生
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        // 工業地レベルに応じた汚染（工業地タイル内のみ）
        if (tile >= TileType.INDUSTRIAL_L1 && tile <= TileType.INDUSTRIAL_L4) {
          const level = tile - TileType.INDUSTRIAL_L1 + 1;
          // バランス調整：汚染度を段階的に設定（拡散なし）
          this.state.pollutionMap[y][x] = level * 20; // L1: 20, L2: 40, L3: 60, L4: 80
        } else {
          // 工業地以外は自然に汚染が減少
          this.state.pollutionMap[y][x] = Math.max(0, this.state.pollutionMap[y][x] - 2);
        }
      }
    }

    // 全体汚染度を計算
    const totalCells = this.gridSize * this.gridSize;
    const pollutedCells = this.state.pollutionMap.flat().filter((p) => p > 0).length;
    this.state.pollutionLevel = Math.round((pollutedCells / totalCells) * 100);

    // 快適度への汚染ペナルティは calculateComfort() の pollutionMult に一本化した
    // （pollutionLevel を算出するここでは comfort を直接いじらない）。
  }

  private updateSlums(): void {
    // 低快適度の住宅地がスラム化
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile >= TileType.RESIDENTIAL_L1 && tile <= TileType.RESIDENTIAL_L4) {
          // 周辺のスラム化度と汚染度を確認
          let localSlum = 0;
          let localPollution = 0;
          let localSecurity = this.state.securityLevel;

          for (let yy = -5; yy <= 5; yy++) {
            for (let xx = -5; xx <= 5; xx++) {
              const nx = x + xx;
              const ny = y + yy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                localSlum += this.state.slumMap[ny][nx];
                localPollution += this.state.pollutionMap[ny][nx];
              }
            }
          }
          localSlum /= 121;
          localPollution /= 121;

          // Step6再設計: スラム化条件（汚染と治安の悪さの平均 × 近隣スラム）。
          // 旧 baseChance 0.01 は毎月の減衰 -0.5 に負けスラムが実質発生しなかったため 0.15 に。
          // gameSpeed 乗算は Step2 で削除済み（固定タイムステップで月次頻度が速度比例のため）。
          const sb = DISASTER_BALANCE.slum;
          const slumChance =
            sb.baseChance *
            (0.5 * (localPollution / 100) + 0.5 * (1 - localSecurity / 100)) *
            (1 + localSlum / 10);
          if (this.rng() < slumChance) {
            this.state.slumMap[y][x] = Math.min(10, this.state.slumMap[y][x] + 1);
          }

          // スラム化が進むと住宅レベルを1段階低下（L1は維持）
          if (this.state.slumMap[y][x] > sb.downgradeThreshold) {
            if (tile > TileType.RESIDENTIAL_L1) {
              this.state.map[y][x] = tile - 1;
            }
            this.state.slumMap[y][x] = 0;
          }

          // Step6: 減衰（回復）は「局所汚染が十分低く、かつ治安が十分高い」月のみ適用。
          // 放置された荒廃地区は回復せず、環境を改善して初めて再生する（荒廃と再生のループ）。
          if (localPollution < sb.recoveryPollutionMax && localSecurity >= sb.recoverySecurityMin) {
            this.state.slumMap[y][x] = Math.max(0, this.state.slumMap[y][x] - sb.decayAmount);
          }
        }
      }
    }

    // 全体スラム化率を計算
    const slummedCells = this.state.slumMap.flat().filter((s) => s > 0).length;
    this.state.slumRate = Math.round((slummedCells / (this.gridSize * this.gridSize)) * 100);

    // Step6: 快適度ペナルティは calculateComfort() の slumMult、成長ペナルティは
    // calculatePenalties() の slumRate 参照に一本化。人口減は上のスラム降格（住宅レベル低下）で
    // 永続化されるため、ここでの population 直接操作（旧・calculatePopulation で上書きされる no-op）
    // は廃止した。
  }

  private updateFires(): void {
    const fb = DISASTER_BALANCE.fire;
    // 難易度に応じた火災発生率を調整
    // Step2リバランス: gameSpeed 乗算を削除（バグA）。固定タイムステップ化により
    // monthlyUpdate の呼出頻度が既に gameSpeed に比例しているため、確率にも
    // 掛けると速度2倍で発生率4倍になってしまっていた。
    const fireChance = fb.baseChance * this.disasterRateMultiplier;
    const sampleRate = Math.max(1, Math.floor(this.gridSize / 64));

    for (let y = 0; y < this.gridSize; y += sampleRate) {
      for (let x = 0; x < this.gridSize; x += sampleRate) {
        if (this.state.map[y][x] !== TileType.EMPTY && this.rng() < fireChance) {
          this.state.fireMap[y][x] = Math.min(10, this.state.fireMap[y][x] + fb.igniteAmount);
        }
      }
    }

    // 火災の波及（アクティブな火災のみ処理）
    const newFireMap = this.state.fireMap.map((row) => [...row]);
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.fireMap[y][x] > 0) {
          // 隣接タイルに波及
          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
          dirs.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
              if (this.state.map[ny][nx] !== TileType.EMPTY && this.rng() < fb.spreadChance) {
                newFireMap[ny][nx] = Math.min(10, newFireMap[ny][nx] + fb.spreadAmount);
              }
            }
          });

          // 消防署による消火（範囲と成功率を向上）
          // searchRadius はチェビシェフ距離（±searchRadius の正方形範囲）。
          let fireExtinguished = false;
          for (let yy = -fb.searchRadius; yy <= fb.searchRadius; yy++) {
            if (fireExtinguished) break;
            for (let xx = -fb.searchRadius; xx <= fb.searchRadius; xx++) {
              const nx = x + xx;
              const ny = y + yy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                if (this.state.map[ny][nx] === TileType.FIRE_STATION) {
                  if (this.rng() < fb.extinguishSuccessRate) fireExtinguished = true;
                  break;
                }
              }
            }
          }

          if (fireExtinguished) {
            newFireMap[y][x] = Math.max(0, newFireMap[y][x] - fb.extinguishAmount);
          } else {
            newFireMap[y][x] = Math.max(0, newFireMap[y][x] - fb.decayAmount);
          }

          // 火災が蔓延したら建物を破壊
          if (newFireMap[y][x] >= fb.destroyThreshold) {
            this.state.map[y][x] = TileType.EMPTY;
            // Step2リバランス: その場での money 減算をやめ、月次台帳に積算する
            // （monthlyUpdate() の収支適用時に一括反映されるため決定論的・追跡可能になる）。
            this.disasterDamage += DISASTER_BALANCE.disasterDamageCost;
          }
        }
      }
    }
    this.state.fireMap = newFireMap;
  }

  // ゾーンタイルを1段階降格する。各ゾーンのL1（住宅1/商業11/工業21）は EMPTY にする
  // （街から人が逃げる）。病気の蔓延・（必要に応じ）他の永続被害で使う共通ロジック。
  private downgradeZoneTile(x: number, y: number): void {
    const tile = this.state.map[y][x];
    if (
      tile === TileType.RESIDENTIAL_L1 ||
      tile === TileType.COMMERCIAL_L1 ||
      tile === TileType.INDUSTRIAL_L1
    ) {
      this.state.map[y][x] = TileType.EMPTY;
    } else if (tile >= 1 && tile <= 24) {
      this.state.map[y][x] = tile - 1;
    }
  }

  private updateDiseases(): void {
    const db = DISASTER_BALANCE.disease;
    // 難易度に応じた病気発生率を調整
    const sampleRate = Math.max(1, Math.floor(this.gridSize / 64));

    for (let y = 0; y < this.gridSize; y += sampleRate) {
      for (let x = 0; x < this.gridSize; x += sampleRate) {
        // Step6: 病気の発生はゾーンタイル(1-24)に限定（インフラは病気にならない）。
        const tile = this.state.map[y][x];
        if (tile < 1 || tile > 24) continue;

        const density = this.getLocalDensity(x, y);
        // gameSpeed 乗算は Step2 で削除済み（固定タイムステップで月次頻度が既に速度比例のため）。
        let diseaseChance = db.baseChance * (1 + density / 10) * this.disasterRateMultiplier;
        // Step6: 給水されていないタイルは病気発生率を noWaterMultiplier 倍にする。
        if (!this.state.waterGrid[y][x]) diseaseChance *= db.noWaterMultiplier;
        if (this.rng() < diseaseChance) {
          this.state.diseaseMap[y][x] = Math.min(10, this.state.diseaseMap[y][x] + db.igniteAmount);
        }
      }
    }

    // 病気の波及（アクティブな病気のみ処理）
    const newDiseaseMap = this.state.diseaseMap.map((row) => [...row]);
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.diseaseMap[y][x] > 0) {
          // 隣接タイル（spreadRadius マス）に波及
          for (let dy = -db.spreadRadius; dy <= db.spreadRadius; dy++) {
            for (let dx = -db.spreadRadius; dx <= db.spreadRadius; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                const t = this.state.map[ny][nx];
                // 波及もゾーンタイル(1-24)に限定
                if (t >= 1 && t <= 24 && this.rng() < db.spreadChance) {
                  newDiseaseMap[ny][nx] = Math.min(10, newDiseaseMap[ny][nx] + db.spreadAmount);
                }
              }
            }
          }

          // 病院による治癒（近い病院だけチェック、searchRadius はチェビシェフ距離）
          let diseaseHealed = false;
          for (let yy = -db.searchRadius; yy <= db.searchRadius; yy++) {
            if (diseaseHealed) break;
            for (let xx = -db.searchRadius; xx <= db.searchRadius; xx++) {
              const nx = x + xx;
              const ny = y + yy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                if (this.state.map[ny][nx] === TileType.HOSPITAL) {
                  if (this.rng() < db.healSuccessRate) diseaseHealed = true;
                  break;
                }
              }
            }
          }

          // Step6: 病気が最大(outbreakThreshold)まで蔓延したらゾーンを1段階降格して損失を
          // 永続化する。判定は減衰前の値で行う（減衰後は必ず閾値未満になり発火不能だった＝
          // 旧実装の人口減は no-op かつ到達不能の二重死だった）。降格ならマップ自体が変わるので
          // calculatePopulation() に正しく反映される。
          const outbreak = newDiseaseMap[y][x] >= db.outbreakThreshold;

          if (diseaseHealed) {
            newDiseaseMap[y][x] = Math.max(0, newDiseaseMap[y][x] - db.healAmount);
          } else {
            newDiseaseMap[y][x] = Math.max(0, newDiseaseMap[y][x] - db.decayAmount);
          }

          if (outbreak) {
            this.downgradeZoneTile(x, y);
            newDiseaseMap[y][x] = 0; // 降格に伴い病気をリセット
            this.disasterDamage += DISASTER_BALANCE.disasterDamageCost;
          }
        }
      }
    }
    this.state.diseaseMap = newDiseaseMap;
  }

  private getLocalDensity(x: number, y: number): number {
    let count = 0;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
          if (this.state.map[ny][nx] >= 1 && this.state.map[ny][nx] <= 24) {
            count++;
          }
        }
      }
    }
    return count;
  }
}
