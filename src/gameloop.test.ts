// computeSteps() の単体テスト（決定論的・高速）。
//
// 固定タイムステップ化（Phase 1）の中核ロジックを検証する。
// 副作用を持たない純粋関数なので、DOM/エンジン等を一切セットアップせずにテストできる。

import { describe, expect, test } from "vite-plus/test";
import { computeSteps, SIM_TICK_MS } from "./gameloop";

describe("computeSteps", () => {
  test("frameTime=16.667ms (60fps相当) で steps=1 になる", () => {
    const result = computeSteps(0, 16.667, SIM_TICK_MS, 5);
    expect(result.steps).toBe(1);
  });

  test("frameTime≈33.3ms (30fps相当) で steps=2 になる", () => {
    const result = computeSteps(0, 33.34, SIM_TICK_MS, 5);
    expect(result.steps).toBe(2);
  });

  test("端数が accumulator に繰り越される（10msを2回呼ぶと2回目でsteps=1になる）", () => {
    const first = computeSteps(0, 10, SIM_TICK_MS, 5);
    expect(first.steps).toBe(0);
    expect(first.accumulator).toBeCloseTo(10, 5);

    const second = computeSteps(first.accumulator, 10, SIM_TICK_MS, 5);
    expect(second.steps).toBe(1);
    expect(second.accumulator).toBeCloseTo(20 - SIM_TICK_MS, 5);
  });

  test("maxSteps でクランプされ、余剰accumulatorは破棄される（スパイラル・オブ・デス対策）", () => {
    const result = computeSteps(0, 1000, SIM_TICK_MS, 5);
    expect(result.steps).toBe(5);
    expect(result.accumulator).toBe(0);
  });

  test("frameTime=0 では steps=0 で accumulatorも変化しない", () => {
    const result = computeSteps(0, 0, SIM_TICK_MS, 5);
    expect(result.steps).toBe(0);
    expect(result.accumulator).toBe(0);
  });

  test("既存のaccumulatorを保持したままframeTime=0を渡してもstepsは進まない", () => {
    const result = computeSteps(5, 0, SIM_TICK_MS, 5);
    expect(result.steps).toBe(0);
    expect(result.accumulator).toBe(5);
  });

  test("60fpsを60回連続で流すと合計steps=60・accumulatorがほぼ0に戻る（従来挙動との一致確認）", () => {
    let acc = 0;
    let totalSteps = 0;
    for (let i = 0; i < 60; i++) {
      const result = computeSteps(acc, SIM_TICK_MS, SIM_TICK_MS, 5);
      totalSteps += result.steps;
      acc = result.accumulator;
    }
    expect(totalSteps).toBe(60);
    expect(acc).toBeCloseTo(0, 5);
  });
});
