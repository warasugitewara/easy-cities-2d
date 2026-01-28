// ゲーム定数
export type MapSize = 'small' | 'medium' | 'large';

export const MAP_SIZES: Record<MapSize, { gridSize: number; canvasSize: number; label: string }> = {
  small: { gridSize: 64, canvasSize: 512, label: '小（512x512）' },
  medium: { gridSize: 128, canvasSize: 1024, label: '中（1024x1024）' },
  large: { gridSize: 256, canvasSize: 2048, label: '大（2048x2048）' },
};

// デフォルト値（中サイズ）
export const DEFAULT_MAP_SIZE: MapSize = 'medium';
let GRID_SIZE = MAP_SIZES[DEFAULT_MAP_SIZE].gridSize;
let CANVAS_SIZE = MAP_SIZES[DEFAULT_MAP_SIZE].canvasSize;
const TILE_SIZE = CANVAS_SIZE / GRID_SIZE;

// マップサイズ変更関数
export function setMapSize(size: MapSize): void {
  GRID_SIZE = MAP_SIZES[size].gridSize;
  CANVAS_SIZE = MAP_SIZES[size].canvasSize;
}

export function getGridSize(): number {
  return GRID_SIZE;
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
export type BuildingCategory = 'road' | 'residential' | 'commercial' | 'industrial' | 'infrastructure' | 'landmark' | 'demolish';

// カテゴリ別ツール定義
export const BUILDING_TOOLS: Record<BuildingCategory, { label: string; icon: string; color: string }> = {
  road: { label: '道路', icon: '🛣️', color: '#666' },
  residential: { label: '住宅', icon: '🏠', color: '#4a90e2' },
  commercial: { label: '商業', icon: '🏢', color: '#7ed321' },
  industrial: { label: '工業', icon: '🏭', color: '#f5a623' },
  infrastructure: { label: 'インフラ', icon: '⚙️', color: '#bd10e0' },
  landmark: { label: 'ランドマーク', icon: '🏛️', color: '#ff6b6b' },
  demolish: { label: '削除', icon: '💥', color: '#d0021b' },
};

// 建物タイプごとの詳細情報
export const BUILDING_INFO: Record<TileType | string, { name: string; category: BuildingCategory; cost: number; maintenance: number; population?: number; revenue?: number }> = {
  // インフラ
  [TileType.ROAD]: { name: '道路', category: 'road', cost: 200, maintenance: 10 },
  [TileType.STATION]: { name: '駅', category: 'infrastructure', cost: 5000, maintenance: 100 },
  [TileType.PARK]: { name: '公園', category: 'infrastructure', cost: 1000, maintenance: 5 },
  [TileType.POLICE]: { name: '警察署', category: 'infrastructure', cost: 8000, maintenance: 200 },
  [TileType.FIRE_STATION]: { name: '消防署', category: 'infrastructure', cost: 7000, maintenance: 180 },
  [TileType.HOSPITAL]: { name: '病院', category: 'infrastructure', cost: 10000, maintenance: 250 },
  [TileType.SCHOOL]: { name: '学校', category: 'infrastructure', cost: 6000, maintenance: 150 },
  [TileType.POWER_PLANT]: { name: '発電所', category: 'infrastructure', cost: 15000, maintenance: 400 },
  [TileType.WATER_TREATMENT]: { name: '水処理施設', category: 'infrastructure', cost: 12000, maintenance: 300 },
  // 住宅
  [TileType.RESIDENTIAL_L1]: { name: '住宅Lv1', category: 'residential', cost: 0, maintenance: 0, population: 10, revenue: 20 },
  [TileType.RESIDENTIAL_L2]: { name: '住宅Lv2', category: 'residential', cost: 0, maintenance: 0, population: 50, revenue: 60 },
  [TileType.RESIDENTIAL_L3]: { name: '住宅Lv3', category: 'residential', cost: 0, maintenance: 0, population: 200, revenue: 150 },
  [TileType.RESIDENTIAL_L4]: { name: '住宅Lv4', category: 'residential', cost: 0, maintenance: 0, population: 500, revenue: 300 },
  // 商業
  [TileType.COMMERCIAL_L1]: { name: '商業Lv1', category: 'commercial', cost: 0, maintenance: 0, population: 5, revenue: 30 },
  [TileType.COMMERCIAL_L2]: { name: '商業Lv2', category: 'commercial', cost: 0, maintenance: 0, population: 25, revenue: 90 },
  [TileType.COMMERCIAL_L3]: { name: '商業Lv3', category: 'commercial', cost: 0, maintenance: 0, population: 100, revenue: 200 },
  [TileType.COMMERCIAL_L4]: { name: '商業Lv4', category: 'commercial', cost: 0, maintenance: 0, population: 250, revenue: 400 },
  // 工業
  [TileType.INDUSTRIAL_L1]: { name: '工業Lv1', category: 'industrial', cost: 0, maintenance: 0, population: 15, revenue: 25 },
  [TileType.INDUSTRIAL_L2]: { name: '工業Lv2', category: 'industrial', cost: 0, maintenance: 0, population: 60, revenue: 75 },
  [TileType.INDUSTRIAL_L3]: { name: '工業Lv3', category: 'industrial', cost: 0, maintenance: 0, population: 220, revenue: 180 },
  [TileType.INDUSTRIAL_L4]: { name: '工業Lv4', category: 'industrial', cost: 0, maintenance: 0, population: 550, revenue: 350 },
  // ランドマーク
  [TileType.LANDMARK_STADIUM]: { name: 'スタジアム', category: 'landmark', cost: 50000, maintenance: 1000, population: 0, revenue: 5000 },
  [TileType.LANDMARK_AIRPORT]: { name: '空港', category: 'landmark', cost: 80000, maintenance: 2000, population: 0, revenue: 10000 },
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
  [TileType.POLICE]: 200,
  [TileType.FIRE_STATION]: 180,
  [TileType.HOSPITAL]: 250,
  [TileType.SCHOOL]: 150,
  [TileType.POWER_PLANT]: 400,
  [TileType.WATER_TREATMENT]: 300,
  [TileType.LANDMARK_STADIUM]: 1000,
  [TileType.LANDMARK_AIRPORT]: 2000,
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
  [TileType.LANDMARK_STADIUM]: 5000,
  [TileType.LANDMARK_AIRPORT]: 10000,
};
