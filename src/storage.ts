import type { GameState, GameSettings } from "./engine";
import type { BuildingCategory, MapSize } from "./constants";
import { INITIAL_PARAMETERS } from "./constants";

const STORAGE_KEY_PREFIX = "easy-cities-2d-";
const SAVE_SLOTS = 3;

/** セーブデータのフォーマットバージョン。破壊的変更時にインクリメントする。 */
export const SAVE_FORMAT_VERSION = 2;

/**
 * 保存用のスリム化された GameState 表現。
 * - powerGrid/waterGrid/lastReport は除外する（毎 monthlyUpdate() の updateInfrastructure() /
 *   収支計算で再計算される派生値のため、保存する意味がない）。
 * - map と状態グリッド(fireMap/diseaseMap/pollutionMap/slumMap)は1次元配列(行優先)に変換する
 *   （ネストした number[][] よりJSONサイズが小さい）。
 * - 状態グリッドは全要素0であれば null として保存する（読込時にゼロ埋めで再構築する）。
 */
export interface SerializedGameState {
  version: number;
  gridSize: number;
  map: number[];
  fireMap: number[] | null;
  diseaseMap: number[] | null;
  pollutionMap: number[] | null;
  slumMap: number[] | null;
  population: number;
  money: number;
  comfort: number;
  month: number;
  paused: boolean;
  buildMode: BuildingCategory;
  settings: GameSettings;
  selectedInfrastructure: string;
  selectedLandmark: string;
  gameSpeed: number;
  securityLevel: number;
  safetyLevel: number;
  educationLevel: number;
  medicalLevel: number;
  tourismLevel: number;
  internationalLevel: number;
  powerSupplyRate: number;
  waterSupplyRate: number;
  pollutionLevel: number;
  slumRate: number;
  residentialDemand: number;
  commercialDemand: number;
  industrialDemand: number;
  showDemandMeters: boolean;
  growthPenalty: number;
  revenuePenalty: number;
  gameOver: boolean;
}

// --- 型ガード / バリデーションヘルパー ---

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

function isOneOf<T extends string>(v: unknown, options: readonly T[]): v is T {
  return typeof v === "string" && (options as readonly string[]).includes(v);
}

const DIFFICULTIES = ["easy", "normal", "hard"] as const;
const MAP_SIZE_KEYS: readonly MapSize[] = ["small", "medium", "large"];
const BUILD_MODES: readonly BuildingCategory[] = [
  "road",
  "residential",
  "commercial",
  "industrial",
  "infrastructure",
  "landmark",
  "demolish",
];

// --- グリッド変換ヘルパー（engine内部の number[][] 表現はそのまま。storageの入出力でのみ変換する）---

function flattenGrid(grid: number[][], gridSize: number): number[] {
  const flat: number[] = Array.from({ length: gridSize * gridSize }, () => 0);
  for (let y = 0; y < gridSize; y++) {
    const offset = y * gridSize;
    for (let x = 0; x < gridSize; x++) {
      flat[offset + x] = grid[y][x];
    }
  }
  return flat;
}

// 全要素0であれば null を返す（状態グリッドの圧縮用）
function flattenGridOrNull(grid: number[][], gridSize: number): number[] | null {
  const flat = flattenGrid(grid, gridSize);
  for (let i = 0; i < flat.length; i++) {
    if (flat[i] !== 0) return flat;
  }
  return null;
}

function unflattenGrid(flat: number[] | null, gridSize: number): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: number[] = Array.from({ length: gridSize }, () => 0);
    if (flat) {
      const offset = y * gridSize;
      for (let x = 0; x < gridSize; x++) {
        row[x] = flat[offset + x];
      }
    }
    grid.push(row);
  }
  return grid;
}

function makeFalseGrid(gridSize: number): boolean[][] {
  return Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => false));
}

// --- serialize ---

