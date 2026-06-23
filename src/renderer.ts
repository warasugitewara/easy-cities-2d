import { getTileSize, TileType } from "./constants";
import { GameEngine } from "./engine";

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

  private static readonly QUANT_LEVELS = 32;
  private readonly fireColors: string[];
  private readonly diseaseColors: string[];
  private readonly pollutionColors: string[];
  private readonly slumColors: string[];

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.engine = engine;
    this.gridSize = engine.state.gridSize;
    this.tileSize = getTileSize();
    this.mapSize = this.gridSize * this.tileSize;

    this.fireColors = this.buildOverlayColors(255, 50, 50, 0.3, 0.5);
    this.diseaseColors = this.buildOverlayColors(255, 255, 50, 0.2, 0.4);
    this.pollutionColors = this.buildOverlayColors(150, 100, 50, 0.2, 0.4);
    this.slumColors = this.buildOverlayColors(100, 50, 100, 0.2, 0.4);
  }

  // 量子化されたオーバーレイ用 rgba 文字列を事前生成する
  private buildOverlayColors(
    r: number,
    g: number,
    b: number,
    baseAlpha: number,
    alphaScale: number,
  ): string[] {
    const colors: string[] = [];
    for (let q = 0; q <= Renderer.QUANT_LEVELS; q++) {
      const alpha = baseAlpha + (q / Renderer.QUANT_LEVELS) * alphaScale;
      colors.push(`rgba(${r}, ${g}, ${b}, ${alpha})`);
    }
    return colors;
  }

  draw(): void {
    const map = this.engine.state.map;
    const fireMap = this.engine.state.fireMap;
    const diseaseMap = this.engine.state.diseaseMap;
    const pollutionMap = this.engine.state.pollutionMap;
    const slumMap = this.engine.state.slumMap;
    const gridSize = this.engine.state.gridSize;

    // カメラトランスフォーム適用
    this.ctx.save();
    this.ctx.translate(this.cameraOffsetX, this.cameraOffsetY);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);

    // ビューポートカリング: 画面内に見えているタイルの範囲のみ描画
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const worldMinX = -this.cameraOffsetX / this.zoomLevel;
    const worldMinY = -this.cameraOffsetY / this.zoomLevel;
    const worldMaxX = (canvasW - this.cameraOffsetX) / this.zoomLevel;
    const worldMaxY = (canvasH - this.cameraOffsetY) / this.zoomLevel;

    const startX = Math.max(0, Math.floor(worldMinX / this.tileSize));
    const startY = Math.max(0, Math.floor(worldMinY / this.tileSize));
    const endX = Math.min(gridSize, Math.ceil(worldMaxX / this.tileSize));
    const endY = Math.min(gridSize, Math.ceil(worldMaxY / this.tileSize));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map[y][x];
        const color = this.getTileColor(tile);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);

        // 火災のビジュアル表示（赤でハイライト）
        if (fireMap[y][x] > 0) {
          const intensity = Math.min(1, fireMap[y][x] / 10);
          const q = Math.round(intensity * Renderer.QUANT_LEVELS);
          this.ctx.fillStyle = this.fireColors[q];
          this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }

        // 病気のビジュアル表示（黄でハイライト）
        if (diseaseMap[y][x] > 0) {
          const intensity = Math.min(1, diseaseMap[y][x] / 10);
          const q = Math.round(intensity * Renderer.QUANT_LEVELS);
          this.ctx.fillStyle = this.diseaseColors[q];
          this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }

        // 公害のビジュアル表示（茶色でハイライト）
        if (pollutionMap[y][x] > 0) {
          const intensity = Math.min(1, pollutionMap[y][x] / 100);
          const q = Math.round(intensity * Renderer.QUANT_LEVELS);
          this.ctx.fillStyle = this.pollutionColors[q];
          this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }

        // スラム化のビジュアル表示（暗い紫でハイライト）
        if (slumMap[y][x] > 0) {
          const intensity = Math.min(1, slumMap[y][x] / 10);
          const q = Math.round(intensity * Renderer.QUANT_LEVELS);
          this.ctx.fillStyle = this.slumColors[q];
          this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }
      }
    }

    // グリッド線（可視範囲をまとめて1パスで描画）
    this.ctx.strokeStyle = "#1a1a1a";
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    for (let x = startX; x <= endX; x++) {
      const px = x * this.tileSize;
      this.ctx.moveTo(px, startY * this.tileSize);
      this.ctx.lineTo(px, endY * this.tileSize);
    }
    for (let y = startY; y <= endY; y++) {
      const py = y * this.tileSize;
      this.ctx.moveTo(startX * this.tileSize, py);
      this.ctx.lineTo(endX * this.tileSize, py);
    }
    this.ctx.stroke();

    this.ctx.restore();
  }

  // スクリーン座標をワールド座標に変換
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const x = (screenX - this.cameraOffsetX) / this.zoomLevel;
    const y = (screenY - this.cameraOffsetY) / this.zoomLevel;
    return { x, y };
  }

  // ワールド座標をスクリーン座標に変換
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const x = worldX * this.zoomLevel + this.cameraOffsetX;
    const y = worldY * this.zoomLevel + this.cameraOffsetY;
    return { x, y };
  }

  private getTileColor(tile: number): string {
    switch (tile) {
      case TileType.EMPTY:
        return "#0a0a0a";
      case TileType.ROAD:
        return "#444444"; // より濃いグレー（視認性向上）
      case TileType.STATION:
        return "#ffaa00"; // オレンジ（鉄道）
      case TileType.PARK:
        return "#22dd22"; // 明るい緑
      case TileType.POLICE:
        return "#0066ff"; // 青（警察）
      case TileType.FIRE_STATION:
        return "#ff3333"; // 赤（消防）
      case TileType.HOSPITAL:
        return "#ff69b4"; // ホットピンク（医療）
      case TileType.SCHOOL:
        return "#ffbb33"; // オレンジ黄（教育）
      case TileType.POWER_PLANT:
        return "#ffff00"; // イエロー（電力）
      case TileType.WATER_TREATMENT:
        return "#00ffff"; // シアン（水道）
      // 住宅（青系）
      case TileType.RESIDENTIAL_L1:
        return "#5599ff"; // 薄い青
      case TileType.RESIDENTIAL_L2:
        return "#3366ff"; // 青
      case TileType.RESIDENTIAL_L3:
        return "#1144cc"; // 濃い青
      case TileType.RESIDENTIAL_L4:
        return "#002299"; // 深い青
      // 商業（緑系）
      case TileType.COMMERCIAL_L1:
        return "#99ff66"; // 薄い緑黄
      case TileType.COMMERCIAL_L2:
        return "#66dd00"; // 緑黄
      case TileType.COMMERCIAL_L3:
        return "#44bb00"; // 濃い緑黄
      case TileType.COMMERCIAL_L4:
        return "#228800"; // 深い緑黄
      // 工業（オレンジ系）
      case TileType.INDUSTRIAL_L1:
        return "#ffcc66"; // 薄いオレンジ
      case TileType.INDUSTRIAL_L2:
        return "#ffbb33"; // オレンジ
      case TileType.INDUSTRIAL_L3:
        return "#ff9900"; // 濃いオレンジ
      case TileType.INDUSTRIAL_L4:
        return "#dd6600"; // 深いオレンジ
      // ランドマーク
      case TileType.LANDMARK_STADIUM:
        return "#ff1493"; // 深いピンク（スタジアム）
      case TileType.LANDMARK_AIRPORT:
        return "#9932cc"; // 暗い紫（空港）
      default:
        return "#0a0a0a";
    }
  }
}
