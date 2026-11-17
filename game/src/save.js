// Save / load via localStorage. One slot, versioned (v2: cash, respect,
// garage upgrades, weapon state, day). A v1 save is ignored on purpose.
const KEY = 'porto-azul-save-v2';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 2,
      savedAt: Date.now(),
      cash: state.cash,
      missionIndex: state.missionIndex,
      x: state.x,
      z: state.z,
      health: state.health,
      armour: state.armour,
      mag: state.mag,
      reserve: state.reserve,
      respect: state.respect,
      garageEngine: state.garageEngine,
      garageArmor: state.garageArmor,
      playSeconds: state.playSeconds,
      day: state.day,
    }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.v !== 2) return null;
    return d;
  } catch { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch {}
}

// Human summary for the start screen ("LANJUTKAN — Day 2 · $1.250 · Misi 3/5").
export function saveSummary(d) {
  if (!d) return '';
  const day = d.day || 1;
  const mission = Math.min((d.missionIndex ?? 0) + 1, 5);
  return `Day ${day} · $${(d.cash ?? 0).toLocaleString('id-ID')} · Misi ${mission}/5`;
}
