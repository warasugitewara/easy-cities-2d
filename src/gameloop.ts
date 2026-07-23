// 固定タイムステップ化（フレームレート非依存のゲームループ）の純粋関数群。
//
// requestAnimationFrame はモニタのリフレッシュレートに応じて任意の頻度で呼ばれるため、
// 「1フレーム = 1シミュレーションステップ」のままだと 120Hz/144Hz 環境でゲーム進行が
// 速くなってしまう。ここでは経過時間を accumulator に貯め、固定刻み(SIM_TICK_MS)ぶんだけ
// シミュレーションを進める「アキュムレータパターン」を提供する。
//
// SIM_TICK_MS = 1000/60 とすることで、60fps環境では従来の「1フレーム=1ステップ」と
// 完全に一致する（後方互換）。

/** 固定シミュレーション刻み（ミリ秒）。60fps環境での従来の1フレーム分に相当する。 */
export const SIM_TICK_MS = 1000 / 60;

export interface StepPlan {
  /** このフレームで実行すべきシミュレーションステップ数。 */
  steps: number;
  /** 次フレームに繰り越す端数時間（ミリ秒）。 */
  accumulator: number;
}

/**
 * 経過時間(frameTime)を accumulator に足し込み、固定刻み(tickMs)で進める
 * ステップ数を計算する純粋関数。
 *
 * - frameTime は過大なギャップ（タブ非アクティブからの復帰など）を避けるため、
 *   呼び出し側でクランプ済みの値を渡す想定だが、maxSteps によって
 *   「スパイラル・オブ・デス」（描画が追いつかず処理が無限に溜まり続ける状態）も防ぐ。
 * - maxSteps に達した場合、それ以上の遅延は取り戻さず、余剰 accumulator を破棄する（0にする）。
 */
export function computeSteps(
  accumulator: number,
  frameTime: number,
  tickMs: number,
  maxSteps: number,
): StepPlan {
  let acc = accumulator + frameTime;
  let steps = 0;
  while (acc >= tickMs && steps < maxSteps) {
    acc -= tickMs;
    steps++;
  }
  if (steps >= maxSteps) {
    acc = 0;
  }
  return { steps, accumulator: acc };
}
