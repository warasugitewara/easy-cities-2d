// GameEngine の特性テスト（characterization tests）
//
// 目的: 今後のリファクタリング/バランス調整の安全網として、現状の挙動をスナップショット的に固定する。
// シード付きRNG（mulberry32）で決定論的に実行し、値の「正しさ」は問わず「現状値」を期待値として記述する。
//
// 既知バグについては、コメントで明記した上で現状の挙動をそのまま固定している（Phase 2 で修正予定）。

import { describe, expect, test, beforeEach } from "vite-plus/test";
import { GameEngine, type GameSettings } from "./engine";
import { mulberry32 } from "./rng";
import { TileType, POPULATION_TABLE, SYNERGY_EFFECTS } from "./constants";

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
    // Step4リバランスにより 30 → 20 に変化: 新規建設/波及建設のたびに常に
    // RESIDENTIAL_L1 を配置していた旧実装を、需要に応じた重み付き抽選
    // （spawnZoneTile()）で住宅/商業/工業のいずれかを配置するように変更したため、
    // rng() の消費順序も変わった。実測では最終的に RESIDENTIAL_L1×1(人口10) +
    // COMMERCIAL_L1×2(人口5×2=10) が配置され、population=20 になる
    // （新規需要は起点状態で全ゾーン75均等＝bootstrapDemand、以後は雇用バランスモデルで
    // 各ゾーン需要50均衡のため、抽選で住宅だけでなく商業も自然発生するようになった）。
    expect(population).toBe(20);
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
    // Step3リバランスにより再更新: security/safety/education/medicalLevel の算出モデルを
    // 「効果範囲加算→100飽和／人口スケーリングで最大50%減衰」から
    // 「カバー率(count/required)→目標値(target)→毎月smoothing=0.25でtargetに平滑追従」に変更した。
    // 施設0個・人口30（住宅L1×3）では required=1（base）なので target=baseLevel=20、
    // 初期値50から1ヶ月で 50+(20-50)*0.25=42.5 に平滑追従する。旧モデルでは人口スケーリングの
    // deficit50%減衰で educationLevel が22.5まで落ち<40のrevenuePenalty(最大15%減)が発火していたが、
    // 新モデルの42.5は40を上回るためこのペナルティが発火せず、revenueが 47.0925 → 50.4 に増加する。
    expect(engine.state.money - before).toBeCloseTo(50.4, 3);
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
    // Step3リバランスにより再更新: 上のテストと同じ理由（educationLevel が旧モデルの22.5から
    // 新モデルの42.5に変わり<40のrevenuePenaltyが発火しなくなる）で revenue が3.3075増加し、
    // -252.9075 → -249.6 になる（維持費300は不変）。
    expect(engine.state.money - before).toBeCloseTo(-249.6, 3);
    expect(engine.state.population).toBe(sumPopulationFromMap(engine.state.map));
  });

  test("lastReport.net が money の増減と一致する（サンドボックス）", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "residential";
    engine.build(1, 1);
    engine.build(2, 2);
    engine.build(3, 3);

    const before = engine.state.money;
    engine.monthlyUpdate();

    expect(engine.state.lastReport.net).toBeCloseTo(engine.state.money - before, 6);
    expect(engine.state.lastReport.maintenance).toBe(0);
  });

  test("lastReport.net が money の増減と一致する（非サンドボックス）", () => {
    const engine = new GameEngine(makeSettings());
    engine.state.buildMode = "residential";
    engine.build(1, 1);
    engine.build(2, 2);
    engine.build(3, 3);

    const before = engine.state.money;
    engine.monthlyUpdate();

    expect(engine.state.lastReport.net).toBeCloseTo(engine.state.money - before, 6);
  });
});

