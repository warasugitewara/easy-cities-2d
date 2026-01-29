import { MapSize, MAP_SIZES, TileType, POPULATION_TABLE, TAX_REVENUE, MAINTENANCE_COSTS, BUILD_COSTS, BuildingCategory, getGridSize, BUILDING_SIZES, INITIAL_PARAMETERS, INFRASTRUCTURE_REQUIREMENTS } from './constants';

// ゲーム設定インターフェース
export interface GameSettings {
  difficulty: 'easy' | 'normal' | 'hard';
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
  fireMap: number[][];     // 火災レベル（0=なし、1-10=火の強さ）
  diseaseMap: number[][];  // 病気レベル（0=なし、1-10=病気の強さ）
  crimeMap: number[][];    // 犯罪率（0-100）
  pollutionMap: number[][]; // 汚染度（0-100）
  slumMap: number[][];     // スラム化レベル（0=なし、1-10=スラム化の強さ）
  // 詳細パラメータ
  securityLevel: number;   // 治安度（0-100）
  safetyLevel: number;     // 安全度（0-100）
  educationLevel: number;  // 教育度（0-100）
  medicalLevel: number;    // 医療度（0-100）
  tourismLevel: number;    // 観光度（0-100）
  internationalLevel: number; // 国際化度（0-100）
  powerSupplyRate: number; // 電力供給率（％）
  waterSupplyRate: number; // 給水率（％）
  pollutionLevel: number;  // 全体汚染度（0-100）
  slumRate: number;        // スラム化率（0-100）
  // 需要メータ
  residentialDemand: number; // 住宅地需要（0-100）
  commercialDemand: number;  // 商業地需要（0-100）
  industrialDemand: number;  // 工業地需要（0-100）
  showDemandMeters: boolean; // 需要メータ表示フラグ
  // ペナルティシステム
  growthPenalty: number;   // 成長速度補正係数（1.0 = 通常、0.5 = 50%低下）
  revenuePenalty: number;  // 税収補正係数（1.0 = 通常）
}

export class GameEngine {
  state: GameState;
  private growthRate: number = 0.02;
  private gridSize: number;
  private maintenanceMultiplier: number = 1.0;
  private disasterRateMultiplier: number = 1.0;

