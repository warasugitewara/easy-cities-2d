// GameEngine の特性テスト（characterization tests）
//
// 目的: 今後のリファクタリング/バランス調整の安全網として、現状の挙動をスナップショット的に固定する。
// シード付きRNG（mulberry32）で決定論的に実行し、値の「正しさ」は問わず「現状値」を期待値として記述する。
//
// 既知バグについては、コメントで明記した上で現状の挙動をそのまま固定している（Phase 2 で修正予定）。

import { describe, expect, test, beforeEach } from "vite-plus/test";
import { GameEngine, type GameSettings } from "./engine";
import { mulberry32 } from "./rng";
import { TileType, POPULATION_TABLE } from "./constants";

// テストは高速化のため small マップ（64グリッド）を使用する。
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

// monthlyUpdate() の破産分岐が alert() を呼ぶため、node環境向けにスタブする
// （本テストスイートでは破産シナリオを作らないが、念のため各テスト前にスタブしておく）。
beforeEach(() => {
  globalThis.alert = (() => {}) as typeof globalThis.alert;
});

// マップ全体から人口を独立に再計算するヘルパー（calculatePopulation() のロジックを
// テスト側で独立検証するために複製。エンジン内部の計算式は POPULATION_TABLE 参照のみで
// 決定論的なので、rng には依存しない）。
function sumPopulationFromMap(map: number[][]): number {
  let total = 0;
  for (const row of map) {
    for (const tile of row) {
      total += POPULATION_TABLE[tile] || 0;
    }
  }
  return total;
}

describe("GameEngine construction", () => {
  test("難易度ごとの初期資金 (easy=350000)", () => {
    const engine = new GameEngine(makeSettings({ difficulty: "easy" }));
    expect(engine.state.money).toBe(350000);
  });

  test("難易度ごとの初期資金 (normal=250000)", () => {
    const engine = new GameEngine(makeSettings({ difficulty: "normal" }));
    expect(engine.state.money).toBe(250000);
  });

  test("難易度ごとの初期資金 (hard=150000)", () => {
    const engine = new GameEngine(makeSettings({ difficulty: "hard" }));
    expect(engine.state.money).toBe(150000);
  });

  test("small マップでは gridSize が 64 になる", () => {
    const engine = new GameEngine(makeSettings());
    expect(engine.state.gridSize).toBe(64);
  });

  test("中央に STATION が配置される", () => {
    const engine = new GameEngine(makeSettings());
    const center = Math.floor(engine.state.gridSize / 2);
    expect(engine.state.map[center][center]).toBe(TileType.STATION);
  });
});