/** GameState → 保存用スリムオブジェクト（派生グリッドを除外し、map/状態グリッドをフラット化）。 */
export function serializeState(state: GameState): SerializedGameState {
  const { gridSize } = state;
  return {
    version: SAVE_FORMAT_VERSION,
    gridSize,
    map: flattenGrid(state.map, gridSize),
    fireMap: flattenGridOrNull(state.fireMap, gridSize),
    diseaseMap: flattenGridOrNull(state.diseaseMap, gridSize),
    pollutionMap: flattenGridOrNull(state.pollutionMap, gridSize),
    slumMap: flattenGridOrNull(state.slumMap, gridSize),
    population: state.population,
    money: state.money,
    comfort: state.comfort,
    month: state.month,
    paused: state.paused,
    buildMode: state.buildMode,
    settings: state.settings,
    selectedInfrastructure: state.selectedInfrastructure,
    selectedLandmark: state.selectedLandmark,
    gameSpeed: state.gameSpeed,
    securityLevel: state.securityLevel,
    safetyLevel: state.safetyLevel,
    educationLevel: state.educationLevel,
    medicalLevel: state.medicalLevel,
    tourismLevel: state.tourismLevel,
    internationalLevel: state.internationalLevel,
    powerSupplyRate: state.powerSupplyRate,
    waterSupplyRate: state.waterSupplyRate,
    pollutionLevel: state.pollutionLevel,
    slumRate: state.slumRate,
    residentialDemand: state.residentialDemand,
    commercialDemand: state.commercialDemand,
    industrialDemand: state.industrialDemand,
    showDemandMeters: state.showDemandMeters,
    growthPenalty: state.growthPenalty,
    revenuePenalty: state.revenuePenalty,
    gameOver: state.gameOver,
  };
}

// --- deserialize ---

// バリデーション失敗を deserializeState() の catch まで一気に巻き戻すための内部シグナル。
class StateValidationError extends Error {}
function fail(): never {
  throw new StateValidationError();
}

// 状態グリッド1つ分をパースする。未指定(null/undefined)ならゼロ埋め対象としてnullを返し、
// 値がある場合は number[] かつ要素数が area と一致することを要求する（不一致は読込失敗）。
function parseOptionalGrid(value: unknown, area: number): number[] | null {
  if (value === null || value === undefined) return null;
  if (!isNumberArray(value) || value.length !== area) fail();
  return value;
}

// settings は必須フィールド（オブジェクトとして存在しなければ読込失敗）だが、
// 中身の各設定値は欠損・型不正を許容し、新規ゲームと同じデフォルト値で補完する。
function normalizeSettings(raw: unknown): GameSettings {
  if (typeof raw !== "object" || raw === null) fail();
  const r = raw as Record<string, unknown>;

  const settings: GameSettings = {
    difficulty: isOneOf(r.difficulty, DIFFICULTIES) ? r.difficulty : "normal",
    mapSize: isOneOf(r.mapSize, MAP_SIZE_KEYS) ? r.mapSize : "medium",
    disastersEnabled: isBoolean(r.disastersEnabled) ? r.disastersEnabled : false,
    pollutionEnabled: isBoolean(r.pollutionEnabled) ? r.pollutionEnabled : false,
    slumEnabled: isBoolean(r.slumEnabled) ? r.slumEnabled : false,
  };
  if (isBoolean(r.sandbox)) settings.sandbox = r.sandbox;
  return settings;
}

