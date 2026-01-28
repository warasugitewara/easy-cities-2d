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
    
    // DPR対応：高解像度ディスプレイでの描画品質向上
    const dpr = window.devicePixelRatio || 1;
    this.ctx.scale(dpr, dpr);
  }

  draw(): void {
    const map = this.engine.state.map;
    const fireMap = this.engine.state.fireMap;
    const diseaseMap = this.engine.state.diseaseMap;
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

        // 火災のビジュアル表示（赤でハイライト）
        if (fireMap[y][x] > 0) {
          const intensity = Math.min(1, fireMap[y][x] / 10);
          this.ctx.fillStyle = `rgba(255, 50, 50, ${0.3 + intensity * 0.5})`;
          this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }

        // 病気のビジュアル表示（黄でハイライト）
        if (diseaseMap[y][x] > 0) {
          const intensity = Math.min(1, diseaseMap[y][x] / 10);
          this.ctx.fillStyle = `rgba(255, 255, 50, ${0.2 + intensity * 0.4})`;
          this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }

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
        return '#444444';      // より濃いグレー（視認性向上）
      case TileType.STATION:
        return '#ffaa00';      // オレンジ（鉄道）
      case TileType.PARK:
        return '#22dd22';      // 明るい緑
      case TileType.POLICE:
        return '#0066ff';      // 青（警察）
      case TileType.FIRE_STATION:
        return '#ff3333';      // 赤（消防）
      case TileType.HOSPITAL:
        return '#ff69b4';      // ホットピンク（医療）
      case TileType.SCHOOL:
        return '#ffbb33';      // オレンジ黄（教育）
      case TileType.POWER_PLANT:
        return '#ffff00';      // イエロー（電力）
      case TileType.WATER_TREATMENT:
        return '#00ffff';      // シアン（水道）
      // 住宅（青系）
      case TileType.RESIDENTIAL_L1:
        return '#5599ff';      // 薄い青
      case TileType.RESIDENTIAL_L2:
        return '#3366ff';      // 青
      case TileType.RESIDENTIAL_L3:
        return '#1144cc';      // 濃い青
      case TileType.RESIDENTIAL_L4:
        return '#002299';      // 深い青
      // 商業（緑系）
      case TileType.COMMERCIAL_L1:
        return '#99ff66';      // 薄い緑黄
      case TileType.COMMERCIAL_L2:
        return '#66dd00';      // 緑黄
      case TileType.COMMERCIAL_L3:
        return '#44bb00';      // 濃い緑黄
      case TileType.COMMERCIAL_L4:
        return '#228800';      // 深い緑黄
      // 工業（オレンジ系）
      case TileType.INDUSTRIAL_L1:
        return '#ffcc66';      // 薄いオレンジ
      case TileType.INDUSTRIAL_L2:
        return '#ffbb33';      // オレンジ
      case TileType.INDUSTRIAL_L3:
        return '#ff9900';      // 濃いオレンジ
      case TileType.INDUSTRIAL_L4:
        return '#dd6600';      // 深いオレンジ
      // ランドマーク
      case TileType.LANDMARK_STADIUM:
        return '#ff1493';      // 深いピンク（スタジアム）
      case TileType.LANDMARK_AIRPORT:
        return '#9932cc';      // 暗い紫（空港）
      default:
        return '#0a0a0a';
    }
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // DPR を考慮した座標変換
    const dpr = window.devicePixelRatio || 1;
    const x = (screenX / dpr - this.cameraOffsetX) / this.zoomLevel;
    const y = (screenY / dpr - this.cameraOffsetY) / this.zoomLevel;
    return { x, y };
  }
}
