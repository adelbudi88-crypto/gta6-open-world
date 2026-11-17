// The Porto Azul II campaign: 5 story chapters with Benny, Tono and Mara.
// Each mission has a target spot, a timer and a payout; finishing one pays
// cash, raises respect and opens the next chapter.
export const MISSIONS = [
  {
    chapter: 'CHAPTER 1/5', title: "BENNY'S ERRAND", short: "Benny's Errand",
    objective: 'Deliver the package to Torre Plaza — reach the gold marker',
    time: 300, payout: 2500, target: 'torrePlaza',
    brief: 'Benny trusts you with the package. Do not open it. Do not be late.',
  },
  {
    chapter: 'CHAPTER 2/5', title: "TONO'S DEBT", short: "Tono's Debt",
    objective: 'Collect the cash from Tono — reach the gold marker',
    time: 270, payout: 6000, target: 'strip',
    brief: 'Tono owes Benny six grand and thinks the Strip hides him. It does not.',
  },
  {
    chapter: 'CHAPTER 3/5', title: 'HEAT WAVE', short: 'Heat Wave',
    objective: 'Lose the heat — reach Benny\'s Garage with 5 stars on you',
    time: 180, payout: 9000, target: 'garage',
    brief: 'Every cop in Porto Azul is on you. Make it to the garage anyway.',
  },
  {
    chapter: 'CHAPTER 4/5', title: 'THE VAULT JOB', short: 'The Vault Job',
    objective: 'Reach the Casino Royale vault — Mara is waiting inside',
    time: 298, payout: 15000, target: 'casinoVault',
    brief: 'Mara has the vault codes. Get to the Royale before the shift changes.',
  },
  {
    chapter: 'CHAPTER 5/5', title: 'CASINO VAULT RUN', short: 'Casino Vault Run',
    objective: 'Escape the Mirage Strip lockdown — reach Harbor East',
    time: 105, payout: 25000, target: 'harbor',
    brief: 'The vault is open, the alarms are screaming. Run, Daz. Run.',
  },
];

export function missionTitle(index) {
  const m = MISSIONS[index];
  return m ? m.chapter + ': ' + m.title : 'FREE ROAM';
}
