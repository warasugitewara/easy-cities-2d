// ゲーム定数
export const GRID_SIZE = 128;
export const TILE_SIZE = 8; // 1024 / 128
export const CANVAS_SIZE = GRID_SIZE * TILE_SIZE;

// タイル種別
export enum TileType {
  EMPTY = 0,
  ROAD = -1,
  STATION = -2,
  PARK = -3,
  // 建物レベル 1-4
  BUILDING_L1 = 1,
  BUILDING_L2 = 2,
  BUILDING_L3 = 3,
  BUILDING_L4 = 4,
}

// 人口テーブル
export const POPULATION_TABLE: Record<number, number> = {
  [TileType.BUILDING_L1]: 10,
  [TileType.BUILDING_L2]: 50,
  [TileType.BUILDING_L3]: 200,
  [TileType.BUILDING_L4]: 500,
};

// 建設コスト
export const BUILD_COSTS: Record<string, number> = {
  road: 200,
  station: 5000,
  park: 1000,
};

// 月額維持費
export const MAINTENANCE_COSTS: Record<number, number> = {
  [TileType.ROAD]: 10,
  [TileType.STATION]: 100,
  [TileType.PARK]: 5,
};

// 月額税収
export const TAX_REVENUE: Record<number, number> = {
  [TileType.BUILDING_L1]: 20,
  [TileType.BUILDING_L2]: 60,
  [TileType.BUILDING_L3]: 150,
  [TileType.BUILDING_L4]: 300,
};
