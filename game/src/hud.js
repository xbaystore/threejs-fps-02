// The DOM HUD: health, armour, ammo, money, the round timer and score, the kill feed, the
// buy menu and the round banners. It never touches the simulation; main.js pushes numbers
// in and reads the play callback out. Every setter is cheap-guarded so the DOM is only
// written when a value actually changes. The polish lives here and in index.html's CSS:
// money pulses when it moves, a kill holds its hitmarker longer than a hit, the kill feed
// names the weapon, and the top bar always says whose round it is.
import { BUY_ITEMS } from './state.js';

const COPY = {
  start: {
    title: '<span class="ember">EMBERLINE</span>',
    copy: 'A tactical round-based shooter in the Kestrel Foundry. Plant the ember charge at Site A or Site B, or wipe out Cinder. First to 5 rounds takes the match.',
    action: 'Click to play',
  },
  paused: {
    title: '<span class="ember">EMBERLINE</span>',
    copy: 'Paused. Click to resume — the round keeps its timer.',
    action: 'Click to resume',
  },
  endWin: {
    title: '<span class="ember">EMBERLINE</span>',
    copy: 'Vanguard takes the match. The foundry is yours.',
    action: 'Play again',
  },
  endLose: {
    title: '<span class="ember">EMBERLINE</span>',
    copy: 'Cinder takes the match. Run it back.',
    action: 'Play again',
  },
};

