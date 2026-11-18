// Save system: progress, cash and garage upgrades persist in localStorage.
// Every call is guarded so a missing/blocked storage never breaks the game.
const KEY = 'porto-azul-ii-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      respect: state.respect,
      chapter: state.chapter,
      upgrades: state.upgrades,
      day: state.day,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
