// Story campaign: five chapters with Benny, Tono and Mara. Each chapter
// has a banner, a timer, a payout and a destination; finishing one pays
// out cash and advances the story.
export const MISSIONS = [
  { chapter: 1, title: "Benny's First Run", district: 'TORRE PLAZA', payout: 2500, duration: 300, objective: 'Deliver the package to Torre Plaza', dest: [0, 0] },
  { chapter: 2, title: "Tono's Debt", district: 'TORRE PLAZA', payout: 6500, duration: 240, objective: 'Chase down Tono and collect the debt', dest: [20, -30] },
  { chapter: 3, title: 'Heat Wave', district: 'TORRE PLAZA', payout: 9000, duration: 300, objective: 'Lose a 5-star wanted level — survive the heat', dest: [60, 60] },
  { chapter: 4, title: 'The Vault Job', district: 'THE MIRAGE STRIP', payout: 18000, duration: 360, objective: 'Reach the gold vault on the Mirage Strip', dest: [0, -118] },
  { chapter: 5, title: 'Casino Vault Run', district: 'THE MIRAGE STRIP', payout: 25000, duration: 300, objective: 'Hit the Casino Royale vault and escape', dest: [0, -118] },
];

export function createMissions() {
  let index = 0;
  let active = false;
  let timeLeft = 0;
  let banner = '';
  let bannerSub = '';
  let bannerUntil = 0;

  function showBanner(text, sub, seconds) {
    banner = text;
    bannerSub = sub;
    bannerUntil = Date.now() / 1000 + seconds;
  }

  return {
    get missions() { return MISSIONS; },
    get index() { return index; },
    get current() { return MISSIONS[Math.min(index, MISSIONS.length - 1)]; },
    get active() { return active; },
    get timeLeft() { return timeLeft; },
    get banner() { return banner; },
    get bannerSub() { return bannerSub; },
    get bannerVisible() { return Date.now() / 1000 < bannerUntil; },
    start(i) {
      index = Math.max(0, Math.min(MISSIONS.length - 1, i));
      active = true;
      timeLeft = MISSIONS[index].duration;
      const m = MISSIONS[index];
      showBanner(`CHAPTER ${m.chapter}/5: ${m.title.toUpperCase()}`, m.objective.toUpperCase(), 6);
      return m;
    },
    startNext() { return this.start(index); },
    setChapter(i, secondsLeft) {
      index = Math.max(0, Math.min(MISSIONS.length - 1, i));
      active = true;
      timeLeft = secondsLeft ?? MISSIONS[index].duration;
      const m = MISSIONS[index];
      showBanner(`CHAPTER ${m.chapter}/5: ${m.title.toUpperCase()}`, m.objective.toUpperCase(), 6);
    },
    tick(dt) {
      if (!active) return 'idle';
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        active = false;
        showBanner('MISSION FAILED', 'THE CLOCK RAN OUT — TRY AGAIN', 5);
        return 'failed';
      }
      return 'running';
    },
    complete(player) {
      if (!active) return 0;
      active = false;
      const m = MISSIONS[index];
      player.addCash(m.payout);
      showBanner('MISSION COMPLETE', `+$${m.payout.toLocaleString('en-US')} — ${m.title.toUpperCase()}`, 6);
      index = Math.min(index + 1, MISSIONS.length - 1);
      return m.payout;
    },
    fail(reason) {
      active = false;
      showBanner('MISSION FAILED', reason, 5);
    },
    showBanner,
    dest() { return MISSIONS[Math.min(index, MISSIONS.length - 1)].dest; },
  };
}
