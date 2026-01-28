import { getTileSize, TileType, MAP_SIZES } from './constants';
import { GameEngine } from './engine';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;
  public cameraOffsetX: number = 0;
  public cameraOffsetY: number = 0;
  public zoomLevel: number = 1;
  private gridSize: number;
  private tileSize: number;
  private mapSize: number; // ピクセル単位のマップサイズ

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;
    this.gridSize = engine.state.gridSize;
    this.tileSize = getTileSize();
    this.mapSize = this.gridSize * this.tileSize;
  }

  draw(): void {
    const map = this.engine.state.map;
    const gridSize = this.engine.state.gridSize;

    // カメラトランスフォーム適用
    this.ctx.save();
    this.ctx.translate(this.cameraOffsetX, this.cameraOffsetY);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = map[y][x];
        const color = this.getTileColor(tile);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);

        // グリッド線
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
      }
    }

    this.ctx.restore();
  }

  // ワールド座標をスクリーン座標に変換
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const x = (screenX - this.cameraOffsetX) / this.zoomLevel;
    const y = (screenY - this.cameraOffsetY) / this.zoomLevel;
    return { x, y };
  }

  // スクリーン座標をワールド座標に変換
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const x = worldX * this.zoomLevel + this.cameraOffsetX;
    const y = worldY * this.zoomLevel + this.cameraOffsetY;
    return { x, y };
  }

  private getTileColor(tile: number): string {
    switch (tile) {
      case TileType.EMPTY:
        return '#0a0a0a';
      case TileType.ROAD:
        return '#666666';
      case TileType.STATION:
        return '#00bfff';
      case TileType.PARK:
        return '#228b22';
      case TileType.POLICE:
        return '#ff4444';
      case TileType.FIRE_STATION:
        return '#ff6600';
      case TileType.HOSPITAL:
        return '#ff1493';
      case TileType.SCHOOL:
        return '#4169e1';
      case TileType.POWER_PLANT:
        return '#ffff00';
      case TileType.WATER_TREATMENT:
        return '#1e90ff';
      // 住宅
      case TileType.RESIDENTIAL_L1:
        return '#4a90e2';
      case TileType.RESIDENTIAL_L2:
        return '#357abd';
      case TileType.RESIDENTIAL_L3:
        return '#1e5a96';
      case TileType.RESIDENTIAL_L4:
        return '#0d3d6f';
      // 商業
      case TileType.COMMERCIAL_L1:
        return '#7ed321';
      case TileType.COMMERCIAL_L2:
        return '#5ca319';
      case TileType.COMMERCIAL_L3:
        return '#3d7511';
      case TileType.COMMERCIAL_L4:
        return '#1f4709';
      // 工業
      case TileType.INDUSTRIAL_L1:
        return '#f5a623';
      case TileType.INDUSTRIAL_L2:
        return '#c17f1a';
      case TileType.INDUSTRIAL_L3:
        return '#8d5a11';
      case TileType.INDUSTRIAL_L4:
        return '#593508';
      // ランドマーク
      case TileType.LANDMARK_STADIUM:
        return '#ff6b6b';
      case TileType.LANDMARK_AIRPORT:
        return '#9b59b6';
      default:
        return '#0a0a0a';
    }
  }
}
