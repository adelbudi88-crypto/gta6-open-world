// Story campaign for Porto Azul II — 5 chapters with Benny, Tono and Mara.
export const MISSIONS = [
  {
    chapter: 'CHAPTER 1/5', title: 'First Wheels', giver: 'BENNY',
    desc: 'Steal the Comet GT from Torre Plaza and bring it to Benny\'s Garage.',
    payout: 2500, duration: 300, target: { x: -30, z: -46 }, targetName: "BENNY'S GARAGE",
  },
  {
    chapter: 'CHAPTER 2/5', title: "Tono's Debt", giver: 'TONO',
    desc: 'Tono owes the Plaza crew $18,450. Outrun the collectors and reach the garage.',
    payout: 6000, duration: 240, target: { x: -30, z: -46 }, targetName: "BENNY'S GARAGE",
  },
  {
    chapter: 'CHAPTER 3/5', title: 'Heat Wave', giver: 'MARA',
    desc: 'MOST WANTED. Lose the helicopter and the pursuit cars across Torre Plaza.',
    payout: 9000, duration: 180, target: { x: 0, z: -80 }, targetName: 'TORRE PLAZA',
  },
  {
    chapter: 'CHAPTER 4/5', title: 'The Vault Job', giver: 'BENNY',
    desc: 'Case the Casino Royale vault on the Mirage Strip. Cops are already watching.',
    payout: 15000, duration: 300, target: { x: 60, z: 54 }, targetName: 'CASINO ROYALE VAULT',
  },
  {
    chapter: 'CHAPTER 5/5', title: 'Casino Vault Run', giver: 'MARA',
    desc: 'Hit the vault, grab $48,500 and escape the Mirage Strip lockdown.',
    payout: 25000, duration: 240, target: { x: 60, z: 54 }, targetName: 'CASINO ROYALE VAULT',
  },
];

export class MissionManager {
  constructor() {
    this.index = 0;
    this.timer = MISSIONS[0].duration;
    this.bannerUntil = 0;
    this.completed = 0;
  }

  get current() {
    return MISSIONS[Math.min(this.index, MISSIONS.length - 1)];
  }

  get finished() {
    return this.index >= MISSIONS.length;
  }

  startBanner(now) {
    this.bannerUntil = now + 4;
  }

  update(dt, now, state) {
    if (this.finished) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      // Timer ran out: mission failed, retry it with a fresh timer.
      this.timer = this.current.duration;
      state.cash = Math.max(0, state.cash - 500);
    }
  }

  complete(state, now) {
    if (this.finished) return 0;
    const payout = this.current.payout;
    state.cash += payout;
    state.respect = Math.min(5, state.respect + 1);
    this.completed += 1;
    this.index += 1;
    if (!this.finished) {
      this.timer = this.current.duration;
      this.startBanner(now);
    }
    return payout;
  }

  // Seconds -> "M:SS".
  static fmt(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
