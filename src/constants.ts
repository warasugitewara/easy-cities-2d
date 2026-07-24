// ゲーム定数
export const GAME_VERSION = "1.1.0";

export type MapSize = "small" | "medium" | "large";

export const MAP_SIZES: Record<MapSize, { gridSize: number; canvasSize: number; label: string }> = {
  small: { gridSize: 64, canvasSize: 512, label: "小（512x512）" },
  medium: { gridSize: 128, canvasSize: 1024, label: "中（1024x1024）" },
  large: { gridSize: 256, canvasSize: 2048, label: "大（2048x2048）" },
};

// デフォルト値（中サイズ）
export const DEFAULT_MAP_SIZE: MapSize = "medium";
let GRID_SIZE = MAP_SIZES[DEFAULT_MAP_SIZE].gridSize;
let CANVAS_SIZE = MAP_SIZES[DEFAULT_MAP_SIZE].canvasSize;
const TILE_SIZE = CANVAS_SIZE / GRID_SIZE;

// マップサイズ変更関数
export function setMapSize(size: MapSize): void {
  GRID_SIZE = MAP_SIZES[size].gridSize;
  CANVAS_SIZE = MAP_SIZES[size].canvasSize;
}

export function getCanvasSize(): number {
  return CANVAS_SIZE;
}

export function getTileSize(): number {
  return TILE_SIZE;
}

// タイル種別
export enum TileType {
  EMPTY = 0,
  // インフラ
  ROAD = -1,
  STATION = -2,
  PARK = -3,
  POLICE = -4,
  FIRE_STATION = -5,
  HOSPITAL = -6,
  SCHOOL = -7,
  POWER_PLANT = -8,
  WATER_TREATMENT = -9,
  // 住宅
  RESIDENTIAL_L1 = 1,
  RESIDENTIAL_L2 = 2,
  RESIDENTIAL_L3 = 3,
  RESIDENTIAL_L4 = 4,
  // 商業
  COMMERCIAL_L1 = 11,
  COMMERCIAL_L2 = 12,
  COMMERCIAL_L3 = 13,
  COMMERCIAL_L4 = 14,
  // 工業
  INDUSTRIAL_L1 = 21,
  INDUSTRIAL_L2 = 22,
  INDUSTRIAL_L3 = 23,
  INDUSTRIAL_L4 = 24,
  // ランドマーク
  LANDMARK_STADIUM = -50,
  LANDMARK_AIRPORT = -51,
}

// 建物カテゴリ
export type BuildingCategory =
  | "road"
  | "residential"
  | "commercial"
  | "industrial"
  | "infrastructure"
  | "landmark"
  | "demolish";

// カテゴリ別ツール定義
export const BUILDING_TOOLS: Record<
  BuildingCategory,
  { label: string; icon: string; color: string }
> = {
  road: { label: "道路", icon: "🛣️", color: "#444444" },
  residential: { label: "住宅", icon: "🏠", color: "#4a90e2" },
  commercial: { label: "商業", icon: "🏢", color: "#7ed321" },
  industrial: { label: "工業", icon: "🏭", color: "#f5a623" },
  infrastructure: { label: "インフラ", icon: "⚙️", color: "#bd10e0" },
  landmark: { label: "ランドマーク", icon: "🏛️", color: "#ff6b6b" },
  demolish: { label: "削除", icon: "💥", color: "#d0021b" },
};

// 建物サイズ定義（幅x高さ）
export const BUILDING_SIZES: Record<number, { width: number; height: number }> = {
  [TileType.LANDMARK_STADIUM]: { width: 4, height: 4 },
  [TileType.LANDMARK_AIRPORT]: { width: 6, height: 6 },
  [TileType.STATION]: { width: 2, height: 2 },
  [TileType.PARK]: { width: 2, height: 2 },
  [TileType.POLICE]: { width: 2, height: 2 },
  [TileType.FIRE_STATION]: { width: 2, height: 2 },
  [TileType.HOSPITAL]: { width: 2, height: 2 },
  [TileType.SCHOOL]: { width: 2, height: 2 },
  // POWER_PLANT/WATER_TREATMENT は 1x1（README仕様）。既定値と同じ {1,1} だが、
  // demolish() の複数マス判定 `if (BUILDING_SIZES[tileType])` が存在有無で分岐するため、
  // 削除せず明示的に残す（存在すれば単一マスの通常削除経路にも安全に乗る）。
  [TileType.POWER_PLANT]: { width: 1, height: 1 },
  [TileType.WATER_TREATMENT]: { width: 1, height: 1 },
};

