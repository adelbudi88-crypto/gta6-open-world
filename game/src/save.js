// Save system: 3 slots in localStorage.
const KEY = (slot) => 'portoazul2_save_' + slot;

export function saveGame(slot, state) {
  try {
    const data = {
      cash: state.cash,
      missionNum: state.missionNum,
      respect: state.respect,
      health: state.health,
      armour: state.armour,
      turf: state.turfStanding,
      nitroCharges: state.crew?.nitroCharges ?? 3,
      day: state.day,
      clock: state.clock,
      missionsDone: state.missionsDone,
      sideJobsDone: state.sideJobsDone,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY(slot), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function slotInfo() {
  return [1, 2, 3].map((s) => {
    const d = loadGame(s);
    return { slot: s, data: d };
  });
}
