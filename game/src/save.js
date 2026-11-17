// Save / load through localStorage. One slot, versioned: a v2 save carries
// cash, respect, garage upgrades, weapon state and the day counter, and a
// save from an older version is ignored on purpose (its shape changed).
// v2.3: same slot key, version and fields as v2.2, written as a small
// class with the same exported functions on top.
const SLOT_KEY = 'porto-azul-save-v2';
const SLOT_VERSION = 2;

// Every field a save carries, in storage order. saveGame copies exactly
// these keys off the live state object; loadGame hands the record back.
const SAVED_FIELDS = [
  'cash', 'missionIndex', 'x', 'z', 'health', 'armour', 'mag', 'reserve',
  'respect', 'garageEngine', 'garageArmor', 'playSeconds', 'day',
];

class Slot {
  static read() {
    try {
      const raw = localStorage.getItem(SLOT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  static write(record) {
    try {
      localStorage.setItem(SLOT_KEY, JSON.stringify(record));
      return true;
    } catch {
      return false;
    }
  }
  static exists() {
    try {
      return localStorage.getItem(SLOT_KEY) !== null;
    } catch {
      return false;
    }
  }
  static drop() {
    try {
      localStorage.removeItem(SLOT_KEY);
    } catch {
      // storage unavailable (private mode, blocked) — nothing to clear.
    }
  }
}

export function saveGame(state) {
  const record = { v: SLOT_VERSION, savedAt: Date.now() };
  for (const key of SAVED_FIELDS) record[key] = state[key];
  return Slot.write(record);
}

export function loadGame() {
  const record = Slot.read();
  if (!record || record.v !== SLOT_VERSION) return null;
  return record;
}

export function hasSave() {
  return Slot.exists();
}

export function clearSave() {
  Slot.drop();
}

// One-liner for the continue button, e.g. "Day 2 · $1.250 · Misi 3/5".
export function saveSummary(record) {
  if (!record) return '';
  const day = record.day || 1;
  const chapter = Math.min((record.missionIndex ?? 0) + 1, 5);
  const cash = (record.cash ?? 0).toLocaleString('id-ID');
  return `Day ${day} · $${cash} · Misi ${chapter}/5`;
}