describe("Step4: calculateDemands() 雇用バランスモデル", () => {
  // calculateDemands() はprivateなため monthlyUpdate() 経由（サンドボックス・disastersEnabled:false
  // で他の月次処理からの副作用を避ける）で検証する。POPULATION_TABLE を
  // 「住宅=居住人口／商業・工業=雇用数」として読み、jobs=comPop+indPop、
  // workers=employmentRate(0.5)×resPop の需給比から需要を算出する（マップ面積に依存しない）。

  test("住宅も雇用も0（起点状態）では全ゾーン需要が bootstrapDemand(75) になる", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    // 中央の初期STATION以外は未建設。road等も一切建てない。
    engine.monthlyUpdate();
    expect(engine.state.residentialDemand).toBe(75);
    expect(engine.state.commercialDemand).toBe(75);
    expect(engine.state.industrialDemand).toBe(75);
  });

  test("住宅のみの街では residentialDemand=0・commercialDemand=industrialDemand=100 になる", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "residential";
    engine.build(1, 1);
    engine.build(2, 2);
    engine.build(3, 3);
    engine.monthlyUpdate();
    // jobs=0 なので residentialDemand=round(50*0/workers)=0。
    // businessDemand=round(50*workers/max(1,0))はclampで100に張り付き、
    // comShare/indShareはjobs=0のため0.5ずつ→commercialDemand=industrialDemand=100。
    expect(engine.state.residentialDemand).toBe(0);
    expect(engine.state.commercialDemand).toBe(100);
    expect(engine.state.industrialDemand).toBe(100);
  });

  test("雇用と住宅人口が均衡（jobs=workers・商工同数）すると全需要が50になる", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    // resPop=60(住宅L1×6), comPop=15(商業L1×3), indPop=15(工業L1×1)
    // workers=0.5*60=30=jobs(15+15) で均衡、comShare=indShare=0.5。
    engine.state.buildMode = "residential";
    for (let i = 0; i < 6; i++) engine.build(i, 0);
    engine.state.buildMode = "commercial";
    for (let i = 0; i < 3; i++) engine.build(i, 1);
    engine.state.buildMode = "industrial";
    engine.build(0, 2);
    engine.monthlyUpdate();
    expect(engine.state.residentialDemand).toBe(50);
    expect(engine.state.commercialDemand).toBe(50);
    expect(engine.state.industrialDemand).toBe(50);
  });

  test("商業が過剰（工業0・雇用超過）だと commercialDemand が下がり industrialDemand が上がる", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    // resPop=60(workers=30), comPop=45(商業L1×9), indPop=0 → jobs=45
    engine.state.buildMode = "residential";
    for (let i = 0; i < 6; i++) engine.build(i, 0);
    engine.state.buildMode = "commercial";
    for (let i = 0; i < 9; i++) engine.build(i, 1);
    engine.monthlyUpdate();
    // residentialDemand=round(50*45/30)=75, businessDemand=round(50*30/45)=33,
    // comShare=45/45=1→commercialDemand=round(33*2*0)=0,
    // indShare=0/45=0→industrialDemand=round(33*2*1)=66。
    expect(engine.state.residentialDemand).toBe(75);
    expect(engine.state.commercialDemand).toBe(0);
    expect(engine.state.industrialDemand).toBe(66);
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

  test("FIXED (Step3): 警察署1棟で securityLevel がカバー率に応じ上昇する（飽和しない）", () => {
    // 旧実装は applyEffectRadius が2x2(4タイル)の POLICE すべてに対して呼ばれるため
    // securityLevel が一気に上限(100)へ飽和するバグを持っていた。
    // Step3リバランスの効果カバー率×平滑追従モデルではタイル数ではなく countBuildings() の
    // 「棟数」を使い、目標値へ smoothing=0.25 の割合でしか近づかないため飽和しなくなった。
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "police";
    engine.build(30, 30); // マップ中央付近（2x2、4タイルとも POLICE→countBuildings()で1棟）

    engine.monthlyUpdate();
    // 人口0なので requiredPolice=base=1、policeCount=1（2x2/4=1棟）で ratio=1 → target=fullLevel=80。
    // 初期値50から1ヶ月で 50+(80-50)*0.25=57.5 に平滑追従する（100には飽和しない）。
    expect(engine.state.securityLevel).toBeCloseTo(57.5, 5);
  });
});

