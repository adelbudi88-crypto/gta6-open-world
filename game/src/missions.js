// 12 story missions. Chapters 1-8 keep the v2.8 arc; 9-11 are new; 12 is the
// reworked 3-stage finale "The Last Score".
export const MISSIONS = [
  { num: 1, name: 'FIRST LIGHT', district: 'TORRE PLAZA', payout: 8000, timer: 300, type: 'delivery', objective: "Reach Benny's Garage", briefing: 'Benny needs a driver. Get to the garage.' },
  { num: 2, name: "TONO'S DEBT", district: 'TORRE PLAZA', payout: 12000, timer: 240, type: 'chase', objective: 'Lose the tail, reach Tono', briefing: 'Tono owes the wrong people. Drive him clear.' },
  { num: 3, name: 'HEAT WAVE', district: 'PALMLINE BEACH', payout: 15000, timer: 300, type: 'escape', objective: 'Escape the beach lockdown', briefing: 'Cops swept the beach. Break the cordon.' },
  { num: 4, name: 'THE VAULT JOB', district: 'THE MIRAGE STRIP', payout: 21000, timer: 360, type: 'heist', objective: 'Crack the back-room safe', briefing: 'A quiet casino keeps loud money. Take it.' },
  { num: 5, name: 'CASINO VAULT RUN', district: 'THE MIRAGE STRIP', payout: 26000, timer: 300, type: 'vault', objective: 'Grab the vault cash, get out', briefing: 'The Strip never sleeps. Neither do its guards.' },
  { num: 6, name: 'HARBOR LIGHTS', district: 'HARBOR EAST', payout: 32000, timer: 300, type: 'smuggle', objective: 'Move the crates to the dock', briefing: 'Crates in, questions out. Run the harbor.' },
  { num: 7, name: 'AIR ONE DOWN', district: 'OLD TOWN', payout: 41000, timer: 360, type: 'escape', objective: 'Lose a 5-star chase', briefing: 'Every cop in Porto Azul is on you. Vanish.' },
  { num: 8, name: 'CASINO ROYALE', district: 'THE MIRAGE STRIP', payout: 60000, timer: 360, type: 'heist', objective: 'Hit the Royale, vanish in the crowd', briefing: 'The biggest room on the Strip. One night only.' },
  { num: 9, name: 'STREET KINGS', district: 'TORRE PLAZA', payout: 35000, timer: 240, type: 'race', objective: 'Win the 3-lap street race', briefing: 'Tono wired the Comet GT with nitro. Prove it.' },
  { num: 10, name: 'DOCK ORDERS', district: 'HARBOR EAST', payout: 28000, timer: 300, type: 'delivery', objective: 'Finish 3 dock deliveries in a row', briefing: 'Three drops, no mistakes, harbor pays.' },
  { num: 11, name: 'TURF WAR', district: 'THE MIRAGE STRIP', payout: 44000, timer: 300, type: 'shootout', objective: 'Take the Strip turf from the gang', briefing: 'The Strip belongs to whoever holds it. Hold it.' },
  { num: 12, name: 'THE LAST SCORE', district: 'THE MIRAGE STRIP', payout: 75000, timer: 420, type: 'finale', objective: 'Vault, chase, boat escape', briefing: 'One last score. Vault, chase, open water.', stages: ['STAGE 1/3 — CASINO VAULT', 'STAGE 2/3 — FIVE-STAR CHASE', 'STAGE 3/3 — BOAT ESCAPE'] },
];

export function createMissions(state) {
  return {
    list: MISSIONS,
    current: MISSIONS[0],
    stage: 0,
    timer: MISSIONS[0].timer,
    done: 0,
    start(num) {
      const m = MISSIONS[num - 1];
      if (!m) return null;
      this.current = m;
      this.stage = 0;
      this.timer = m.timer;
      state.missionNum = m.num;
      state.missionName = m.name;
      state.missionObjective = m.objective;
      state.missionTimer = m.timer;
      state.missionPayout = m.payout;
      state.missionDistrict = m.district;
      return m;
    },
    stageLabel() {
      const m = this.current;
      if (m.stages) return m.stages[this.stage] || '';
      return '';
    },
    nextStage() {
      const m = this.current;
      if (m.stages && this.stage < m.stages.length - 1) {
        this.stage += 1;
        return true;
      }
      return false;
    },
    complete(stateApi) {
      const m = this.current;
      state.cash += m.payout;
      this.done += 1;
      stateApi.turf.gain(m.district);
      state.missionsDone = this.done;
      state.respect = Math.min(10, 1 + Math.floor(this.done / 2));
      if (this.done < 12) this.start(this.done + 1);
      return m;
    },
    tick(dt) {
      if (state.frozen) return;
      this.timer = Math.max(0, this.timer - dt);
      state.missionTimer = this.timer;
    },
  };
}
