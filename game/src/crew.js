// Crew abilities: Benny (garage upgrades, passive), Tono (nitro), Mara (EMP).
export function createCrew() {
  return {
    nitroCharges: 3,
    nitroMax: 3,
    nitroActive: false,
    empState: 'ready', // ready | active | cooldown
    empTimer: 0,
    upgrades: { engine: 1, armour: 1 },
    // Nitro: hold Shift while driving. Burns one charge per burst, refills at the garage.
    useNitro(state) {
      if (this.nitroCharges <= 0 || !state.driving) return false;
      this.nitroActive = true;
      return true;
    },
    releaseNitro() { this.nitroActive = false; },
    spendNitroCharge() {
      if (this.nitroCharges > 0) this.nitroCharges -= 1;
    },
    refillNitro() { this.nitroCharges = this.nitroMax; },
    // EMP: press X. Disables police in a radius for 8s, 60s cooldown, $500 a use.
    useEmp(state) {
      if (this.empState !== 'ready') return false;
      if (state.cash < 500) return false;
      state.cash -= 500;
      this.empState = 'active';
      this.empTimer = 8;
      return true;
    },
    tick(dt) {
      if (this.empState === 'active') {
        this.empTimer -= dt;
        if (this.empTimer <= 0) { this.empState = 'cooldown'; this.empTimer = 60; }
      } else if (this.empState === 'cooldown') {
        this.empTimer -= dt;
        if (this.empTimer <= 0) { this.empState = 'ready'; this.empTimer = 0; }
      }
    },
    empLabel() {
      if (this.empState === 'ready') return 'EMP READY';
      if (this.empState === 'active') return 'EMP ACTIVE ' + Math.ceil(this.empTimer) + 's';
      return 'EMP ' + Math.ceil(this.empTimer) + 's';
    },
    // Garage: engine +1 level ($5,000), armour refill ($1,000), nitro refill (free).
    buyEngine(state) {
      if (state.cash < 5000 || this.upgrades.engine >= 5) return false;
      state.cash -= 5000;
      this.upgrades.engine += 1;
      return true;
    },
    buyArmour(state) {
      if (state.cash < 1000 || state.armour >= 100) return false;
      state.cash -= 1000;
      state.armour = 100;
      return true;
    },
  };
}