// The kill feed's weapon glyphs: one compact mark per way of dying, so a feed line can
// be read at a glance in a screenshot without a legend.
const WEAPON_GLYPHS = {
  headshot: '◉',
  frag: '✸',
  gun: '✕',
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const ammo = $('ammo');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const grenadesEl = $('grenades');
  const healthValue = $('health-value');
  const healthFill = $('health-fill');
  const armorValue = $('armor-value');
  const moneyEl = $('money');
  const timerEl = $('timer');
  const roundLabel = $('round-label');
  const aliveEl = $('alive');
  const scoreVan = $('score-van');
  const scoreCin = $('score-cin');
  const killfeed = $('killfeed');
  const bombStatus = $('bomb-status');
  const plantBar = $('plant-bar');
  const plantFill = plantBar.querySelector('.fill');
  const plantLabel = plantBar.querySelector('.label');
  const banner = $('banner');
  const bannerTitle = banner.querySelector('h2');
  const bannerCopy = banner.querySelector('p');
  const hitmarker = $('hitmarker');
  const crosshair = $('crosshair');
  const vignette = $('vignette');
  const hint = $('hint');
  const deathNote = $('death-note');
  const buyMenu = $('buy-menu');
  const buyGrid = $('buy-grid');
  const buyMoney = $('buy-money');
  const buyRound = $('buy-round');
  const objective = $('objective');

  let hitTimer = 0;
  let moneyTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastHealth = -1;
  let lastArmor = -1;
  let lastMoney = -1;
  let lastTimer = '';
  let lastPhase = '';
  let lastScore = '';
  let lastWeapon = '';
  let lastGrenades = '';
  let lastAlive = '';
  let lastObjective = '';
  let bannerTimer = 0;

  const buyButtons = BUY_ITEMS.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'buy-item';
    button.innerHTML = `<span class="key">${item.key}</span><span class="name">${item.name}</span><span class="desc">${item.desc}</span><span class="price">$${item.price}</span>`;
    buyGrid.appendChild(button);
    return { item, button, tag: button.querySelector('.price') };
  });

  return {
    setAmmo(mag, reserve) {
      if (mag === lastMag && reserve === lastReserve) return;
      lastMag = mag;
      lastReserve = reserve;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      ammo.classList.toggle('empty', mag === 0);
      ammo.classList.toggle('low', mag > 0 && mag <= 5);
    },
    setWeapon(name) {
      if (name === lastWeapon) return;
      lastWeapon = name;
      weaponName.textContent = name;
    },
    setGrenades(frag, smoke) {
      const text = `FRAG ${frag} · SMOKE ${smoke}`;
      if (text === lastGrenades) return;
      lastGrenades = text;
      grenadesEl.textContent = text;
    },
    setHealth(health, armor) {
      if (health === lastHealth && armor === lastArmor) return;
      lastHealth = health;
      lastArmor = armor;
      healthValue.textContent = String(Math.max(0, Math.ceil(health)));
      healthFill.style.width = `${Math.max(0, Math.min(100, health))}%`;
      healthFill.classList.toggle('low', health <= 30);
      armorValue.textContent = armor > 0 ? `ARMOR ${Math.ceil(armor)}` : '';
    },
    setMoney(value) {
      if (value === lastMoney) return;
      const increased = lastMoney >= 0 && value > lastMoney;
      lastMoney = value;
      moneyEl.innerHTML = `$${value} <small>press B to buy</small>`;
      buyMoney.textContent = `$${value}`;
      // A reward landing is good news the player should feel: one soft pulse, no noise
      // when money is spent — spending has its own buy sound.
      if (increased) {
        moneyEl.classList.remove('gain');
        void moneyEl.offsetWidth;
        moneyEl.classList.add('gain');
        clearTimeout(moneyTimer);
        moneyTimer = setTimeout(() => moneyEl.classList.remove('gain'), 650);
      }
    },
    setTimer(seconds, phase) {
      const total = Math.max(0, Math.ceil(seconds));
      const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
      if (text !== lastTimer) {
        lastTimer = text;
        timerEl.textContent = text;
        timerEl.classList.toggle('low', phase === 'live' && total <= 15);
      }
      if (phase !== lastPhase) {
        lastPhase = phase;
        if (phase === 'buy') roundLabel.textContent = 'BUY PHASE';
        else if (phase === 'roundEnd') roundLabel.textContent = 'ROUND OVER';
        else if (phase === 'matchEnd') roundLabel.textContent = 'MATCH OVER';
      }
    },
    setRound(round) {
      roundLabel.textContent = `ROUND ${round}`;
      buyRound.textContent = String(round);
    },
    setScore(van, cin) {
      const text = `${van}:${cin}`;
      if (text === lastScore) return;
      lastScore = text;
      scoreVan.textContent = String(van);
      scoreCin.textContent = String(cin);
    },
    setAlive(van, cin) {
      const text = `VAN ${van} · CIN ${cin} alive`;
      if (text === lastAlive) return;
      lastAlive = text;
      aliveEl.textContent = text;
    },
    setObjective(site) {
      const text = `Plant the ember charge at Site ${site} — or the other site if it is covered. Eliminate Cinder or detonate the charge to win the round.`;
      if (text === lastObjective) return;
      lastObjective = text;
      objective.textContent = text;
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.classList.remove('kill');
      }, killed ? Math.max(holdMs, 220) : holdMs);
    },
    setCrosshairSpread(spread) {
      const gap = Math.round(3 + spread * 900);
      crosshair.style.setProperty('--gap', `${gap}px`);
      crosshair.style.width = `${22 + gap * 2}px`;
      crosshair.style.height = `${22 + gap * 2}px`;
    },
    flashDamage() {
      vignette.classList.add('on');
      setTimeout(() => vignette.classList.remove('on'), 140);
    },
    addKillFeed(killer, victim, headshot, killerTeam, victimTeam, viaFrag = false) {
      const div = document.createElement('div');
      const glyph = viaFrag ? WEAPON_GLYPHS.frag : headshot ? WEAPON_GLYPHS.headshot : WEAPON_GLYPHS.gun;
      div.innerHTML = `<span class="${killerTeam}">${killer}</span> <span class="glyph">${glyph}</span> <span class="${victimTeam}">${victim}</span>`;
      if (headshot) div.classList.add('headshot-line');
      killfeed.prepend(div);
      while (killfeed.children.length > 5) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => div.remove(), 6000);
    },
    setBombStatus(text) {
      if (text) {
        bombStatus.textContent = text;
        bombStatus.classList.add('show');
      } else {
        bombStatus.classList.remove('show');
      }
    },
    setPlantBar(show, label, progress) {
      plantBar.classList.toggle('show', show);
      if (!show) return;
      plantLabel.textContent = label;
      plantFill.style.width = `${Math.round(progress * 100)}%`;
    },
    showBanner(win, titleText, subText, holdMs = 3200) {
      bannerTitle.textContent = titleText;
      bannerCopy.textContent = subText;
      banner.className = win ? 'win show' : 'lose show';
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('show'), holdMs);
    },
    hideBanner() {
      banner.classList.remove('show');
    },
    setHint(text) {
      hint.textContent = text;
    },
    setDeathNote(show) {
      deathNote.classList.toggle('show', show);
    },
    showOverlay(mode) {
      const text = COPY[mode];
      title.innerHTML = text.title;
      copy.textContent = text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    showBuy(canBuy, owned, money) {
      buyMenu.classList.add('show');
      buyMoney.textContent = `$${money}`;
      for (const { item, button, tag } of buyButtons) {
        const isOwned = (item.kind === 'weapon' && owned[item.id]) || (item.kind === 'armor' && owned.kevlar);
        const affordable = money >= item.price;
        button.disabled = !canBuy || !affordable || isOwned;
        button.classList.toggle('owned', Boolean(isOwned));
        button.classList.toggle('poor', !isOwned && !affordable);
        tag.textContent = isOwned ? 'OWNED' : `$${item.price}`;
        tag.className = isOwned ? 'owned' : 'price';
      }
    },
    hideBuy() {
      buyMenu.classList.remove('show');
    },
    onBuy(handler) {
      for (const { item, button } of buyButtons) {
        button.addEventListener('click', () => handler(item));
      }
    },
    buyVisible() {
      return buyMenu.classList.contains('show');
    },
  };
}