function deserializeStateOrThrow(raw: unknown, expectedGridSize: number): GameState {
  if (typeof raw !== "object" || raw === null) fail();
  const r = raw as Record<string, unknown>;

  // 必須フィールド: gridSize。呼び出し側(engine)の現在のgridSizeと一致しない場合も読込失敗にする
  // （GameEngine は private gridSize をコンストラクタでのみ確定するため、異なるマップサイズの
  //  セーブを読み込むと state のグリッド形状と engine 内部の走査範囲がズレて壊れるのを防ぐ）。
  const gridSize = r.gridSize;
  if (!isPositiveInt(gridSize)) fail();
  if (gridSize !== expectedGridSize) fail();
  const area = gridSize * gridSize;

  // 必須フィールド: map（フラット配列、要素数が gridSize^2 と一致すること）
  const rawMap = r.map;
  if (!isNumberArray(rawMap) || rawMap.length !== area) fail();

  // 必須フィールド: money
  const rawMoney = r.money;
  if (!isFiniteNumber(rawMoney)) fail();

  // 必須フィールド: settings（存在は必須、中身は補完可）
  const settings = normalizeSettings(r.settings);

  // 状態グリッド: 欠損/nullはゼロ埋め、値があれば形状一致を要求（不一致は読込失敗）
  const fireMap = parseOptionalGrid(r.fireMap, area);
  const diseaseMap = parseOptionalGrid(r.diseaseMap, area);
  const pollutionMap = parseOptionalGrid(r.pollutionMap, area);
  const slumMap = parseOptionalGrid(r.slumMap, area);

  return {
    map: unflattenGrid(rawMap, gridSize),
    population: isFiniteNumber(r.population) ? r.population : 0,
    money: rawMoney,
    comfort: isFiniteNumber(r.comfort) ? r.comfort : 50,
    month: isFiniteNumber(r.month) ? r.month : 0,
    paused: isBoolean(r.paused) ? r.paused : false,
    buildMode: isOneOf(r.buildMode, BUILD_MODES) ? r.buildMode : "road",
    settings,
    gridSize,
    selectedInfrastructure:
      typeof r.selectedInfrastructure === "string" ? r.selectedInfrastructure : "station",
    selectedLandmark: typeof r.selectedLandmark === "string" ? r.selectedLandmark : "stadium",
    gameSpeed: isFiniteNumber(r.gameSpeed) ? r.gameSpeed : 1,
    // 派生グリッド: 保存されないため常にゼロ初期化で再構築する。
    // ロード/インポート成功後、呼び出し側(ui.ts)が engine.updateInfrastructure() を呼んで埋める。
    powerGrid: makeFalseGrid(gridSize),
    waterGrid: makeFalseGrid(gridSize),
    fireMap: unflattenGrid(fireMap, gridSize),
    diseaseMap: unflattenGrid(diseaseMap, gridSize),
    pollutionMap: unflattenGrid(pollutionMap, gridSize),
    slumMap: unflattenGrid(slumMap, gridSize),
    securityLevel: isFiniteNumber(r.securityLevel)
      ? r.securityLevel
      : INITIAL_PARAMETERS.securityLevel,
    safetyLevel: isFiniteNumber(r.safetyLevel) ? r.safetyLevel : INITIAL_PARAMETERS.safetyLevel,
    educationLevel: isFiniteNumber(r.educationLevel)
      ? r.educationLevel
      : INITIAL_PARAMETERS.educationLevel,
    medicalLevel: isFiniteNumber(r.medicalLevel) ? r.medicalLevel : INITIAL_PARAMETERS.medicalLevel,
    tourismLevel: isFiniteNumber(r.tourismLevel) ? r.tourismLevel : INITIAL_PARAMETERS.tourismLevel,
    internationalLevel: isFiniteNumber(r.internationalLevel)
      ? r.internationalLevel
      : INITIAL_PARAMETERS.internationalLevel,
    powerSupplyRate: isFiniteNumber(r.powerSupplyRate)
      ? r.powerSupplyRate
      : INITIAL_PARAMETERS.powerSupplyRate,
    waterSupplyRate: isFiniteNumber(r.waterSupplyRate)
      ? r.waterSupplyRate
      : INITIAL_PARAMETERS.waterSupplyRate,
    pollutionLevel: isFiniteNumber(r.pollutionLevel) ? r.pollutionLevel : 0,
    slumRate: isFiniteNumber(r.slumRate) ? r.slumRate : 0,
    residentialDemand: isFiniteNumber(r.residentialDemand) ? r.residentialDemand : 50,
    commercialDemand: isFiniteNumber(r.commercialDemand) ? r.commercialDemand : 50,
    industrialDemand: isFiniteNumber(r.industrialDemand) ? r.industrialDemand : 50,
    showDemandMeters: isBoolean(r.showDemandMeters) ? r.showDemandMeters : false,
    growthPenalty: isFiniteNumber(r.growthPenalty) ? r.growthPenalty : 1.0,
    revenuePenalty: isFiniteNumber(r.revenuePenalty) ? r.revenuePenalty : 1.0,
    // 表示専用の派生値。保存されないため月次収支パネルの初期値で再構築する。
    lastReport: { revenue: 0, maintenance: 0, disaster: 0, net: 0 },
    gameOver: isBoolean(r.gameOver) ? r.gameOver : false,
  };
}