describe("GameEngine.build()", () => {
  test("道路設置で money が 200 減る", () => {
    const engine = new GameEngine(makeSettings());
    const before = engine.state.money;
    engine.state.buildMode = "road";
    const result = engine.build(5, 5);
    expect(result).toBe(true);
    expect(engine.state.money).toBe(before - 200);
    expect(engine.state.map[5][5]).toBe(TileType.ROAD);
  });

  test("既存タイル上には設置不可 (false)", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "road";
    expect(engine.build(5, 5)).toBe(true);
    const moneyAfterFirst = engine.state.money;
    expect(engine.build(5, 5)).toBe(false);
    expect(engine.state.money).toBe(moneyAfterFirst);
  });

  test("資金不足時は false（非サンドボックス）", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.money = 100; // 道路コスト200未満
    engine.state.buildMode = "road";
    expect(engine.build(6, 6)).toBe(false);
    expect(engine.state.map[6][6]).toBe(TileType.EMPTY);
    expect(engine.state.money).toBe(100);
  });

  test("2x2 の駅設置で4タイル占有し、demolishで4タイル全消去", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "station";
    expect(engine.build(10, 10)).toBe(true);
    expect(engine.state.map[10][10]).toBe(TileType.STATION);
    expect(engine.state.map[10][11]).toBe(TileType.STATION);
    expect(engine.state.map[11][10]).toBe(TileType.STATION);
    expect(engine.state.map[11][11]).toBe(TileType.STATION);

    engine.state.buildMode = "demolish";
    expect(engine.build(10, 10)).toBe(true);
    expect(engine.state.map[10][10]).toBe(TileType.EMPTY);
    expect(engine.state.map[10][11]).toBe(TileType.EMPTY);
    expect(engine.state.map[11][10]).toBe(TileType.EMPTY);
    expect(engine.state.map[11][11]).toBe(TileType.EMPTY);
  });

  // Phase 2a: 建物サイズをREADME仕様（病院2x2・発電所1x1）に修正したことの検証。
  test("2x2 の病院設置で4タイル占有し、demolishで4タイル全消去", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "hospital";
    expect(engine.build(20, 20)).toBe(true);
    expect(engine.state.map[20][20]).toBe(TileType.HOSPITAL);
    expect(engine.state.map[20][21]).toBe(TileType.HOSPITAL);
    expect(engine.state.map[21][20]).toBe(TileType.HOSPITAL);
    expect(engine.state.map[21][21]).toBe(TileType.HOSPITAL);

    engine.state.buildMode = "demolish";
    expect(engine.build(20, 20)).toBe(true);
    expect(engine.state.map[20][20]).toBe(TileType.EMPTY);
    expect(engine.state.map[20][21]).toBe(TileType.EMPTY);
    expect(engine.state.map[21][20]).toBe(TileType.EMPTY);
    expect(engine.state.map[21][21]).toBe(TileType.EMPTY);
  });

  test("1x1 の発電所設置で1タイルのみ占有し、demolishで1タイル消去", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "power_plant";
    expect(engine.build(15, 15)).toBe(true);
    expect(engine.state.map[15][15]).toBe(TileType.POWER_PLANT);
    // 隣接タイルは占有されない（4x4だった旧仕様との違いを固定化）
    expect(engine.state.map[15][16]).toBe(TileType.EMPTY);
    expect(engine.state.map[16][15]).toBe(TileType.EMPTY);

    engine.state.buildMode = "demolish";
    expect(engine.build(15, 15)).toBe(true);
    expect(engine.state.map[15][15]).toBe(TileType.EMPTY);
  });
});

describe("GameEngine.grow() 決定論", () => {
  test("シード固定・道路設置後に grow() を50回呼ぶと population が固定値になる", () => {
    const rng = mulberry32(12345);
    const engine = new GameEngine(makeSettings(), rng);
    engine.state.buildMode = "road";
    for (let x = 10; x <= 20; x++) {
      engine.build(x, 30);
    }

    for (let i = 0; i < 50; i++) {
      engine.grow();
    }

    const population = engine.calculatePopulation();
    // 現状値をそのままスナップショットとして固定（値自体の正しさは問わない）。
    expect(population).toBe(30);
  });
});

describe("GameEngine.countBuildings()", () => {
  test("1x1の発電所を3個設置すると power_plant のカウントは3", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "power_plant";
    engine.build(5, 5);
    engine.build(8, 8);
    engine.build(12, 12);

    const counts = engine.countBuildings();
    expect(counts.get(TileType.POWER_PLANT)).toBe(3);
  });

  test("2x2の病院を2棟設置すると hospital のカウントは2（8タイル÷4=2）", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "hospital";
    engine.build(10, 10);
    engine.build(20, 20);

    const counts = engine.countBuildings();
    expect(counts.get(TileType.HOSPITAL)).toBe(2);
  });

  test("道路を5本設置すると road のカウントは5（1x1建物はタイル数=建物数）", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "road";
    for (let x = 0; x < 5; x++) {
      engine.build(x, 40);
    }

    const counts = engine.countBuildings();
    expect(counts.get(TileType.ROAD)).toBe(5);
  });
});