// インフラごとの色定義
export const INFRASTRUCTURE_COLORS: Record<string, string> = {
  station: "#ffaa00", // オレンジ（鉄道）
  park: "#22dd22", // 明るい緑
  police: "#0066ff", // 青（警察）
  fire_station: "#ff3333", // 赤（消防）
  hospital: "#ff69b4", // ホットピンク（医療）
  school: "#ffbb33", // オレンジ黄（教育）
  power_plant: "#ffff00", // イエロー（電力）
  water_treatment: "#00ffff", // シアン（水道）
};

// ランドマークの色定義
export const LANDMARK_COLORS: Record<string, string> = {
  stadium: "#ff1493", // 深いピンク（スタジアム）
  airport: "#9932cc", // 暗い紫（空港）
};

// 人口テーブル
export const POPULATION_TABLE: Record<number, number> = {
  [TileType.RESIDENTIAL_L1]: 10,
  [TileType.RESIDENTIAL_L2]: 50,
  [TileType.RESIDENTIAL_L3]: 200,
  [TileType.RESIDENTIAL_L4]: 500,
  [TileType.COMMERCIAL_L1]: 5,
  [TileType.COMMERCIAL_L2]: 25,
  [TileType.COMMERCIAL_L3]: 100,
  [TileType.COMMERCIAL_L4]: 250,
  [TileType.INDUSTRIAL_L1]: 15,
  [TileType.INDUSTRIAL_L2]: 60,
  [TileType.INDUSTRIAL_L3]: 220,
  [TileType.INDUSTRIAL_L4]: 550,
};

// 建設コスト
export const BUILD_COSTS: Record<string, number> = {
  road: 200,
  station: 5000,
  park: 1000,
  police: 8000,
  fire_station: 7000,
  hospital: 10000,
  school: 6000,
  power_plant: 15000,
  water_treatment: 12000,
  residential: 0,
  commercial: 0,
  industrial: 0,
  landmark_stadium: 50000,
  landmark_airport: 80000,
};

// 月額維持費
// Step1リバランス: monthlyUpdate() は countBuildings() で算出した「建物単位」の棟数に
// 各値を掛けて月1回計上する（多マス建物のタイル数分の水増し課金を解消）。
// そのため、多マス建物（駅・公園・警察・消防・病院・学校・ランドマーク）の値は
// タイル単位ではなく「1棟あたり月額」として以下に再チューニングした。
export const MAINTENANCE_COSTS: Record<number, number> = {
  [TileType.ROAD]: 10,
  [TileType.STATION]: 300, // 100 → 300（建物単位換算に伴い再チューニング）
  [TileType.PARK]: 20, // 5 → 20（建物単位換算に伴い再チューニング）
  [TileType.POLICE]: 800, // 300 → 800（建物単位換算に伴い再チューニング）
  [TileType.FIRE_STATION]: 700, // 280 → 700（建物単位換算に伴い再チューニング）
  [TileType.HOSPITAL]: 1000, // 400 → 1000（建物単位換算に伴い再チューニング）
  [TileType.SCHOOL]: 600, // 250 → 600（建物単位換算に伴い再チューニング）
  [TileType.POWER_PLANT]: 600,
  [TileType.WATER_TREATMENT]: 500,
  [TileType.LANDMARK_STADIUM]: 3000, // 2000 → 3000（建物単位換算に伴い再チューニング）
  [TileType.LANDMARK_AIRPORT]: 6000, // 4000 → 6000（建物単位換算に伴い再チューニング）
};