describe("Step3: 効果カバー率×平滑追従モデル（CITY_LEVEL_MODEL）", () => {
  test("施設0個・人口0では securityLevel が baseLevel(20) へ収束する", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    // 何も建てず、平滑追従が十分収束するまで monthlyUpdate を繰り返す
    // （毎月 (target-level)*0.25 だけ近づくので、30ヶ月後には初期値50との差が
    //  0.75^30 ≈ 0.00018 倍まで減衰し、20にほぼ一致する）。
    for (let i = 0; i < 30; i++) {
      engine.monthlyUpdate();
    }
    expect(engine.state.securityLevel).toBeCloseTo(20, 1);
    expect(engine.state.educationLevel).toBeCloseTo(20, 1);
  });

  test("警察を必要数（ratio=1）ちょうど揃えると securityLevel が fullLevel(80) へ収束する", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "police";
    engine.build(10, 10); // 人口0なので requiredPolice=base=1、1棟でratio=1

    for (let i = 0; i < 30; i++) {
      engine.monthlyUpdate();
    }
    expect(engine.state.securityLevel).toBeCloseTo(80, 1);
  });

  test("警察を過剰配置（ratio>=1.25）すると securityLevel が overProvisionMax(90) へ収束する", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "police";
    engine.build(10, 10); // 1棟目
    engine.build(20, 20); // 2棟目（人口0なのでrequired=1のまま、ratio=2>=1.25）

    for (let i = 0; i < 30; i++) {
      engine.monthlyUpdate();
    }
    expect(engine.state.securityLevel).toBeCloseTo(90, 1);
  });

  test("警察+学校が15マス以内にあるとシナジーで securityLevel/educationLevel の目標に+5される", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "police";
    engine.build(10, 10); // policeのみ: ratio=1 → target=80
    engine.state.selectedInfrastructure = "school";
    engine.build(15, 10); // policeから距離5（マンハッタン）: 15マス以内でシナジー成立

    for (let i = 0; i < 30; i++) {
      engine.monthlyUpdate();
    }
    // シナジーなしなら target=80、シナジーで+5されて target=85 に収束する
    expect(engine.state.securityLevel).toBeCloseTo(85, 1);
    expect(engine.state.educationLevel).toBeCloseTo(85, 1);
  });

  test("駅+学校+警察が20マス以内に揃うと商業高層化の確率にcommercialGrowthMult(1.2)が乗算される", () => {
    // commercialGrowthMult はprivateな派生値のため、grow() の商業高層化判定における
    // rng() の呼び出しを完全に同期させた「あり/なし」2エンジンを比較して間接的に検証する。
    // - 警察+学校は両エンジンに同じ配置で置き、securityLevel/educationLevel（→growthPenalty）を揃える
    //   （police_schoolシナジーは両方に効くため、これによる閾値の違いは生じない）。
    // - 駅の有無だけを変え、station+school+police の三者シナジー（triple synergy）だけを分岐させる。
    // - 商業タイルはグリッド左上(0,0)に単独配置し、grow()の走査順で最初に処理される1マスにする
    //   ことで、それ以前に他のセルがrng()を消費して閾値判定がずれることを防ぐ
    //   （EMPTY×道路/建物隣接なしのセルはrng()を一切消費しないためスキップされる）。
    // - rng()に定数を返す関数を渡し、二分探索で「成長する/しない」が切り替わる閾値を実測する。
    //   growthRate/bias等の内部定数を直接読まなくても、with/withoutの閾値比が
    //   ちょうど SYNERGY_EFFECTS.station_school_police.commercialGrowthMult(1.2) になることを
    //   数値的に検証できる。
    function buildFacilities(engine: GameEngine, withStation: boolean): void {
      engine.state.buildMode = "infrastructure";
      engine.state.selectedInfrastructure = "police";
      engine.build(10, 10);
      engine.state.selectedInfrastructure = "school";
      engine.build(14, 10); // policeから距離4（15マス以内）
      if (withStation) {
        engine.state.selectedInfrastructure = "station";
        engine.build(20, 20); // school/police双方から20マス以内
      }
      engine.state.buildMode = "commercial";
      engine.build(0, 0); // grow()の走査で最初に処理される単独の商業タイル
    }

    // rng()が常に定数xを返すエンジンで単発grow()を行い、商業タイルが高層化したかを返す
    function grows(withStation: boolean, x: number): boolean {
      const engine = new GameEngine(makeSettings({ sandbox: true }), () => x);
      buildFacilities(engine, withStation);
      engine.monthlyUpdate(); // growthPenalty/commercialGrowthMultを確定（disastersEnabled:falseのためrng消費なし）
      engine.grow();
      return engine.state.map[0][0] !== TileType.COMMERCIAL_L1;
    }

    // 二分探索で「rng()<しきい値」の境界を実測する（40回で誤差 2^-40 未満に収束）
    function findThreshold(withStation: boolean): number {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (grows(withStation, mid)) {
          lo = mid; // mid < threshold（成長した）
        } else {
          hi = mid; // mid >= threshold（成長しなかった）
        }
      }
      return (lo + hi) / 2;
    }

    const thresholdWithout = findThreshold(false);
    const thresholdWith = findThreshold(true);

    // 他の要因（bias/growthPenalty/localPenalty）はwith/withoutで完全に同一のため、
    // 比はちょうど commercialGrowthMult(1.2) になるはず。
    expect(thresholdWith / thresholdWithout).toBeCloseTo(
      SYNERGY_EFFECTS.station_school_police.commercialGrowthMult,
      6,
    );
  });
});