describe("GameEngine.monthlyUpdate()", () => {
  test("サンドボックスで revenue のみ加算され、population が再計算される", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "residential";
    engine.build(1, 1);
    engine.build(2, 2);
    engine.build(3, 3);

    const before = engine.state.money;
    engine.monthlyUpdate();

    // サンドボックスでは維持費が無視され revenue のみ加算される（現状値をスナップショット固定）。
    // Step1リバランスにより更新: 建物単位課税（住宅L1税収 20→30/棟）に伴い 31.395 → 47.0925。
    expect(engine.state.money - before).toBeCloseTo(47.0925, 3);
    expect(engine.state.population).toBe(sumPopulationFromMap(engine.state.map));
  });

  test("非サンドボックス・十分な資金で revenue-maintenance 相当に money が変化する", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "residential";
    engine.build(1, 1);
    engine.build(2, 2);
    engine.build(3, 3);

    const before = engine.state.money;
    engine.monthlyUpdate();

    // 維持費を差し引いた revenue-maintenance 相当の変化（現状値をスナップショット固定）。
    // Step1リバランス＋初期駅の2x2化により更新。住宅L1×3の税収(30/棟)にペナルティ等を
    // 適用した revenue ≈ 47.0925 から、初期の中央STATION(2x2=1棟)の維持費300/棟を
    // 差し引いて -252.9075 になる。
    // （初期駅を正規の 2x2 で配置する監督修正により、駅が countBuildings() で 1 棟として
    //  正しく計上されるようになった。以前は1タイルのみ配置で round(1/4)=0 棟＝維持費0だった）
    expect(engine.state.money - before).toBeCloseTo(-252.9075, 3);
    expect(engine.state.population).toBe(sumPopulationFromMap(engine.state.map));
  });
});

describe("既知バグの特性化 (BUG: 将来Phase 2で修正)", () => {
  test("BUG: 病気/スラムによる population の直接減算は monthlyUpdate 内の calculatePopulation() 呼び出しで上書きされ実質no-opになる", () => {
    // updateDisasters() (updateDiseases/updateSlums 含む) は monthlyUpdate() 内で
    // calculatePopulation() より前に呼ばれるため、そこでの population 直接減算は
    // 必ず直後の calculatePopulation() の再計算で上書きされる。
    // このテストでは、disastersEnabled/slumEnabled/pollutionEnabled を有効にし、
    // 病気による人口減算パスが走りうる状況で複数回 monthlyUpdate() を実行しても、
    // 呼び出し後の population は常に「マップから再計算した値」と完全一致することを示す
    // （＝直接減算が反映された形跡が残らない）。
    const rng = mulberry32(999);
    const engine = new GameEngine(
      makeSettings({
        sandbox: true,
        disastersEnabled: true,
        pollutionEnabled: true,
        slumEnabled: true,
      }),
      rng,
    );
    engine.state.buildMode = "residential";
    for (let i = 0; i < 10; i++) {
      engine.build(i, 0);
    }
    // 病気を確実に発生させるため diseaseMap を直接高い値にしておく
    for (let i = 0; i < 10; i++) {
      engine.state.diseaseMap[0][i] = 10;
    }

    for (let i = 0; i < 10; i++) {
      engine.monthlyUpdate();
    }

    expect(engine.state.population).toBe(sumPopulationFromMap(engine.state.map));
  });

  test("BUG: applyEffectRadius により警察署1個で securityLevel がほぼ100に飽和する", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "police";
    engine.build(30, 30); // マップ中央付近（2x2、4タイルとも POLICE）

    engine.monthlyUpdate();
    // 警察署は2x2(4タイル)で、4タイルすべてが POLICE として扱われるため
    // applyEffectRadius が同じ場所に対して4回呼ばれ、securityLevel が一気に上限(100)へ飽和する。
    // 現状値をそのままスナップショットとして固定。
    expect(engine.state.securityLevel).toBe(100);
  });
});
