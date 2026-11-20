// Save system — localStorage, one slot. Saves cash, respect, mission progress,
// garage upgrades, best wanted level survived and the player's last car.
const KEY = 'porto-azul-28-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
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
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone.slice(),
      upgrades: { ...state.upgrades },
      bestWanted: state.bestWanted,
      car: state.playerCar,
      day: state.day,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function hasSave() {
  return loadSave() !== null;
}