/**
 * 保存用スリムオブジェクト（または任意の不明なJSON）→ GameState への復元。
 * 必須フィールド（map/money/gridSize/settings等）の欠損・型不正・形状不一致があれば null を返す。
 * それ以外の欠損フィールドは新規ゲームと同じデフォルト値で補完する。
 *
 * expectedGridSize: 復元後の state を受け取る側（GameEngine）の現在の gridSize。
 * 保存データの gridSize と一致しない場合は読込失敗として null を返す
 * （異なるマップサイズのセーブを今のエンジンに読み込むと内部の走査範囲がズレて壊れるため）。
 */
export function deserializeState(raw: unknown, expectedGridSize: number): GameState | null {
  try {
    return deserializeStateOrThrow(raw, expectedGridSize);
  } catch (e) {
    if (e instanceof StateValidationError) return null;
    throw e;
  }
}

export class StorageManager {
  // セーブスロットにゲーム状態を保存
  saveGame(slotIndex: number, state: GameState): boolean {
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS) return false;

    const key = `${STORAGE_KEY_PREFIX}save-${slotIndex}`;
    const data = {
      timestamp: Date.now(),
      state: serializeState(state),
    };

    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`✅ Game saved to slot ${slotIndex}`);
      return true;
    } catch (e) {
      console.error("Save failed:", e);
      return false;
    }
  }

  // セーブスロットからゲーム状態を読み込み。
  // gridSize: 読込先(現在のGameEngine)のgridSize。一致しないセーブは読込失敗として null を返す。
  loadGame(slotIndex: number, gridSize: number): GameState | null {
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS) return null;

    const key = `${STORAGE_KEY_PREFIX}save-${slotIndex}`;

    try {
      const data = localStorage.getItem(key);
      if (!data) {
        console.log(`❌ No save data in slot ${slotIndex}`);
        return null;
      }

      const parsed = JSON.parse(data) as { state?: unknown };
      const state = deserializeState(parsed.state, gridSize);
      if (state) {
        console.log(`✅ Game loaded from slot ${slotIndex}`);
      } else {
        console.error(`❌ Save data in slot ${slotIndex} is invalid or incompatible`);
      }
      return state;
    } catch (e) {
      console.error("Load failed:", e);
      return null;
    }
  }

  // セーブスロット情報を取得
  getSlotInfo(slotIndex: number): { timestamp: number; population: number; money: number } | null {
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS) return null;

    const key = `${STORAGE_KEY_PREFIX}save-${slotIndex}`;

    try {
      const data = localStorage.getItem(key);
      if (!data) return null;

      const parsed = JSON.parse(data) as {
        timestamp?: unknown;
        state?: { population?: unknown; money?: unknown };
      };
      const { timestamp } = parsed;
      const population = parsed.state?.population;
      const money = parsed.state?.money;
      if (!isFiniteNumber(timestamp) || !isFiniteNumber(population) || !isFiniteNumber(money)) {
        return null;
      }
      return { timestamp, population, money };
    } catch {
      return null;
    }
  }

  // JSONファイルにエクスポート
  exportToJSON(state: GameState): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      gameState: serializeState(state),
    };
    return JSON.stringify(exportData, null, 2);
  }

  // JSONファイルからインポート。
  // gridSize: インポート先(現在のGameEngine)のgridSize。一致しないデータは読込失敗として null を返す。
  importFromJSON(jsonString: string, gridSize: number): GameState | null {
    try {
      const data = JSON.parse(jsonString) as { gameState?: unknown };
      if (!data.gameState) return null;
      return deserializeState(data.gameState, gridSize);
    } catch (e) {
      console.error("Import failed:", e);
      return null;
    }
  }

  // 設定をCookieに保存
  saveSettings(settings: Record<string, unknown>): void {
    const key = `${STORAGE_KEY_PREFIX}settings`;
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.error("Settings save failed:", e);
    }
  }

  // Cookieから設定を読み込み
  loadSettings(): Record<string, unknown> {
    const key = `${STORAGE_KEY_PREFIX}settings`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }
}
