// Save / load via localStorage. One slot, versioned.
const KEY = 'porto-azul-save-v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      savedAt: Date.now(),
      cash: state.cash,
      missionIndex: state.missionIndex,
      x: state.x,
      z: state.z,
      health: state.health,
      ammo: state.ammo,
      playSeconds: state.playSeconds,
    }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.v !== 1) return null;
    return d;
  } catch { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch {}
}