// 月額税収
// Step1リバランス: monthlyUpdate() は countBuildings() で算出した「建物単位」の棟数に
// 各値を掛けて月1回計上する（多マス建物のタイル数分の水増し課税を解消）。
export const TAX_REVENUE: Record<number, number> = {
  [TileType.RESIDENTIAL_L1]: 30, // 20 → 30
  [TileType.RESIDENTIAL_L2]: 90, // 60 → 90
  [TileType.RESIDENTIAL_L3]: 220, // 150 → 220
  [TileType.RESIDENTIAL_L4]: 450, // 300 → 450
  [TileType.COMMERCIAL_L1]: 45, // 30 → 45
  [TileType.COMMERCIAL_L2]: 130, // 90 → 130
  [TileType.COMMERCIAL_L3]: 300, // 200 → 300
  [TileType.COMMERCIAL_L4]: 600, // 400 → 600
  [TileType.INDUSTRIAL_L1]: 40, // 25 → 40
  [TileType.INDUSTRIAL_L2]: 110, // 75 → 110
  [TileType.INDUSTRIAL_L3]: 270, // 180 → 270
  [TileType.INDUSTRIAL_L4]: 520, // 350 → 520
  [TileType.LANDMARK_STADIUM]: 500, // 100 → 500（建物単位換算に伴い再チューニング）
  [TileType.LANDMARK_AIRPORT]: 1000, // 200 → 1000（建物単位換算に伴い再チューニング）
};

// ==================== インフラ効果定数 ====================

// インフラの効果範囲（タイル単位）
export const INFRASTRUCTURE_EFFECTS = {
  police: {
    rangeRadius: 30, // 効果範囲半径
    securityBoost: 5, // 年間治安度向上
    growthPenalty: 0.5, // 治安度低い時の成長ペナルティ（0.5 = 50%低下）
  },
  fire_station: {
    rangeRadius: 30,
    safetyBoost: 5, // 年間安全度向上
    // fireSuppressionRate(0.75) は実装未参照かつ実際の消火成功率(DISASTER_BALANCE.fire.
    // extinguishSuccessRate=0.9)と食い違っていたため Step2 で削除（実装が正）。
  },
  school: {
    rangeRadius: 25,
    educationBoost: 3, // 年間教育度向上
    taxBonusThreshold: 60, // 教育度がこれ以上で税収+15%
  },
  hospital: {
    rangeRadius: 25,
    medicalBoost: 4, // 年間医療度向上
    // diseaseReductionRate(0.6) は実装未参照かつ実際の治癒成功率(DISASTER_BALANCE.disease.
    // healSuccessRate=0.7)と食い違っていたため Step2 で削除（実装が正）。
  },
  power_plant: {
    rangeRadius: 20,
    growthPenalty: 0.4, // 電力供給なし時の成長ペナルティ（40%低下）
  },
  water_treatment: {
    rangeRadius: 15,
    growthPenalty: 0.7, // 給水なし時の成長ペナルティ（70%低下）
    diseaseMultiplier: 3, // 給水なし時の病気発生倍率
  },
  station: {
    // 実装（engine.ts の ensureBoostMap()）は ±4 のチェビシェフ距離（正方形範囲）で
    // 判定しており、この rangeRadius:20 とは食い違っていたため、Step2で実装値(4)を正とし
    // growthRadius として定義し直した（挙動は変更せず、実装値をそのまま定数化）。
    growthRadius: 4, // 駅の成長ブースト範囲（チェビシェフ距離）
    growthMultiplier: 1.5, // 周辺成長速度倍率
  },
  park: {
    rangeRadius: 15,
    comfortBoost: 2, // 快適度向上値
  },
};

