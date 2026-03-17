// ゲーム定数
export const GAME_VERSION = "1.0.7";

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
  [TileType.HOSPITAL]: { width: 3, height: 3 },
  [TileType.SCHOOL]: { width: 3, height: 3 },
  [TileType.POWER_PLANT]: { width: 4, height: 4 },
  [TileType.WATER_TREATMENT]: { width: 3, height: 3 },
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
export const MAINTENANCE_COSTS: Record<number, number> = {
  [TileType.ROAD]: 10,
  [TileType.STATION]: 100,
  [TileType.PARK]: 5,
  [TileType.POLICE]: 300, // 200 → 300
  [TileType.FIRE_STATION]: 280, // 180 → 280
  [TileType.HOSPITAL]: 400, // 250 → 400
  [TileType.SCHOOL]: 250, // 150 → 250
  [TileType.POWER_PLANT]: 600, // 400 → 600
  [TileType.WATER_TREATMENT]: 500, // 300 → 500
  [TileType.LANDMARK_STADIUM]: 2000, // 1000 → 2000
  [TileType.LANDMARK_AIRPORT]: 4000, // 2000 → 4000
};

// 月額税収
export const TAX_REVENUE: Record<number, number> = {
  [TileType.RESIDENTIAL_L1]: 20,
  [TileType.RESIDENTIAL_L2]: 60,
  [TileType.RESIDENTIAL_L3]: 150,
  [TileType.RESIDENTIAL_L4]: 300,
  [TileType.COMMERCIAL_L1]: 30,
  [TileType.COMMERCIAL_L2]: 90,
  [TileType.COMMERCIAL_L3]: 200,
  [TileType.COMMERCIAL_L4]: 400,
  [TileType.INDUSTRIAL_L1]: 25,
  [TileType.INDUSTRIAL_L2]: 75,
  [TileType.INDUSTRIAL_L3]: 180,
  [TileType.INDUSTRIAL_L4]: 350,
  [TileType.LANDMARK_STADIUM]: 100, // 5000 → 100（月額基本料）
  [TileType.LANDMARK_AIRPORT]: 200, // 10000 → 200（月額基本料）
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
    fireSuppressionRate: 0.75, // 火災発生確率低下率（75%低下）
  },
  school: {
    rangeRadius: 25,
    educationBoost: 3, // 年間教育度向上
    taxBonusThreshold: 60, // 教育度がこれ以上で税収+15%
  },
  hospital: {
    rangeRadius: 25,
    medicalBoost: 4, // 年間医療度向上
    diseaseReductionRate: 0.6, // 病気発生確率低下率（60%低下）
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
    rangeRadius: 20,
    growthBoost: 1.5, // 周辺成長速度倍率
  },
  park: {
    rangeRadius: 15,
    comfortBoost: 2, // 快適度向上値
  },
};

// ランドマーク効果
export const LANDMARK_EFFECTS = {
  stadium: {
    rangeRadius: 40,
    tourismBoost: 5, // 年間観光度向上
    commercialBonusMin: 500, // L1商業地観光収入
    commercialBonusMax: 3000, // L4商業地観光収入
  },
  airport: {
    rangeRadius: 50,
    tourismBoost: 3, // 年間観光度向上（スタジアムより少ない）
    internationalBoost: 5, // 年間国際化度向上
    commercialBonusMin: 1000, // L1商業地国際取引収入
    commercialBonusMax: 5000, // L4商業地国際取引収入
  },
};

// シナジー効果
export const SYNERGY_EFFECTS = {
  police_school: {
    distanceThreshold: 15, // 15マス以内でシナジー発生
    securityBoost: 10,
    educationBoost: 10,
  },
  school_hospital: {
    distanceThreshold: 15,
    educationBoost: 5,
    medicalBoost: 5,
  },
  station_school_police: {
    distanceThreshold: 20,
    commercialGrowthBonus: 0.2, // 商業成長+20%
  },
};

// ==================== 人口スケーリング ====================

// 人口に対するインフラ必要数
export const INFRASTRUCTURE_REQUIREMENTS = {
  police: {
    populationPerUnit: 1000, // 1,000人ごとに警察署1個必要
    base: 1, // 最低1個必要
  },
  fire_station: {
    populationPerUnit: 1000,
    base: 1,
  },
  school: {
    populationPerUnit: 1500,
    base: 1,
  },
  hospital: {
    populationPerUnit: 1500,
    base: 1,
  },
  power_plant: {
    populationPerUnit: 2000,
    base: 1,
  },
  water_treatment: {
    populationPerUnit: 2000,
    base: 1,
  },
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
