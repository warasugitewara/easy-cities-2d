// StorageManager のシリアライズ/デシリアライズ（Phase 0b: セーブの軽量化＋読込バリデーション）テスト。
//
// - serializeState()/deserializeState() のラウンドトリップでコア状態が復元されること
// - powerGrid/waterGrid/lastReport が保存対象から除外され、復元時にゼロ/初期値で再構築されること
// - 状態グリッド(fireMap等)が全ゼロならnull保存され、非ゼロなら値が往復で一致すること
// - 壊れた入力（必須フィールド欠損・形状不一致）で deserializeState が null を返すこと

import { describe, expect, test, beforeEach } from "vite-plus/test";
import { GameEngine, type GameSettings } from "./engine";
import { TileType } from "./constants";
import { deserializeState, serializeState } from "./storage";

function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    difficulty: "normal",
    mapSize: "small",
    disastersEnabled: false,
    pollutionEnabled: false,
    slumEnabled: false,
    sandbox: false,
    ...overrides,
  };
}

// monthlyUpdate() の破産分岐が alert() を呼ぶため、node環境向けにスタブする（念のため）。
beforeEach(() => {
  globalThis.alert = (() => {}) as typeof globalThis.alert;
});

describe("serializeState / deserializeState ラウンドトリップ", () => {
  test("コア状態(map/money/month/population/各Level等)が復元される", () => {
    const engine = new GameEngine(makeSettings({ difficulty: "hard" }));
    engine.state.buildMode = "road";
    engine.build(5, 5);
    engine.state.money = 12345;
    engine.state.month = 7;
    engine.state.population = 321;
    engine.state.comfort = 77;
    engine.state.securityLevel = 66;
    engine.state.residentialDemand = 40;
    engine.state.gameOver = true;

    const serialized = serializeState(engine.state);
    const restored = deserializeState(serialized, engine.state.gridSize);

    expect(restored).not.toBeNull();
    expect(restored?.map).toEqual(engine.state.map);
    expect(restored?.money).toBe(12345);
    expect(restored?.month).toBe(7);
    expect(restored?.population).toBe(321);
    expect(restored?.comfort).toBe(77);
    expect(restored?.securityLevel).toBe(66);
    expect(restored?.residentialDemand).toBe(40);
    expect(restored?.gameOver).toBe(true);
    expect(restored?.settings).toEqual(engine.state.settings);
    expect(restored?.gridSize).toBe(engine.state.gridSize);
  });

  test("mapのフラット化/復元で座標(x,y)の値が正しく往復する（転置バグの検出）", () => {
    const engine = new GameEngine(makeSettings());
    const gridSize = engine.state.gridSize;
    engine.state.buildMode = "road";
    engine.build(0, 0);
    engine.build(gridSize - 1, 0);
    engine.build(0, gridSize - 1);

    const serialized = serializeState(engine.state);
    const restored = deserializeState(serialized, gridSize);

    expect(restored).not.toBeNull();
    expect(restored?.map[0][0]).toBe(TileType.ROAD);
    expect(restored?.map[0][gridSize - 1]).toBe(TileType.ROAD);
    expect(restored?.map[gridSize - 1][0]).toBe(TileType.ROAD);
    // 無関係のタイル（中央の初期駅）が壊れていないことも確認
    const center = Math.floor(gridSize / 2);
    expect(restored?.map[center][center]).toBe(engine.state.map[center][center]);
  });
});

describe("派生フィールドの除外（powerGrid/waterGrid/lastReport）", () => {
  test("シリアライズ結果にpowerGrid/waterGrid/lastReportが含まれない", () => {
    const engine = new GameEngine(makeSettings());
    const serialized = serializeState(engine.state);
    const keys = Object.keys(serialized);
    expect(keys).not.toContain("powerGrid");
    expect(keys).not.toContain("waterGrid");
    expect(keys).not.toContain("lastReport");
  });

  test("復元後、powerGrid/waterGridはfalseグリッド・lastReportは初期値になる", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.powerGrid[0][0] = true;
    engine.state.waterGrid[1][1] = true;
    engine.state.lastReport = { revenue: 999, maintenance: 1, disaster: 2, net: 996 };

    const serialized = serializeState(engine.state);
    const restored = deserializeState(serialized, engine.state.gridSize);

    expect(restored).not.toBeNull();
    expect(restored?.powerGrid.every((row) => row.every((v) => v === false))).toBe(true);
    expect(restored?.waterGrid.every((row) => row.every((v) => v === false))).toBe(true);
    expect(restored?.lastReport).toEqual({ revenue: 0, maintenance: 0, disaster: 0, net: 0 });
  });
});

