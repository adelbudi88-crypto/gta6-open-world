// Save / load through localStorage. One slot, versioned: a v2 save carries
// cash, respect, garage upgrades, weapon state and the day counter, and a
// save from an older version is ignored on purpose (its shape changed).
const SLOT_KEY = 'porto-azul-save-v2';
const SLOT_VERSION = 2;

// Every field a save carries, in storage order. saveGame copies exactly
// these keys off the live state object; loadGame hands the record back.
const SAVED_FIELDS = [
  'cash', 'missionIndex', 'x', 'z', 'health', 'armour', 'mag', 'reserve',
  'respect', 'garageEngine', 'garageArmor', 'playSeconds', 'day',
];

function readSlot() {
  try {
    const raw = localStorage.getItem(SLOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const record = { v: SLOT_VERSION, savedAt: Date.now() };
    for (const key of SAVED_FIELDS) record[key] = state[key];
    localStorage.setItem(SLOT_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  const record = readSlot();
  if (!record || record.v !== SLOT_VERSION) return null;
  return record;
}

export function hasSave() {
  try {
    return localStorage.getItem(SLOT_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SLOT_KEY);
  } catch {
    // storage unavailable (private mode, blocked) — nothing to clear.
  }
}

// One-liner for the continue button, e.g. "Day 2 · $1.250 · Misi 3/5".
export function saveSummary(record) {
  if (!record) return '';
  const day = record.day || 1;
  const chapter = Math.min((record.missionIndex ?? 0) + 1, 5);
  const cash = (record.cash ?? 0).toLocaleString('id-ID');
  return `Day ${day} · $${cash} · Misi ${chapter}/5`;
}
