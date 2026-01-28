import { GameState } from './engine';

const STORAGE_KEY_PREFIX = 'easy-cities-2d-';
const SAVE_SLOTS = 3;

export class StorageManager {
  // セーブスロットにゲーム状態を保存
  saveGame(slotIndex: number, state: GameState): boolean {
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS) return false;

    const key = `${STORAGE_KEY_PREFIX}save-${slotIndex}`;
    const data = {
      timestamp: Date.now(),
      state,
    };

    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`✅ Game saved to slot ${slotIndex}`);
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  }

  // セーブスロットからゲーム状態を読み込み
  loadGame(slotIndex: number): GameState | null {
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS) return null;

    const key = `${STORAGE_KEY_PREFIX}save-${slotIndex}`;

    try {
      const data = localStorage.getItem(key);
      if (!data) {
        console.log(`❌ No save data in slot ${slotIndex}`);
        return null;
      }

      const parsed = JSON.parse(data);
      console.log(`✅ Game loaded from slot ${slotIndex}`);
      return parsed.state;
    } catch (e) {
      console.error('Load failed:', e);
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

      const parsed = JSON.parse(data);
      return {
        timestamp: parsed.timestamp,
        population: parsed.state.population,
        money: parsed.state.money,
      };
    } catch (e) {
      return null;
    }
  }

  // JSONファイルにエクスポート
  exportToJSON(state: GameState): string {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      gameState: state,
    };
    return JSON.stringify(exportData, null, 2);
  }

  // JSONファイルからインポート
  importFromJSON(jsonString: string): GameState | null {
    try {
      const data = JSON.parse(jsonString);
      if (!data.gameState) return null;
      return data.gameState;
    } catch (e) {
      console.error('Import failed:', e);
      return null;
    }
  }

  // 設定をCookieに保存
  saveSettings(settings: Record<string, any>): void {
    const key = `${STORAGE_KEY_PREFIX}settings`;
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.error('Settings save failed:', e);
    }
  }

  // Cookieから設定を読み込み
  loadSettings(): Record<string, any> {
    const key = `${STORAGE_KEY_PREFIX}settings`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }
}