describe("状態グリッド(fireMap等)の圧縮", () => {
  test("初期状態（全ゼロ）はnullとして保存され、復元時にゼロ埋めされる", () => {
    const engine = new GameEngine(makeSettings());
    const serialized = serializeState(engine.state);

    expect(serialized.fireMap).toBeNull();
    expect(serialized.diseaseMap).toBeNull();
    expect(serialized.pollutionMap).toBeNull();
    expect(serialized.slumMap).toBeNull();

    const restored = deserializeState(serialized, engine.state.gridSize);
    expect(restored).not.toBeNull();
    expect(restored?.fireMap).toEqual(engine.state.fireMap);
    expect(restored?.diseaseMap).toEqual(engine.state.diseaseMap);
    expect(restored?.pollutionMap).toEqual(engine.state.pollutionMap);
    expect(restored?.slumMap).toEqual(engine.state.slumMap);
  });

  test("非ゼロの状態グリッドはフラット配列として保存され、往復で値と形状が一致する", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.fireMap[3][7] = 5;
    engine.state.fireMap[10][2] = 9;

    const serialized = serializeState(engine.state);
    expect(serialized.fireMap).not.toBeNull();
    expect(serialized.fireMap).toHaveLength(engine.state.gridSize * engine.state.gridSize);

    const restored = deserializeState(serialized, engine.state.gridSize);
    expect(restored).not.toBeNull();
    expect(restored?.fireMap).toEqual(engine.state.fireMap);
  });
});

describe("deserializeState: 壊れた入力のバリデーション", () => {
  function makeValidRaw(): Record<string, unknown> {
    const engine = new GameEngine(makeSettings());
    return serializeState(engine.state) as unknown as Record<string, unknown>;
  }

  test("null/undefined/非オブジェクトはnullを返す", () => {
    const gridSize = new GameEngine(makeSettings()).state.gridSize;
    expect(deserializeState(null, gridSize)).toBeNull();
    expect(deserializeState(undefined, gridSize)).toBeNull();
    expect(deserializeState("not an object", gridSize)).toBeNull();
    expect(deserializeState(42, gridSize)).toBeNull();
  });

  test("moneyが欠損しているとnullを返す", () => {
    const raw = makeValidRaw();
    delete raw.money;
    expect(deserializeState(raw, raw.gridSize as number)).toBeNull();
  });

  test("settingsが欠損しているとnullを返す", () => {
    const raw = makeValidRaw();
    delete raw.settings;
    expect(deserializeState(raw, raw.gridSize as number)).toBeNull();
  });

  test("gridSizeが渡されたexpectedGridSizeと不一致だとnullを返す（マップサイズ不整合の防止）", () => {
    const raw = makeValidRaw();
    const gridSize = raw.gridSize as number;
    expect(deserializeState(raw, gridSize + 1)).toBeNull();
  });

  test("mapの要素数がgridSize^2と一致しないとnullを返す（形状不一致）", () => {
    const raw = makeValidRaw();
    raw.map = [1, 2, 3];
    expect(deserializeState(raw, raw.gridSize as number)).toBeNull();
  });

  test("fireMapの要素数がgridSize^2と一致しないとnullを返す（形状不一致）", () => {
    const raw = makeValidRaw();
    raw.fireMap = [1, 2, 3];
    expect(deserializeState(raw, raw.gridSize as number)).toBeNull();
  });

  test("欠損した非必須フィールド(comfort/gameSpeed等)はデフォルト値で補完される", () => {
    const raw = makeValidRaw();
    delete raw.comfort;
    delete raw.gameSpeed;
    delete raw.securityLevel;

    const restored = deserializeState(raw, raw.gridSize as number);
    expect(restored).not.toBeNull();
    expect(restored?.comfort).toBe(50);
    expect(restored?.gameSpeed).toBe(1);
    expect(restored?.securityLevel).toBe(50);
  });

  test("settingsの中身が一部欠損していてもデフォルト値で補完され読込は成功する", () => {
    const raw = makeValidRaw();
    raw.settings = { difficulty: "hard" }; // mapSize/disastersEnabled等が欠損
    const restored = deserializeState(raw, raw.gridSize as number);
    expect(restored).not.toBeNull();
    expect(restored?.settings.difficulty).toBe("hard");
    expect(restored?.settings.mapSize).toBe("medium");
    expect(restored?.settings.disastersEnabled).toBe(false);
  });
});
