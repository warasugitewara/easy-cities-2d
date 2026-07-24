// 乱数生成ユーティリティ
// GameEngine にシード可能な PRNG を注入し、テストで挙動を決定論的に固定できるようにする。

/** [0, 1) の浮動小数点数を返す乱数生成関数。デフォルトの Math.random と同じ契約。 */
export type RNG = () => number;

/**
 * mulberry32: 高速・決定論的な32bit PRNG。
 * シード値から [0, 1) の乱数列を生成する RNG を返す。
 */
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * GameEngine のデフォルト RNG。標準の乱数源（グローバルの `Math.random` 相当）をそのまま委譲する薄いラッパー。
 * engine.ts から `Math.random` という文字列を排除しつつ、RNG未指定時の挙動を従来通り保つために存在する。
 */
export const defaultRng: RNG = () => globalThis.Math.random();