  constructor(settings?: GameSettings) {
    const mapSize = settings?.mapSize || 'medium';
    const difficulty = settings?.difficulty || 'normal';
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

    this.state = {
      map: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(TileType.EMPTY)),
      population: 0,
      money: config.initialMoney,
      comfort: 50,
      month: 0,
      paused: false,
      buildMode: 'road',
      gridSize: this.gridSize,
      selectedInfrastructure: 'station',
      selectedLandmark: 'stadium',
      gameSpeed: 1,
      powerGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      waterGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      fireMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      diseaseMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      crimeMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
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
        difficulty: 'normal',
        mapSize: 'medium',
        disastersEnabled: false,
        pollutionEnabled: false,
        slumEnabled: false,
        sandbox: false,
      },
    };
    // 初期に中央に駅を配置
    const center = this.gridSize / 2;
    this.state.map[Math.floor(center)][Math.floor(center)] = TileType.STATION;
    
    console.log(`🎮 Game initialized - Difficulty: ${difficulty}, Initial Money: ${config.initialMoney}, Maintenance: ${config.maintenanceMultiplier}x, Disasters: ${config.disasterRateMultiplier}x`);
  }

  // 建設処理
  build(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) return false;

    const cost = this.getCost(this.state.buildMode);
    console.log('💰 Cost for', this.state.buildMode, ':', cost, 'Money:', this.state.money);
    
    // サンドボックスモードでない場合のみ資金チェック
    if (!this.state.settings.sandbox && this.state.money < cost) {
      console.log('❌ Not enough money');
      return false;
    }

    if (this.state.buildMode === 'demolish') {
      if (this.state.map[y][x] !== TileType.EMPTY) {
        const tileType = this.state.map[y][x];
        
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

      console.log('✅ Building placed, tileType:', tileType, 'size:', size, 'mode:', this.state.buildMode, 'infrastructure:', this.state.selectedInfrastructure, 'landmark:', this.state.selectedLandmark);
      this.state.money -= cost;
      return true;
    }

    console.log('❌ tileType is null');
    return false;
  }

  private getCost(mode: BuildingCategory): number {
    if (mode === 'infrastructure') {
      // 選択されたインフラのコストを返す
      const costs: Record<string, number> = {
        station: 5000,
        park: 1000,
        police: 8000,
        fire_station: 7000,
        hospital: 10000,
        school: 6000,
        power_plant: 15000,
        water_treatment: 12000,
      };
      return costs[this.state.selectedInfrastructure] || 5000;
    } else if (mode === 'landmark') {
      // 選択されたランドマークのコストを返す
      const costs: Record<string, number> = {
        stadium: 50000,
        airport: 80000,
      };
      return costs[this.state.selectedLandmark] || 50000;
    }
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
          
          // ローカルペナルティを計算（電力・給水供給があるか）
          let localPenalty = this.state.growthPenalty;
          if (!this.state.powerGrid[y][x]) localPenalty *= 0.6; // 電力なし：60%に低下
          if (!this.state.waterGrid[y][x]) localPenalty *= 0.3; // 給水なし：30%に低下

          // 需要に応じたボーナス/ペナルティを適用
          const tile = this.state.map[y][x];
          if (tile >= TileType.RESIDENTIAL_L1 && tile <= TileType.RESIDENTIAL_L4) {
            // 住宅地：需要が高いほどボーナス、低いほどペナルティ
            if (this.state.residentialDemand > 50) {
              localPenalty *= (1 + (this.state.residentialDemand - 50) * 0.006); // 最大 +30%
            } else if (this.state.residentialDemand < 10) {
              localPenalty *= 0.7; // -30%
            }
          } else if (tile >= TileType.COMMERCIAL_L1 && tile <= TileType.COMMERCIAL_L4) {
            // 商業地：需要が高いほどボーナス
            if (this.state.commercialDemand > 50) {
              localPenalty *= (1 + (this.state.commercialDemand - 50) * 0.006);
            } else if (this.state.commercialDemand < 10) {
              localPenalty *= 0.7;
            }
          } else if (tile >= TileType.INDUSTRIAL_L1 && tile <= TileType.INDUSTRIAL_L4) {
            // 工業地：需要が高いほどボーナス
            if (this.state.industrialDemand > 50) {
              localPenalty *= (1 + (this.state.industrialDemand - 50) * 0.006);
            } else if (this.state.industrialDemand < 10) {
              localPenalty *= 0.7;
            }
          }

          // 新規建設（道路隣接）
          if (this.state.map[y][x] === TileType.EMPTY && this.hasAdjacent(x, y, (t) => t === TileType.ROAD)) {
            // 新規建設は全ゾーン需要の平均を参照
            let demandBonus = 1.0;
            const avgDemand = (this.state.residentialDemand + this.state.commercialDemand + this.state.industrialDemand) / 3;
            if (avgDemand > 50) {
              demandBonus = 1 + (avgDemand - 50) * 0.006;
            } else if (avgDemand < 10) {
              demandBonus = 0.7;
            }
            if (Math.random() < this.growthRate * bias * localPenalty * demandBonus) {
              this.state.map[y][x] = TileType.RESIDENTIAL_L1;
            }
          }

          // 波及建設（0.2倍）- 他の建物に隣接していても成長
          if (this.state.map[y][x] === TileType.EMPTY && this.hasAdjacent(x, y, (t) => t >= 1 && t <= 24)) {
            let demandBonus = 1.0;
            const avgDemand = (this.state.residentialDemand + this.state.commercialDemand + this.state.industrialDemand) / 3;
            if (avgDemand > 50) {
              demandBonus = 1 + (avgDemand - 50) * 0.006;
            } else if (avgDemand < 10) {
              demandBonus = 0.7;
            }
            if (Math.random() < this.growthRate * 0.2 * bias * localPenalty * demandBonus) {
              this.state.map[y][x] = TileType.RESIDENTIAL_L1;
            }
          }

          // 高層化（最大Lv4）- 住宅のみ
          if (this.state.map[y][x] >= TileType.RESIDENTIAL_L1 && this.state.map[y][x] < TileType.RESIDENTIAL_L4) {
            if (Math.random() < this.growthRate * 0.4 * bias * localPenalty) {
              this.state.map[y][x]++;
            }
          }

          // 商業地の高層化
          if (this.state.map[y][x] >= TileType.COMMERCIAL_L1 && this.state.map[y][x] < TileType.COMMERCIAL_L4) {
            if (Math.random() < this.growthRate * 0.4 * bias * localPenalty) {
              this.state.map[y][x]++;
            }
          }

          // 工業地の高層化
          if (this.state.map[y][x] >= TileType.INDUSTRIAL_L1 && this.state.map[y][x] < TileType.INDUSTRIAL_L4) {
            if (Math.random() < this.growthRate * 0.4 * bias * localPenalty) {
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

    // インフラシステム更新
    this.updateInfrastructure();
    
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

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        revenue += TAX_REVENUE[tile] || 0;
        maintenance += MAINTENANCE_COSTS[tile] || 0;
      }
    }

    // ペナルティを税収に適用
    revenue *= this.state.revenuePenalty;
    
    // 教育度が高いと税収ボーナス（educationLevel >= 60 で +15%、さらに高いほどボーナス）
    if (this.state.educationLevel >= 60) {
      const educationBonus = 0.15 + ((this.state.educationLevel - 60) * 0.0025); // 最大 +15% + (40 * 0.0025) = +16%
      revenue *= (1 + educationBonus);
    }
    
    // 観光度が商業収入に反映（観光度が高いほど商業地収入が増加）
    if (this.state.tourismLevel > 0 || this.state.internationalLevel > 0) {
      const tourismBonus = (this.state.tourismLevel * 0.01) + (this.state.internationalLevel * 0.01);
      revenue *= (1 + tourismBonus);
    }
    
    // ランドマーク商業ボーナス（スタジアム・空港周辺商業地への観光収入）
    revenue += this.calculateLandmarkCommercialBonus();
    
    // 難易度に応じた維持費倍率を適用
    maintenance *= this.maintenanceMultiplier;

    this.state.money += revenue - maintenance;
    this.state.month++;

    // 破産判定
    if (this.state.money < 0) {
      alert('資金がなくなりました！ゲームオーバーです');
      this.reset();
    }
  }

  // インフラ効果の計算・反映
  private updateInfrastructureEffects(): void {
    // 各パラメータを少し減衰させてからリセット（前月の記憶を保つ）
    this.state.securityLevel = Math.max(40, this.state.securityLevel * 0.9);
    this.state.safetyLevel = Math.max(40, this.state.safetyLevel * 0.9);
    this.state.educationLevel = Math.max(40, this.state.educationLevel * 0.9);
    this.state.medicalLevel = Math.max(40, this.state.medicalLevel * 0.9);
    this.state.tourismLevel = Math.max(0, this.state.tourismLevel * 0.95);
    this.state.internationalLevel = Math.max(0, this.state.internationalLevel * 0.95);

    // 供給率計算
    this.calculateSupplyRates();

    // 施設の影響を集計
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        
        // 警察署の効果
        if (tile === TileType.POLICE) {
          this.applyEffectRadius(x, y, 30, 'security', 5);
        }
        // 消防署の効果
        if (tile === TileType.FIRE_STATION) {
          this.applyEffectRadius(x, y, 30, 'safety', 5);
        }
        // 学校の効果
        if (tile === TileType.SCHOOL) {
          this.applyEffectRadius(x, y, 25, 'education', 3);
        }
        // 病院の効果
        if (tile === TileType.HOSPITAL) {
          this.applyEffectRadius(x, y, 25, 'medical', 4);
        }
        // スタジアムの効果
        if (tile === TileType.LANDMARK_STADIUM) {
          this.applyEffectRadius(x, y, 40, 'tourism', 5);
        }
        // 空港の効果
        if (tile === TileType.LANDMARK_AIRPORT) {
          this.applyEffectRadius(x, y, 50, 'tourism', 3);
          this.applyEffectRadius(x, y, 50, 'international', 5);
        }
      }
    }

    // パラメータを100で上限
    this.state.securityLevel = Math.min(100, this.state.securityLevel);
    this.state.safetyLevel = Math.min(100, this.state.safetyLevel);
    this.state.educationLevel = Math.min(100, this.state.educationLevel);
    this.state.medicalLevel = Math.min(100, this.state.medicalLevel);
    this.state.tourismLevel = Math.min(100, this.state.tourismLevel);
    this.state.internationalLevel = Math.min(100, this.state.internationalLevel);

    // シナジー効果の計算
    this.applySynergyEffects();

    // 需要計算
    this.calculateDemands();

    // 人口に基づいてインフラスケーリングを適用
    this.applyPopulationScaling();
  }

  // 半径内に効果を適用
  private applyEffectRadius(centerX: number, centerY: number, radius: number, effectType: string, value: number): void {
    for (let y = Math.max(0, centerY - radius); y < Math.min(this.gridSize, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x < Math.min(this.gridSize, centerX + radius); x++) {
        const dist = Math.abs(x - centerX) + Math.abs(y - centerY); // マンハッタン距離
        if (dist <= radius) {
          const factor = 1 - (dist / radius) * 0.3; // 距離に応じて効果を減衰
          switch (effectType) {
            case 'security':
              this.state.securityLevel += value * factor;
              break;
            case 'safety':
              this.state.safetyLevel += value * factor;
              break;
            case 'education':
              this.state.educationLevel += value * factor;
              break;
            case 'medical':
              this.state.medicalLevel += value * factor;
              break;
            case 'tourism':
              this.state.tourismLevel += value * factor;
              break;
            case 'international':
              this.state.internationalLevel += value * factor;
              break;
          }
        }
      }
    }
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
  private calculateDemands(): void {
    let residentialCount = 0;
    let commercialCount = 0;
    let industrialCount = 0;
    let totalBuildable = 0;

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        
        // インフラ以外の建物のみカウント
        if (tile !== TileType.EMPTY && tile < 0) continue;
        if (tile !== TileType.EMPTY && tile > 0) {
          totalBuildable++;
          
          if (tile >= TileType.RESIDENTIAL_L1 && tile <= TileType.RESIDENTIAL_L4) {
            residentialCount++;
          } else if (tile >= TileType.COMMERCIAL_L1 && tile <= TileType.COMMERCIAL_L4) {
            commercialCount++;
          } else if (tile >= TileType.INDUSTRIAL_L1 && tile <= TileType.INDUSTRIAL_L4) {
            industrialCount++;
          }
        }
      }
    }

    // 占有率を計算（総建設可能タイル数に対する割合）
    const maxTiles = this.gridSize * this.gridSize;
    const residentialOccupancy = totalBuildable > 0 ? (residentialCount / maxTiles) * 100 : 0;
    const commercialOccupancy = totalBuildable > 0 ? (commercialCount / maxTiles) * 100 : 0;
    const industrialOccupancy = totalBuildable > 0 ? (industrialCount / maxTiles) * 100 : 0;

    // 需要 = 100% - 占有率 （占有率が低いほど需要が高い）
    let residentialDemand = Math.max(0, 100 - residentialOccupancy * 2); // x2 で需要をスケール
    let commercialDemand = Math.max(0, 100 - commercialOccupancy * 2);
    let industrialDemand = Math.max(0, 100 - industrialOccupancy * 2);

    // 人口に応じた調整
    if (this.state.population > 0) {
      const populationRatio = this.state.population / 50000; // スケーリング基準
      residentialDemand = Math.min(100, residentialDemand * (0.5 + populationRatio * 0.5));
      commercialDemand = Math.min(100, commercialDemand * (0.2 + populationRatio * 0.8));
      industrialDemand = Math.min(100, industrialDemand * (0.2 + populationRatio * 0.8));
    }

    this.state.residentialDemand = Math.round(residentialDemand);
    this.state.commercialDemand = Math.round(commercialDemand);
    this.state.industrialDemand = Math.round(industrialDemand);
  }

  // シナジー効果の計算
  private applySynergyEffects(): void {
    // 施設の位置を取得
    const facilities = { police: [], school: [], hospital: [], station: [] };

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile === TileType.POLICE) facilities.police.push({ x, y });
        if (tile === TileType.SCHOOL) facilities.school.push({ x, y });
        if (tile === TileType.HOSPITAL) facilities.hospital.push({ x, y });
        if (tile === TileType.STATION) facilities.station.push({ x, y });
      }
    }

    // シナジー1: 警察+学校（15マス以内）→ securityLevel +10, educationLevel +10
    for (const police of facilities.police) {
      for (const school of facilities.school) {
        const dist = Math.abs(police.x - school.x) + Math.abs(police.y - school.y);
        if (dist <= 15) {
          this.state.securityLevel = Math.min(100, this.state.securityLevel + 10);
          this.state.educationLevel = Math.min(100, this.state.educationLevel + 10);
        }
      }
    }

    // シナジー2: 学校+病院（15マス以内）→ educationLevel +5, medicalLevel +5
    for (const school of facilities.school) {
      for (const hospital of facilities.hospital) {
        const dist = Math.abs(school.x - hospital.x) + Math.abs(school.y - hospital.y);
        if (dist <= 15) {
          this.state.educationLevel = Math.min(100, this.state.educationLevel + 5);
          this.state.medicalLevel = Math.min(100, this.state.medicalLevel + 5);
        }
      }
    }

    // シナジー3: 駅+学校+警察（20マス以内、3つ全て必要）
    // → 商業成長ボーナス（成長ペナルティを20%軽減）
    for (const station of facilities.station) {
      for (const school of facilities.school) {
        const schoolDist = Math.abs(station.x - school.x) + Math.abs(station.y - school.y);
        if (schoolDist <= 20) {
          for (const police of facilities.police) {
            const policeDist = Math.abs(station.x - police.x) + Math.abs(station.y - police.y);
            if (policeDist <= 20) {
              // 3つが揃ったので、成長ボーナスを適用（商業成長+20%）
              // growthPenalty に 1.2x を掛ける（ペナルティ軽減）
              // ただし、元々 calculatePenalties() で成長ペナルティが適用されるので
              // ここでは educationLevel を追加で上昇させることで間接的に対応
              this.state.educationLevel = Math.min(100, this.state.educationLevel + 8);
              // console.log('✨ Triple synergy (Station+School+Police) activated!');
            }
          }
        }
      }
    }
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
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          const tile = this.state.map[y][x];
          const dist = Math.abs(x - stadium.x) + Math.abs(y - stadium.y);
          
          // スタジアムから40マス以内の商業地
          if (dist <= 40 && tile >= TileType.COMMERCIAL_L1 && tile <= TileType.COMMERCIAL_L4) {
            const level = tile - TileType.COMMERCIAL_L1 + 1; // 1～4
            const bonusValues = [500, 1166, 2333, 3000];
            bonus += bonusValues[level - 1];
          }
        }
      }
    }

    // 空港周辺の商業地
    for (const airport of airports) {
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          const tile = this.state.map[y][x];
          const dist = Math.abs(x - airport.x) + Math.abs(y - airport.y);
          
          // 空港から50マス以内の商業地
          if (dist <= 50 && tile >= TileType.COMMERCIAL_L1 && tile <= TileType.COMMERCIAL_L4) {
            const level = tile - TileType.COMMERCIAL_L1 + 1; // 1～4
            const bonusValues = [1000, 2333, 3666, 5000];
            bonus += bonusValues[level - 1];
          }
        }
      }
    }

    return bonus;
  }

  // 人口に基づくインフラスケーリング
  private applyPopulationScaling(): void {
    // インフラ数をカウント
    let policeCount = 0;
    let fireCount = 0;
    let schoolCount = 0;
    let hospitalCount = 0;
    let powerCount = 0;
    let waterCount = 0;

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.state.map[y][x];
        if (tile === TileType.POLICE) policeCount++;
        if (tile === TileType.FIRE_STATION) fireCount++;
        if (tile === TileType.SCHOOL) schoolCount++;
        if (tile === TileType.HOSPITAL) hospitalCount++;
        if (tile === TileType.POWER_PLANT) powerCount++;
        if (tile === TileType.WATER_TREATMENT) waterCount++;
      }
    }

    const population = this.state.population;

    // 必要インフラ数を計算
    const requiredPolice = Math.max(INFRASTRUCTURE_REQUIREMENTS.police.base, Math.ceil(population / INFRASTRUCTURE_REQUIREMENTS.police.populationPerUnit));
    const requiredFire = Math.max(INFRASTRUCTURE_REQUIREMENTS.fire_station.base, Math.ceil(population / INFRASTRUCTURE_REQUIREMENTS.fire_station.populationPerUnit));
    const requiredSchool = Math.max(INFRASTRUCTURE_REQUIREMENTS.school.base, Math.ceil(population / INFRASTRUCTURE_REQUIREMENTS.school.populationPerUnit));
    const requiredHospital = Math.max(INFRASTRUCTURE_REQUIREMENTS.hospital.base, Math.ceil(population / INFRASTRUCTURE_REQUIREMENTS.hospital.populationPerUnit));
    const requiredPower = Math.max(INFRASTRUCTURE_REQUIREMENTS.power_plant.base, Math.ceil(population / INFRASTRUCTURE_REQUIREMENTS.power_plant.populationPerUnit));
    const requiredWater = Math.max(INFRASTRUCTURE_REQUIREMENTS.water_treatment.base, Math.ceil(population / INFRASTRUCTURE_REQUIREMENTS.water_treatment.populationPerUnit));

    // 人口に対するインフラ不足率を計算
    const policeDeficit = Math.max(0, 1 - (policeCount / requiredPolice));
    const fireDeficit = Math.max(0, 1 - (fireCount / requiredFire));
    const schoolDeficit = Math.max(0, 1 - (schoolCount / requiredSchool));
    const hospitalDeficit = Math.max(0, 1 - (hospitalCount / requiredHospital));
    const powerDeficit = Math.max(0, 1 - (powerCount / requiredPower));
    const waterDeficit = Math.max(0, 1 - (waterCount / requiredWater));

    // パラメータを不足率に応じて減衰
    this.state.securityLevel *= (1 - policeDeficit * 0.5);    // 不足で最大50%低下
    this.state.safetyLevel *= (1 - fireDeficit * 0.5);
    this.state.educationLevel *= (1 - schoolDeficit * 0.5);
    this.state.medicalLevel *= (1 - hospitalDeficit * 0.5);
    this.state.powerSupplyRate *= (1 - powerDeficit * 0.3);   // 電力供給率低下
    this.state.waterSupplyRate *= (1 - waterDeficit * 0.3);
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
      
      // 給水不足で病気発生倍率が3倍
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if (!this.state.waterGrid[y][x] && this.state.diseaseMap[y][x] > 0) {
            this.state.diseaseMap[y][x] = Math.min(10, this.state.diseaseMap[y][x] * 1.2);
          }
        }
      }
    }

    // 治安度不足ペナルティ（住宅成長）
    if (this.state.securityLevel < 40) {
      const deficit = (40 - this.state.securityLevel) / 40;
      growthPenalty *= Math.max(0.5, 1 - deficit * 0.5); // 最大50%低下
    }

    // 安全度不足ペナルティ（火災増加）
    if (this.state.safetyLevel < 40) {
      const deficit = (40 - this.state.safetyLevel) / 40;
      // 火災発生確率を2倍に
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if (this.state.fireMap[y][x] > 0) {
            this.state.fireMap[y][x] = Math.min(10, this.state.fireMap[y][x] * 1.2);
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
      // 病気発生倍率が2倍
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if (this.state.diseaseMap[y][x] > 0) {
            this.state.diseaseMap[y][x] = Math.min(10, this.state.diseaseMap[y][x] * 1.15);
          }
        }
      }
      // 人口流出（快適度低下）
      this.state.comfort *= Math.max(0.5, 1 - deficit * 0.5);
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

    // 5. 医療度による快適度調整
    let medicalBonus = 0;
    if (this.state.medicalLevel >= 70) {
      medicalBonus = 3;
    } else if (this.state.medicalLevel <= 30) {
      medicalBonus = -5;
    }

    // 総合スコア
    score = (greenScore + transportScore + densityScore + fundScore) / 4 + medicalBonus;
    this.state.comfort = Math.round(Math.max(0, Math.min(100, score)));
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
      selectedInfrastructure: 'station',
      selectedLandmark: 'stadium',
      gameSpeed: 1,
      powerGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      waterGrid: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(false)),
      fireMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      diseaseMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      crimeMap: Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0)),
      securityLevel: INITIAL_PARAMETERS.securityLevel,
      safetyLevel: INITIAL_PARAMETERS.safetyLevel,
      educationLevel: INITIAL_PARAMETERS.educationLevel,
      medicalLevel: INITIAL_PARAMETERS.medicalLevel,
      tourismLevel: INITIAL_PARAMETERS.tourismLevel,
      internationalLevel: INITIAL_PARAMETERS.internationalLevel,
      powerSupplyRate: INITIAL_PARAMETERS.powerSupplyRate,
      waterSupplyRate: INITIAL_PARAMETERS.waterSupplyRate,
      residentialDemand: 50,
      commercialDemand: 50,
      industrialDemand: 50,
      showDemandMeters: false,
      growthPenalty: 1.0,
      revenuePenalty: 1.0,
      settings: this.state.settings,
    };
    const center = this.gridSize / 2;
    this.state.map[Math.floor(center)][Math.floor(center)] = TileType.STATION;
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
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
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
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
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
    const pollutedCells = this.state.pollutionMap.flat().filter(p => p > 0).length;
    this.state.pollutionLevel = Math.round((pollutedCells / totalCells) * 100);

    // 汚染が高いと快適度低下（基準を緩和）
    if (this.state.pollutionLevel > 50) {
      this.state.comfort *= 0.98;
    }
    if (this.state.pollutionLevel > 80) {
      this.state.comfort *= 0.95;
    }
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

          // スラム化条件：高汚染＋低治安＋近くのスラム
          const slumChance = 0.01 * (localPollution / 100) * (1 - localSecurity / 100) * (1 + localSlum / 10) * this.state.gameSpeed;
          if (Math.random() < slumChance) {
            this.state.slumMap[y][x] = Math.min(10, this.state.slumMap[y][x] + 1);
          }

          // スラム化が進むとレベルダウン
          if (this.state.slumMap[y][x] > 8) {
            // 住宅レベルを1段階低下
            if (tile > TileType.RESIDENTIAL_L1) {
              this.state.map[y][x] = tile - 1;
            }
            this.state.slumMap[y][x] = 0;
          }

          // スラム化度低下
          this.state.slumMap[y][x] = Math.max(0, this.state.slumMap[y][x] - 0.5);
        }
      }
    }

    // 全体スラム化率を計算
    const slummedCells = this.state.slumMap.flat().filter(s => s > 0).length;
    this.state.slumRate = Math.round((slummedCells / (this.gridSize * this.gridSize)) * 100);

    // スラム化が高いと快適度低下・人口流出
    if (this.state.slumRate > 10) {
      this.state.comfort *= 0.95;
      this.state.population *= 0.98;
    }
    if (this.state.slumRate > 20) {
      this.state.comfort *= 0.90;
      this.state.population *= 0.95;
    }
  }

  private updateFires(): void {
    // 難易度に応じた火災発生率を調整
    const fireChance = 0.0002 * this.state.gameSpeed * this.disasterRateMultiplier;
    const sampleRate = Math.max(1, Math.floor(this.gridSize / 64));
    
    for (let y = 0; y < this.gridSize; y += sampleRate) {
      for (let x = 0; x < this.gridSize; x += sampleRate) {
        if (this.state.map[y][x] !== TileType.EMPTY && Math.random() < fireChance) {
          this.state.fireMap[y][x] = Math.min(10, this.state.fireMap[y][x] + 2);
        }
      }
    }

    // 火災の波及（アクティブな火災のみ処理）
    const newFireMap = this.state.fireMap.map(row => [...row]);
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.fireMap[y][x] > 0) {
          // 隣接タイルに波及
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          dirs.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
              if (this.state.map[ny][nx] !== TileType.EMPTY && Math.random() < 0.01) { // 0.02 → 0.01
                newFireMap[ny][nx] = Math.min(10, newFireMap[ny][nx] + 1);
              }
            }
          });

          // 消防署による消火（範囲と成功率を向上）
          let fireExtinguished = false;
          for (let yy = -15; yy <= 15; yy++) {
            if (fireExtinguished) break;
            for (let xx = -15; xx <= 15; xx++) {
              const nx = x + xx;
              const ny = y + yy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                if (this.state.map[ny][nx] === TileType.FIRE_STATION) {
                  if (Math.random() < 0.9) fireExtinguished = true; // 0.8 → 0.9
                  break;
                }
              }
            }
          }

          if (fireExtinguished) {
            newFireMap[y][x] = Math.max(0, newFireMap[y][x] - 5); // -4 → -5
          } else {
            newFireMap[y][x] = Math.max(0, newFireMap[y][x] - 1);
          }

          // 火災が蔓延したら建物を破壊
          if (newFireMap[y][x] >= 10) {
            this.state.map[y][x] = TileType.EMPTY;
            this.state.money -= 500;
          }
        }
      }
    }
    this.state.fireMap = newFireMap;
  }

  private updateDiseases(): void {
    // 難易度に応じた病気発生率を調整
    const sampleRate = Math.max(1, Math.floor(this.gridSize / 64));
    
    for (let y = 0; y < this.gridSize; y += sampleRate) {
      for (let x = 0; x < this.gridSize; x += sampleRate) {
        const density = this.getLocalDensity(x, y);
        const diseaseChance = 0.01 * (1 + density / 10) * this.state.gameSpeed * this.disasterRateMultiplier;
        if (this.state.map[y][x] !== TileType.EMPTY && Math.random() < diseaseChance) {
          this.state.diseaseMap[y][x] = Math.min(10, this.state.diseaseMap[y][x] + 5);
        }
      }
    }

    // 病気の波及（アクティブな病気のみ処理）
    const newDiseaseMap = this.state.diseaseMap.map(row => [...row]);
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.state.diseaseMap[y][x] > 0) {
          // 隣接タイル3マスに波及
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                if (this.state.map[ny][nx] !== TileType.EMPTY && Math.random() < 0.2) {
                  newDiseaseMap[ny][nx] = Math.min(10, newDiseaseMap[ny][nx] + 1);
                }
              }
            }
          }

          // 病院による治癒（近い病院だけチェック）
          let diseaseHealed = false;
          for (let yy = -10; yy <= 10; yy++) {
            if (diseaseHealed) break;
            for (let xx = -10; xx <= 10; xx++) {
              const nx = x + xx;
              const ny = y + yy;
              if (nx >= 0 && ny >= 0 && nx < this.gridSize && ny < this.gridSize) {
                if (this.state.map[ny][nx] === TileType.HOSPITAL) {
                  if (Math.random() < 0.7) diseaseHealed = true;
                  break;
                }
              }
            }
          }

          if (diseaseHealed) {
            newDiseaseMap[y][x] = Math.max(0, newDiseaseMap[y][x] - 3);
          } else {
            newDiseaseMap[y][x] = Math.max(0, newDiseaseMap[y][x] - 1);
          }

          // 病気が蔓延したら人口減少
          if (newDiseaseMap[y][x] >= 10) {
            const popLoss = POPULATION_TABLE[this.state.map[y][x]] || 0;
            this.state.population = Math.max(0, this.state.population - popLoss);
            this.state.money -= 500;
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