// ==================== 災害バランス定数 ====================
// Step2リバランス: engine.ts の updateFires()/updateDiseases() に散在していた魔法数を
// 現行の実装値のまま定数化したもの（挙動は不変）。searchRadius/spreadRadius は
// チェビシェフ距離（正方形の判定範囲、±N のネスト for ループ）で計測している。
export const DISASTER_BALANCE = {
  fire: {
    baseChance: 0.0002, // updateFires の発生率係数（現行値）
    spreadChance: 0.01, // 隣接波及確率（現行値）
    searchRadius: 15, // 消防署探索範囲（チェビシェフ、現行 ±15）
    extinguishSuccessRate: 0.9, // 消火成功率（現行 rng()<0.9 を採用）
    extinguishAmount: 5, // 消火時の減少量（現行 -5）
    decayAmount: 1, // 自然減衰（現行 -1）
    igniteAmount: 2, // 発生時の加算（現行 +2）
    spreadAmount: 1, // 波及時の加算（現行 +1）
    destroyThreshold: 10, // 建物破壊閾値（現行 >=10）
  },
  disease: {
    baseChance: 0.002, // Step6再調整: 蔓延がタイル降格で永続化するため発生率を抑制（旧0.01）
    spreadChance: 0.05, // Step6再調整（旧0.2）
    spreadRadius: 2, // Step6再調整（旧3）
    searchRadius: 10, // 病院探索範囲（チェビシェフ、現行 ±10）
    healSuccessRate: 0.7, // 治癒成功率（現行 rng()<0.7 を採用）
    healAmount: 3, // 治癒時の減少量（現行 -3）
    decayAmount: 1, // 自然減衰（現行 -1）
    igniteAmount: 5, // 発生時の加算（現行 +5）
    spreadAmount: 1, // 波及時の加算（現行 +1）
    outbreakThreshold: 10, // 蔓延トリガ閾値（>=でゾーンを1段階降格）
    noWaterMultiplier: 3, // 給水なしタイルで発生確率×3（README「病気3倍」を発生率として実装）
  },
  slum: {
    baseChance: 0.15, // Step6再調整: 旧0.01では毎月の減衰-0.5に負けスラムが実質発生しなかった
    decayAmount: 0.5, // 回復条件を満たす月のみ適用
    recoveryPollutionMax: 20, // 局所汚染がこれ未満かつ治安十分ならスラム回復
    recoverySecurityMin: 50,
    downgradeThreshold: 8, // slumMap がこれを超えると住宅を1段階降格
  },
  disasterDamageCost: 500, // 火災/病気による被害費（現行 -500）
};

// ランドマーク効果
// Step3リバランス: 観光度/国際化度は「棟数→目標値→平滑追従」モデルに変更した
// （CITY_LEVEL_MODEL 参照）。tourismPerBuilding/internationalPerBuilding は
// 1棟あたりの目標値への寄与量（旧 tourismBoost/internationalBoost の年間加算値とは別物）。
// commercialBonusMin/Max/rangeRadius は Step7で扱うため変更せず残置。
export const LANDMARK_EFFECTS = {
  stadium: {
    rangeRadius: 40,
    tourismPerBuilding: 40, // 観光度目標値への1棟あたり寄与
    commercialBonusMin: 500, // L1商業地観光収入
    commercialBonusMax: 3000, // L4商業地観光収入
  },
  airport: {
    rangeRadius: 50,
    tourismPerBuilding: 25, // 観光度目標値への1棟あたり寄与（スタジアムより少ない）
    internationalPerBuilding: 50, // 国際化度目標値への1棟あたり寄与
    commercialBonusMin: 1000, // L1商業地国際取引収入
    commercialBonusMax: 5000, // L4商業地国際取引収入
  },
};

// シナジー効果
// Step3リバランス: ペアごとの重複加算はしない「ブール型」（1組でも成立すれば加算）に変更。
// 値は target（カバー率→目標レベル）への加算量として使う。
export const SYNERGY_EFFECTS = {
  police_school: {
    distanceThreshold: 15, // 15マス以内でシナジー発生
    securityBoost: 5,
    educationBoost: 5,
  },
  school_hospital: {
    distanceThreshold: 15,
    educationBoost: 5,
    medicalBoost: 5,
  },
  station_school_police: {
    distanceThreshold: 20,
    commercialGrowthMult: 1.2, // 商業高層化確率の乗数
  },
};

