// Repeatable side jobs: taxi fares, dock deliveries, 6-car street races.
// Each pays cash and raises turf standing in the job's district.
export const SIDE_JOBS = [
  { kind: 'taxi', label: 'TAXI FARE', district: 'OLD TOWN', payout: 900, timer: 150, objective: 'Drop the fare in Old Town' },
  { kind: 'dock', label: 'DOCK DELIVERY', district: 'HARBOR EAST', payout: 1400, timer: 180, objective: 'Deliver crates to the east dock' },
  { kind: 'race', label: 'STREET RACE', district: 'TORRE PLAZA', payout: 2500, timer: 240, objective: 'Finish 1st of 6 in the street race' },
];

export function createSideJobs(state, turf) {
  return {
    active: null, // {job, timer, racePos}
    raceLap: 0,
    start(kind) {
      const job = SIDE_JOBS.find((j) => j.kind === kind);
      if (!job || this.active) return null;
      this.active = { job, timer: job.timer, racePos: kind === 'race' ? 6 : null };
      state.sideJob = job.label;
      state.sideJobTimer = job.timer;
      return this.active;
    },
    tick(dt) {
      if (!this.active || state.frozen) return;
      this.active.timer = Math.max(0, this.active.timer - dt);
      state.sideJobTimer = this.active.timer;
      if (this.active.job.kind === 'race') {
        // Rival pace simulation: position drifts with the player's speed.
        const spd = state.speedKmh || 0;
        if (spd > 130 && this.active.racePos > 1 && Math.random() < dt * 0.25) this.active.racePos -= 1;
        if (spd < 60 && this.active.racePos < 6 && Math.random() < dt * 0.2) this.active.racePos += 1;
        state.racePos = this.active.racePos;
      }
      if (this.active.timer <= 0) this.fail();
    },
    complete() {
      if (!this.active) return null;
      const job = this.active.job;
      const won = job.kind !== 'race' || this.active.racePos === 1;
      const payout = won ? job.payout : Math.floor(job.payout / 4);
      state.cash += payout;
      turf.gain(job.district);
      state.sideJobsDone = (state.sideJobsDone || 0) + 1;
      this.active = null;
      state.sideJob = null;
      state.racePos = null;
      return { job, payout, won };
    },
    fail() {
      this.active = null;
      state.sideJob = null;
      state.racePos = null;
    },
  };
}
