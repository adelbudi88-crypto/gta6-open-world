// Story campaign — 8 chapters. Chapters 1–5 are the v2.7 campaign; 6–8 are new
// in v2.8. Each mission has a timer, a payout, a home district and a target
// point in the city. Completing a mission pays out, raises respect and opens
// the next chapter. Failing the timer restarts the chapter.
export const MISSIONS = [
  { id: 1, chapter: 'CHAPTER 1/8', name: 'Welcome to Porto Azul', giver: 'Benny', payout: 9500, timer: 300, district: 'TORRE PLAZA', target: [60, -40], desc: 'Benny needs a driver. Pick up the package at Torre Plaza and bring it to the garage — no cops, no questions.' },
  { id: 2, chapter: 'CHAPTER 2/8', name: "Tono's Debt", giver: 'Tono', payout: 14000, timer: 240, district: 'TORRE PLAZA', target: [-70, 60], desc: "Tono owes the wrong people. Collect the cash from the plaza drop, then lose the tail before you reach Benny's." },
  { id: 3, chapter: 'CHAPTER 3/8', name: 'Heat Wave', giver: 'Mara', payout: 19000, timer: 180, district: 'PALMLINE BEACH', target: [90, 90], desc: 'Mara set the meet at the beach. Get there fast — the whole city is hot tonight and the heat is rising.' },
  { id: 4, chapter: 'CHAPTER 4/8', name: 'The Vault Job', giver: 'Benny', payout: 26000, timer: 300, district: 'THE MIRAGE STRIP', target: [-90, -80], desc: 'Benny cased a vault on the Strip. Grab the bag from the courier and walk it out before the guards wake up.' },
  { id: 5, chapter: 'CHAPTER 5/8', name: 'Casino Vault Run', giver: 'Mara', payout: 28500, timer: 240, district: 'THE MIRAGE STRIP', target: [-110, -60], desc: 'The big one on the Strip: crack the casino vault, dodge the guards and the cops, and vanish into the neon.' },
  { id: 6, chapter: 'CHAPTER 6/8', name: 'Harbor Lights', giver: 'Tono', payout: 32000, timer: 240, district: 'HARBOR EAST', target: [120, -110], desc: 'A dock smuggle run at Harbor East. Load the crates onto the boat, keep the dock lights off you, and get paid.' },
  { id: 7, chapter: 'CHAPTER 7/8', name: 'Air One Down', giver: 'Benny', payout: 41000, timer: 300, district: 'THE MIRAGE STRIP', target: [-60, 100], desc: 'Five stars and a helicopter overhead. Lose the chase through the roadblocks and make Air One give up.' },
  { id: 8, chapter: 'CHAPTER 8/8', name: 'The Last Score', giver: 'Mara', payout: 60000, timer: 360, district: 'THE MIRAGE STRIP', target: [-100, -100], desc: 'The finale: one last casino vault heist on the Strip. Everything Benny, Tono and Mara built comes down to this run.' },
];

export function createMissions(world) {
  const m = {
    list: MISSIONS,
    index: world.state.missionIndex || 0,
    active: false,
    timeLeft: 0,
    current() { return MISSIONS[Math.min(this.index, MISSIONS.length - 1)]; },
    start(i) {
      this.index = Math.max(0, Math.min(i, MISSIONS.length - 1));
      this.active = true;
      this.timeLeft = this.current().timer;
      world.state.missionIndex = this.index;
      world.hud.showBanner(this.current().chapter + ': ' + this.current().name, this.current().desc);
      return this.current();
    },
    update(dt) {
      if (!this.active) return;
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.active = false;
        world.hud.showBanner('MISSION FAILED', this.current().name + ' — out of time. Benny is not happy. Try again.');
        world.state.wanted = Math.min(5, world.state.wanted + 1);
      }
    },
    atTarget() {
      const t = this.current().target;
      const p = world.player.pos;
      const dx = p.x - t[0], dz = p.z - t[1];
      return dx * dx + dz * dz < 14 * 14;
    },
    complete() {
      if (!this.active) return false;
      const cur = this.current();
      this.active = false;
      world.state.cash += cur.payout;
      world.state.respect = Math.min(10, world.state.respect + 1);
      if (!world.state.missionsDone.includes(cur.id)) world.state.missionsDone.push(cur.id);
      world.hud.showBanner('MISSION PASSED — $' + cur.payout.toLocaleString('en-US'), cur.name + ' complete. Respect up. Next job is waiting.');
      if (this.index < MISSIONS.length - 1) {
        this.index++;
        world.state.missionIndex = this.index;
        setTimeout(() => { if (!world.frozen) this.start(this.index); }, 2500);
      } else {
        world.hud.showBanner('THE LAST SCORE — DONE', 'Porto Azul is yours, Daz. Every chapter complete.');
      }
      return true;
    },
  };
  return m;
}