// ==================== 都市レベルモデル（効果カバー率×平滑追従） ====================
// Step3リバランス: 治安/安全/教育/医療/観光/国際化の各レベルは、旧来の「効果範囲内で
// 加算し続けて上限に張り付く」モデルから、「必要数に対するカバー率(ratio)から目標値(target)
// を算出し、毎月 target に向かって smoothing の割合だけ近づく」モデルに変更した。
export const CITY_LEVEL_MODEL = {
  baseLevel: 20, // 施設0個時の到達目標
  fullLevel: 80, // 必要数ちょうど(ratio=1)の到達目標
  overProvisionMax: 90, // ratio>=overProvisionRatio での上限
  overProvisionRatio: 1.25,
  smoothing: 0.25, // 毎月の目標追従率
  synergyCap: 100, // シナジー加算後の上限
};

// ==================== 人口スケーリング ====================

// 人口に対するインフラ必要数
// Step1リバランス: 維持費が建物単位で計上されるようになったのに合わせ、
// 必要棟数（＝維持費負担）が増えすぎないよう populationPerUnit を引き上げた。
export const INFRASTRUCTURE_REQUIREMENTS = {
  police: {
    populationPerUnit: 2500, // 1000 → 2500（2,500人ごとに警察署1個必要）
    base: 1, // 最低1個必要
  },
  fire_station: {
    populationPerUnit: 2500, // 1000 → 2500
    base: 1,
  },
  school: {
    populationPerUnit: 3000, // 1500 → 3000
    base: 1,
  },
  hospital: {
    populationPerUnit: 3000, // 1500 → 3000
    base: 1,
  },
  power_plant: {
    populationPerUnit: 4000, // 2000 → 4000
    base: 1,
  },
  water_treatment: {
    populationPerUnit: 4000, // 2000 → 4000
    base: 1,
  },
};

// ==================== 需要モデル・成長バランス ====================
// Step4リバランス: calculateDemands() をマップ面積非依存の「雇用バランスモデル」に
// 全面書き換え。POPULATION_TABLE を「住宅=居住人口／商業・工業=雇用数」として読み、
// 住宅人口のうち employmentRate の割合が働き手(workers)、商業+工業の人口合計が
// 求人数(jobs)であるとみなし、workers と jobs の需給比から各需要を算出する。
export const DEMAND_MODEL = {
  employmentRate: 0.5, // 就業率（住宅人口のうち労働者の割合）
  neutralDemand: 50, // 均衡時（workers=jobs）の需要
  bootstrapDemand: 75, // 人口も雇用も0のときの初期需要（何もない状態から発展を促す）
  growthMultSlope: 0.006, // 需要→成長倍率の傾き
  growthMultMin: 0.7,
  growthMultMax: 1.3,
  spawnResidentialWeight: 2, // 新規スポーン抽選での住宅重み係数（住宅を優遇し無限ループ的な停滞を防ぐ）
};

// grow() の基礎成長率・波及/高層化の倍率を定数化（旧: engine.ts 内のマジックナンバー）。
export const GROWTH_BALANCE = {
  baseRate: 0.02, // 基礎成長率（旧 growthRate 初期値）
  spilloverFactor: 0.2, // 波及建設の倍率（旧 0.2）
  upgradeFactor: 0.4, // 高層化の倍率（旧 0.4）
};

// 快適度モデル（calculateComfort が唯一の算出元。散在していた comfort *= は廃止）
export const COMFORT_MODEL = {
  weights: { green: 0.25, transport: 0.2, density: 0.2, fund: 0.1, service: 0.25 },
  parkCoverRadius: 10, // 公園カバー判定（チェビシェフ距離）
  stationCoverRadius: 8, // 駅カバー判定（チェビシェフ距離）
  densityComfortCap: 0.6, // 平均密度 u がこれ以下なら密度スコア100
  densitySlope: 250, // u が cap を超えた分に対する減点勾配
  maxResidentsPerHouseTile: 500, // 住宅L4の人口=密度uの基準
  pollutionPenaltyMax: 0.3, // 全汚染で最大 -30%
  slumPenaltyMax: 0.4, // 全スラムで最大 -40%
};

// パラメータの初期値
export const INITIAL_PARAMETERS = {
  securityLevel: 50,
  safetyLevel: 50,
  educationLevel: 50,
  medicalLevel: 50,
  tourismLevel: 0,
  internationalLevel: 0,
  powerSupplyRate: 0,
  waterSupplyRate: 0,
};
