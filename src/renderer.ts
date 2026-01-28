import { GRID_SIZE, TILE_SIZE, CANVAS_SIZE, TileType } from './constants';
import { GameEngine } from './engine';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;
  }

  draw(): void {
    const map = this.engine.state.map;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const tile = map[y][x];
        const color = this.getTileColor(tile);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // グリッド線
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
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
      case TileType.BUILDING_L1:
        return '#2e8b57';
      case TileType.BUILDING_L2:
        return '#9acd32';
      case TileType.BUILDING_L3:
        return '#ffa500';
      case TileType.BUILDING_L4:
        return '#cc3333';
      default:
        return '#0a0a0a';
    }
  }
}