describe("Step5: calculateComfort() 純粋関数モデル", () => {
  function seedResidential(engine: GameEngine, n: number): void {
    engine.state.buildMode = "residential";
    for (let i = 0; i < n; i++) {
      engine.build(5 + i, 5);
    }
    engine.calculatePopulation();
  }

  test("公園を住宅の近くに置くと快適度（緑地カバー率）が上がる", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    seedResidential(engine, 5);
    const before = engine.calculateComfort();

    engine.state.buildMode = "infrastructure";
    engine.state.selectedInfrastructure = "park";
    engine.build(5, 7); // 住宅（y=5）の近くに公園を配置
    const after = engine.calculateComfort();

    expect(after).toBeGreaterThan(before);
  });

  test("汚染度が高いほど快適度が下がる（pollutionMult）", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    seedResidential(engine, 5);

    engine.state.pollutionLevel = 0;
    const clean = engine.calculateComfort();
    engine.state.pollutionLevel = 100;
    const polluted = engine.calculateComfort();

    expect(polluted).toBeLessThan(clean);
  });

  test("サービス指標（治安/安全/教育/医療）が高いほど快適度が上がる", () => {
    const engine = new GameEngine(makeSettings({ sandbox: true }));
    seedResidential(engine, 5);

    engine.state.securityLevel = 0;
    engine.state.safetyLevel = 0;
    engine.state.educationLevel = 0;
    engine.state.medicalLevel = 0;
    const low = engine.calculateComfort();

    engine.state.securityLevel = 100;
    engine.state.safetyLevel = 100;
    engine.state.educationLevel = 100;
    engine.state.medicalLevel = 100;
    const high = engine.calculateComfort();

    expect(high).toBeGreaterThan(low);
  });
});

describe("Step6: 病気/スラムの永続化", () => {
  test("病気が最大まで蔓延するとゾーンが1段階降格し永続化する（L2→L1）", () => {
    const engine = new GameEngine(
      makeSettings({ sandbox: true, disastersEnabled: true }),
      mulberry32(1),
    );
    engine.state.map[5][5] = TileType.RESIDENTIAL_L2;
    engine.state.diseaseMap[5][5] = 10; // 蔓延の最大値

    engine.monthlyUpdate();

    // 旧実装は population 直接減算が calculatePopulation で上書きされ無効だった。
    // Step6ではタイル降格でマップ自体が変わるため損失が永続化する。
    expect(engine.state.map[5][5]).toBe(TileType.RESIDENTIAL_L1);
    expect(engine.state.diseaseMap[5][5]).toBe(0);
  });

  test("病気が最大のL1住宅はEMPTYになる（人が逃げる）", () => {
    const engine = new GameEngine(
      makeSettings({ sandbox: true, disastersEnabled: true }),
      mulberry32(1),
    );
    engine.state.map[5][5] = TileType.RESIDENTIAL_L1;
    engine.state.diseaseMap[5][5] = 10;

    engine.monthlyUpdate();

    expect(engine.state.map[5][5]).toBe(TileType.EMPTY);
  });
});

describe("Step7: ランドマーク近接ボーナス（倍率方式）", () => {
  test("スタジアム圏内の商業タイルは税収が押し上げられる", () => {
    function monthDelta(withStadium: boolean): number {
      const engine = new GameEngine(makeSettings({ sandbox: true }), mulberry32(7));
      engine.state.map[10][10] = TileType.COMMERCIAL_L1;
      if (withStadium) {
        engine.state.map[12][12] = TileType.LANDMARK_STADIUM; // 商業から近接（圏内）
      }
      const before = engine.state.money;
      engine.monthlyUpdate();
      return engine.state.money - before;
    }

    // スタジアム圏内では商業税収が倍率で上がるため、月次収支がプラス方向に増える。
    expect(monthDelta(true)).toBeGreaterThan(monthDelta(false));
  });
});
