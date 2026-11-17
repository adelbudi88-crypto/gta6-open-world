// Save / load for Porto Azul II. Progress autosaves to localStorage after
// every mission; a failed parse or a disabled store just starts a new game.
const KEY = 'porto-azul-ii-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: Math.floor(state.cash),
      missionIndex: state.missionIndex,
      respect: state.respect,
      upgrades: state.upgrades,
      day: state.day,
      bestCash: Math.floor(state.bestCash),
    }));
  } catch {
    // Storage off (private window): the session just does not persist.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
