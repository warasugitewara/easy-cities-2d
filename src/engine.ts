import { MapSize, MAP_SIZES, TileType, POPULATION_TABLE, TAX_REVENUE, MAINTENANCE_COSTS, BUILD_COSTS, BuildingCategory, getGridSize, BUILDING_SIZES } from './constants';

// ゲーム設定インターフェース
export interface GameSettings {
  difficulty: 'easy' | 'normal' | 'hard';
  mapSize: MapSize;
  disastersEnabled: boolean;
  pollutionEnabled: boolean;
  slumEnabled: boolean;
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
}

export class GameEngine {
  state: GameState;
  private growthRate: number = 0.02;
  private gridSize: number;

  constructor(settings?: GameSettings) {
    const mapSize = settings?.mapSize || 'medium';
    this.gridSize = MAP_SIZES[mapSize].gridSize;

    this.state = {
      map: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(TileType.EMPTY)),
      population: 0,
      money: 250000,
      comfort: 50,
      month: 0,
      paused: false,
      buildMode: 'road',
      gridSize: this.gridSize,
      selectedInfrastructure: 'station',
      selectedLandmark: 'stadium',
      gameSpeed: 1,
      settings: settings || {
        difficulty: 'normal',
        mapSize: 'medium',
        disastersEnabled: false,
        pollutionEnabled: false,
        slumEnabled: false,
      },
    };
    // 初期に中央に駅を配置
    const center = this.gridSize / 2;
    this.state.map[Math.floor(center)][Math.floor(center)] = TileType.STATION;
  }

  // 建設処理
  build(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) return false;

    const cost = this.getCost(this.state.buildMode);
    console.log('💰 Cost for', this.state.buildMode, ':', cost, 'Money:', this.state.money);
    
    if (this.state.money < cost) {
      console.log('❌ Not enough money');
      return false;
    }

    if (this.state.buildMode === 'demolish') {
      if (this.state.map[y][x] !== TileType.EMPTY) {
        this.state.map[y][x] = TileType.EMPTY;
      }
      return true;
    }

    if (this.state.map[y][x] !== TileType.EMPTY) {
      console.log('❌ Tile not empty:', this.state.map[y][x]);
      return false;
    }

    let tileType: TileType | null = null;

    switch (this.state.buildMode) {
      case 'road':
        tileType = TileType.ROAD;
        break;
      case 'residential':
        tileType = TileType.RESIDENTIAL_L1;
        break;
      case 'commercial':
        tileType = TileType.COMMERCIAL_L1;
        break;
      case 'industrial':
        tileType = TileType.INDUSTRIAL_L1;
        break;
      case 'infrastructure':
        // 選択されたインフラストラクチャータイプに応じて設置
        switch (this.state.selectedInfrastructure) {
          case 'station':
            tileType = TileType.STATION;
            break;
          case 'park':
            tileType = TileType.PARK;
            break;
          case 'police':
            tileType = TileType.POLICE;
            break;
          case 'fire_station':
            tileType = TileType.FIRE_STATION;
            break;
          case 'hospital':
            tileType = TileType.HOSPITAL;
            break;
          case 'school':
            tileType = TileType.SCHOOL;
            break;
          case 'power_plant':
            tileType = TileType.POWER_PLANT;
            break;
          case 'water_treatment':
            tileType = TileType.WATER_TREATMENT;
            break;
          default:
            tileType = TileType.STATION;
        }
        break;
      case 'landmark':
        // 選択されたランドマークタイプに応じて設置
        switch (this.state.selectedLandmark) {
          case 'stadium':
            tileType = TileType.LANDMARK_STADIUM;
            break;
          case 'airport':
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
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= this.gridSize || ny >= this.gridSize || this.state.map[ny][nx] !== TileType.EMPTY) {
            console.log('❌ Not enough space for', tileType);
            return false;
          }
        }
      }

      // 建物を配置
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          this.state.map[ny][nx] = tileType;
        }
      }

      console.log('✅ Building placed, tileType:', tileType, 'size:', size);
      this.state.money -= cost;
      return true;
    }

    console.log('❌ tileType is null');
    return false;
  }

  private getCost(mode: BuildingCategory): number {
    return BUILD_COSTS[mode] || 0;
  }

  // 都心バイアス
  private centerBias(x: number, y: number): number {
    const center = this.gridSize / 2;
    const dx = x - center;
    const dy = y - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0.3, 1 - dist / center);
  }

  // 隣接判定
  private hasAdjacent(x: number, y: number, condition: (tile: number) => boolean): boolean {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return dirs.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize && condition(this.state.map[ny][nx]);
    });
  }

  // 駅ブースト
  private stationBoost(x: number, y: number): number {
    let boost = 1;
    for (let yy = -4; yy <= 4; yy++) {
      for (let xx = -4; xx <= 4; xx++) {
        const nx = x + xx;
        const ny = y + yy;
        if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize && this.state.map[ny][nx] === TileType.STATION) {
          boost = 1.5;
        }
      }
    }
    return boost;
  }

  // 成長処理
  grow(): void {
    if (this.state.paused || this.state.gameSpeed === 0) return;

    // gameSpeed に応じた処理回数
    const iterations = this.state.gameSpeed >= 1 ? Math.floor(this.state.gameSpeed) : 1;
    const probability = this.state.gameSpeed < 1 ? this.state.gameSpeed : 1;

    for (let iter = 0; iter < iterations; iter++) {
      if (this.state.gameSpeed < 1 && Math.random() > probability) continue;

      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          const bias = this.centerBias(x, y) * this.stationBoost(x, y);

          // 新規建設（道路隣接）
          if (this.state.map[y][x] === TileType.EMPTY && this.hasAdjacent(x, y, (t) => t === TileType.ROAD)) {
            if (Math.random() < this.growthRate * bias) {
              this.state.map[y][x] = TileType.RESIDENTIAL_L1;
            }
          }

          // 波及建設（0.2倍）- 他の建物に隣接していても成長
          if (this.state.map[y][x] === TileType.EMPTY && this.hasAdjacent(x, y, (t) => t >= 1 && t <= 24)) {
            if (Math.random() < this.growthRate * 0.2 * bias) {
              this.state.map[y][x] = TileType.RESIDENTIAL_L1;
            }
          }

          // 高層化（最大Lv4）- 住宅のみ
          if (this.state.map[y][x] >= TileType.RESIDENTIAL_L1 && this.state.map[y][x] < TileType.RESIDENTIAL_L4) {
            if (Math.random() < this.growthRate * 0.4 * bias) {
              this.state.map[y][x]++;
            }
          }

          // 商業地の高層化
          if (this.state.map[y][x] >= TileType.COMMERCIAL_L1 && this.state.map[y][x] < TileType.COMMERCIAL_L4) {
            if (Math.random() < this.growthRate * 0.4 * bias) {
              this.state.map[y][x]++;
            }
          }

          // 工業地の高層化
          if (this.state.map[y][x] >= TileType.INDUSTRIAL_L1 && this.state.map[y][x] < TileType.INDUSTRIAL_L4) {
            if (Math.random() < this.growthRate * 0.4 * bias) {
              this.state.map[y][x]++;
            }
          }
        }
      }
    }
  }

  // 月次更新（税収・維持費）
  monthlyUpdate(): void {
    if (this.state.paused) return;

    let revenue = 0;
    let maintenance = 0;

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        revenue += TAX_REVENUE[tile] || 0;
        maintenance += MAINTENANCE_COSTS[tile] || 0;
      }
    }

    this.state.money += revenue - maintenance;
    this.state.month++;

    // 破産判定
    if (this.state.money < 0) {
      alert('資金がなくなりました！ゲームオーバーです');
      this.reset();
    }
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
  // 快適度計算
  calculateComfort(): number {
    let score = 0;

    // 1. 緑地率
    let parkCount = 0;
    let totalTiles = 0;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.map[y][x] !== TileType.EMPTY) totalTiles++;
        if (this.state.map[y][x] === TileType.PARK) parkCount++;
      }
    }
    const greenScore = totalTiles > 0 ? (parkCount / totalTiles) * 100 : 0;

    // 2. 交通充実度（駅の数と分布）
    let stationCount = 0;
    let stationDispersion = 0;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.map[y][x] === TileType.STATION) stationCount++;
      }
    }
    const transportScore = Math.min(stationCount * 5, 100);

    // 3. 人口密度スコア（過密を避ける）
    const densityScore = Math.max(0, 100 - (this.state.population / 50));

    // 4. 資金状況反映
    const fundScore = Math.min((this.state.money / 250000) * 100, 100);

    // 総合スコア
    score = (greenScore + transportScore + densityScore + fundScore) / 4;
    this.state.comfort = Math.round(score);
    return this.state.comfort;
  }

  // リセット
  reset(): void {
    this.state = {
      map: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(TileType.EMPTY)),
      population: 0,
      money: 250000,
      comfort: 50,
      month: 0,
      paused: false,
      buildMode: 'road',
      gridSize: this.gridSize,
      settings: this.state.settings,
    };
    const center = this.gridSize / 2;
    this.state.map[Math.floor(center)][Math.floor(center)] = TileType.STATION;
  }

  // 速度設定
  setGrowthRate(rate: number): void {
    this.growthRate = rate;
  }
}
