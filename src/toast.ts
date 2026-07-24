/**
 * トースト通知（依存ゼロ）。
 * 画面右上（デスクトップ）に `.glass` の小型通知を出し、4秒後に自動退場させる。
 * `#toast-container` は初回呼び出し時に遅延生成する。
 */

export type ToastType = "success" | "error" | "info";

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 4;
const CONTAINER_ID = "toast-container";
const OUT_ANIMATION_MS = 200; // CSS側の --t-med と合わせる

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

let container: HTMLElement | null = null;

/** `#toast-container` を取得する。存在しなければ lazy 生成する。 */
function getContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;

  const el = document.createElement("div");
  el.id = CONTAINER_ID;
  el.className = "toast-container";
  el.setAttribute("aria-live", "polite");
  document.body.appendChild(el);
  container = el;
  return el;
}

/** トースト1件をフェードアウトさせてから DOM から取り除く（二重実行は無視する）。 */
function dismiss(toast: HTMLElement): void {
  if (toast.dataset.dismissing === "true") return;
  toast.dataset.dismissing = "true";

  const timerId = toast.dataset.timerId;
  if (timerId) window.clearTimeout(Number(timerId));

  toast.classList.remove("toast-in");
  toast.classList.add("toast-out");
  window.setTimeout(() => toast.remove(), OUT_ANIMATION_MS);
}

/** message をトースト通知として表示する。type 既定値は "info"。
 *  最大4件までスタックし、超過分は最古のトーストを即座に退場させる。
 *  ホバー中は自動退場タイマーを停止する。type === "error" は role="alert" を付与する。 */
export function showToast(message: string, type: ToastType = "info"): void {
  const host = getContainer();

  const existing = Array.from(host.children) as HTMLElement[];
  if (existing.length >= MAX_TOASTS) {
    const oldest = existing[0];
    if (oldest) dismiss(oldest);
  }

  const toast = document.createElement("div");
  toast.className = `toast glass toast-${type}`;
  if (type === "error") toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <span class="toast-bar" aria-hidden="true"></span>
    <span class="toast-icon" aria-hidden="true">${ICONS[type]}</span>
    <span class="toast-message"></span>
  `;

  const messageEl = toast.querySelector<HTMLElement>(".toast-message");
  if (messageEl) messageEl.textContent = message;

  host.appendChild(toast);

  // 次フレームで .toast-in を付与し、CSSトランジションで右からスライドインさせる
  requestAnimationFrame(() => {
    toast.classList.add("toast-in");
  });

  const scheduleDismiss = (): void => {
    const timerId = window.setTimeout(() => dismiss(toast), AUTO_DISMISS_MS);
    toast.dataset.timerId = String(timerId);
  };
  scheduleDismiss();

  toast.addEventListener("mouseenter", () => {
    const timerId = toast.dataset.timerId;
    if (timerId) window.clearTimeout(Number(timerId));
  });
  toast.addEventListener("mouseleave", () => {
    if (toast.dataset.dismissing === "true") return;
    scheduleDismiss();
  });
}
