// One place for match state: the phase machine (buy → live → round end → match end), the
// round score, and the economy. Nothing here touches the DOM or the renderer; main.js pushes
// events in (round won, kill, plant) and reads the numbers out for the HUD.
import { WEAPON_DEFS, GRENADE_DEFS } from './weapons.js';

export const WIN_ROUNDS = 5;
export const MAX_ROUNDS = 9;
export const ROUND_TIME = 100;
export const BUY_TIME = 12;
export const ROUND_END_TIME = 4;

export const BUY_ITEMS = [
  { key: '1', id: 'vk7', kind: 'weapon', name: 'VK-7 Rifle', desc: '30-rd auto · precise when still', price: WEAPON_DEFS.vk7.price },
  { key: '2', id: 'hornet', kind: 'weapon', name: 'Hornet-9 SMG', desc: '32-rd auto · fast up close', price: WEAPON_DEFS.hornet.price },
  { key: '3', id: 'longbow', kind: 'weapon', name: 'Longbow DMR', desc: '5-rd semi · one-shot headshot', price: WEAPON_DEFS.longbow.price },
  { key: '4', id: 'frag', kind: 'grenade', name: 'Frag Grenade', desc: 'Blast radius 7 m', price: GRENADE_DEFS.frag.price },
  { key: '5', id: 'smoke', kind: 'grenade', name: 'Smoke Grenade', desc: 'Blocks sight for 14 s', price: GRENADE_DEFS.smoke.price },
  { key: '6', id: 'kevlar', kind: 'armor', name: 'Kevlar Vest', desc: 'Absorbs half of damage', price: 650 },
  { key: '7', id: 'p9ammo', kind: 'ammo', name: 'P9 Ammo Refill', desc: 'Full reserve for the sidearm', price: 200 },
];

export function createMatchState() {
  const state = {
    phase: 'buy', // buy | live | roundEnd | matchEnd
    phaseTime: BUY_TIME,
    round: 1,
    scoreVan: 0,
    scoreCin: 0,
    money: 800,
    kills: 0,
    deaths: 0,
    plants: 0,
    defuses: 0,
    roundWinner: null,
    roundReason: '',
    matchWinner: null,
    attackSite: 'A',
  };

  return {
    state,
    reset() {
      state.phase = 'buy';
      state.phaseTime = BUY_TIME;
      state.round = 1;
      state.scoreVan = 0;
      state.scoreCin = 0;
      state.money = 800;
      state.kills = 0;
      state.deaths = 0;
      state.plants = 0;
      state.defuses = 0;
      state.roundWinner = null;
      state.roundReason = '';
      state.matchWinner = null;
      state.attackSite = 'A';
    },
    startRound() {
      state.phase = 'live';
      state.phaseTime = ROUND_TIME;
      state.roundWinner = null;
      state.roundReason = '';
      state.attackSite = state.round % 2 === 1 ? 'A' : 'B';
    },
    endRound(winner, reason) {
      state.phase = 'roundEnd';
      state.phaseTime = ROUND_END_TIME;
      state.roundWinner = winner;
      state.roundReason = reason;
      if (winner === 'van') state.scoreVan += 1;
      else state.scoreCin += 1;
      state.money += winner === 'van' ? 3250 : 1900;
      if (state.scoreVan >= WIN_ROUNDS || state.scoreCin >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
        state.matchWinner = state.scoreVan > state.scoreCin ? 'van' : state.scoreCin > state.scoreVan ? 'cin' : null;
        state.phase = 'matchEnd';
        state.phaseTime = 0;
      }
    },
    nextRound() {
      state.round += 1;
      state.phase = 'buy';
      state.phaseTime = BUY_TIME;
    },
    addKillReward() {
      state.money += 300;
      state.kills += 1;
    },
    addPlantReward() {
      state.money += 300;
      state.plants += 1;
    },
    buy(item, owned) {
      if (state.phase !== 'buy') return { ok: false, reason: 'The buy phase is over.' };
      if (state.money < item.price) return { ok: false, reason: 'Not enough money.' };
      if (item.kind === 'weapon' && owned[item.id]) return { ok: false, reason: 'Already owned.' };
      if (item.kind === 'armor' && owned.kevlar) return { ok: false, reason: 'Kevlar already worn.' };
      state.money -= item.price;
      return { ok: true };
    },
  };
}
