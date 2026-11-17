// Tiny versioned save in localStorage. Only the numbers that define a
// campaign live here; the world itself is rebuilt deterministically.
const KEY = 'portoazul-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || d.v !== 1) return null;
    return d;
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), ...data }));
  } catch {
    // Storage full or blocked: the game keeps running without a save.
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
