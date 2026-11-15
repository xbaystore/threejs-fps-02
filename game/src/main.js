// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the display's rate.
// main.js owns the rules that bind the modules: the ray behind every shot, the round flow,
// planting and defusing, the frag blast, and the score. The modules own their own numbers.
// ?shot=start|play|plant|end with &seed=N sets up a deterministic frame for a capture,
// renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE, ATMOSPHERE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createBody, createMover } from './mover.js';
import { createWeapons, WEAPON_DEFS, GRENADE_DEFS } from './weapons.js';
import { createBots } from './bots.js';
import { createBomb, PLANT_TIME, DEFUSE_TIME } from './bomb.js';
import { createMatchState, BUY_ITEMS, ROUND_TIME, BUY_TIME } from './state.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Filmic tone mapping is what makes the dusk read as dusk: highlights from the furnace
// and the lamps roll off instead of clipping to white, and the shadows keep their colour.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// The sky dome in world.js paints the background; this colour only shows for the first
// frames and matches the fog so the blend is invisible.
scene.background = new THREE.Color(ATMOSPHERE.fog);
scene.fog = new THREE.Fog(new THREE.Color(ATMOSPHERE.fog), ATMOSPHERE.fogNear, ATMOSPHERE.fogFar);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const audio = createAudio();
const world = createWorld(scene);
const mover = createMover(world.colliders);
const hud = createHud();
const match = createMatchState();
const bomb = createBomb(scene);
const input = createInput(renderer.domElement, onLockChange);
const weapons = createWeapons(camera, scene, world.colliders, audio, onFragExplode, onSmokeSpawn);

const playerBody = createBody(0, 14, 0);
const player = {
  body: playerBody,
  name: 'You',
  health: 100,
  armor: 0,
  kevlar: false,
  alive: true,
  survivedLastRound: true,
};

// The player's hitbox: bots shoot a ray at this invisible box, never at the camera.
const playerHitbox = new THREE.Mesh(
  new THREE.BoxGeometry(0.68, 1.72, 0.68),
  new THREE.MeshBasicMaterial({ visible: false }),
);
playerHitbox.userData.player = true;
scene.add(playerHitbox);

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const direction = new THREE.Vector3();
const tracerMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.7 });
const tracers = [];
let shake = 0;
let elapsed = 0;
let frozen = false;
let started = false;
let buyOpen = false;
let stepSoundAt = 0;
let plantHeld = 0;
const markerHoldMs = shot ? 4000 : 90;

const bots = createBots(scene, world, mover, world.shootables, random, {
  resolveBotShot,
  onBotFired,
  smokeBlocks,
});

const shootables = world.shootables.concat(bots.hitMeshes(), playerHitbox);
let botHitMeshes = bots.hitMeshes();

hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
hud.setWeapon(weapons.def().name);
hud.setHealth(player.health, player.armor);
hud.setMoney(match.state.money);
hud.setScore(0, 0);
hud.setRound(1);
hud.setObjective('A');
hud.onPlay(() => {
  if (shot) return;
  if (match.state.phase === 'matchEnd') restartMatch();
  audio.unlock();
  input.requestLock();
});
hud.onBuy((item) => buyItem(item));

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    buyOpen = false;
    hud.hideBuy();
    hud.hideOverlay();
  } else if (!buyOpen && match.state.phase !== 'matchEnd') {
    hud.showOverlay(started ? 'paused' : 'start');
  }
}

function restartMatch() {
  match.reset();
  player.survivedLastRound = true;
  weapons.resetLoadout();
  setupRound();
  hud.setScore(0, 0);
  hud.setMoney(match.state.money);
  hud.setRound(1);
  hud.setObjective(match.state.attackSite);
}

function setupRound() {
  const site = bots.resetRound(match.state.round);
  botHitMeshes = bots.hitMeshes();
  shootables.length = 0;
  shootables.push(...world.shootables, ...botHitMeshes, playerHitbox);
  bomb.clear();
  weapons.clearProjectiles();
  match.state.attackSite = site;
  match.state.phase = 'buy';
  match.state.phaseTime = BUY_TIME;
  respawnPlayer();
  hud.setRound(match.state.round);
  hud.setObjective(site);
  hud.setBombStatus('');
  hud.setPlantBar(false, '', 0);
  hud.setDeathNote(false);
  hud.setHint('Buy phase — press B to buy, then the round starts.');
}

function respawnPlayer() {
  const [x, z] = world.spawns.van[0];
  playerBody.position.set(x, 0, z);
  playerBody.velocity.set(0, 0, 0);
  playerBody.yaw = 0;
  playerBody.pitch = 0;
  player.health = 100;
  player.armor = player.kevlar ? 100 : 0;
  player.alive = true;
  if (!player.survivedLastRound) weapons.resetLoadout();
  else weapons.refill();
  weapons.equip('p9');
  if (weapons.inventory.owned.vk7) weapons.equip('vk7');
  else if (weapons.inventory.owned.hornet) weapons.equip('hornet');
  else if (weapons.inventory.owned.longbow) weapons.equip('longbow');
  player.survivedLastRound = true;
  syncCamera();
}

function syncCamera() {
  camera.position.set(playerBody.position.x, playerBody.position.y + playerBody.eye, playerBody.position.z);
  camera.rotation.set(playerBody.pitch, playerBody.yaw, 0, 'YXZ');
  if (shake > 0) {
    camera.rotation.x += (random() * 2 - 1) * shake * 0.02;
    camera.rotation.y += (random() * 2 - 1) * shake * 0.02;
  }
  playerHitbox.position.set(playerBody.position.x, playerBody.position.y + 0.86, playerBody.position.z);
}

function aimAt(point) {
  const dx = point.x - playerBody.position.x;
  const dy = point.y - (playerBody.position.y + playerBody.eye);
  const dz = point.z - playerBody.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  playerBody.yaw = Math.atan2(-dx, -dz);
  playerBody.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function spawnTracer(from, to) {
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geometry, tracerMaterial.clone());
  scene.add(line);
  tracers.push({ line, life: 0.07 });
}

function stepTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const tracer = tracers[i];
    tracer.life -= dt;
    tracer.line.material.opacity = Math.max(0, tracer.life / 0.07) * 0.7;
    if (tracer.life <= 0) {
      scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

// A shot ray: the first thing it meets decides the outcome — world stops it, a bot takes
// damage (headshots pay more, far shots pay less through damageAt), the player takes damage
// from a bot's ray.
function resolveShot(origin, dir, damageAt, headMult, shooterTeam, shooterName) {
  scene.updateMatrixWorld(true);
  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(shootables, false);
  for (const hit of hits) {
    const object = hit.object;
    if (object.userData.bot) {
      const bot = object.userData.bot;
      if (!bot.alive) continue;
      if (bot.team === shooterTeam) continue;
      const part = object.userData.part;
      const amount = Math.round(damageAt(hit.distance) * (part === 'head' ? headMult : 1));
      const killed = bots.damage(bot, amount);
      if (shooterTeam === 'van') {
        hud.hitMarker(killed, markerHoldMs);
        audio.hit(killed);
        if (killed) {
          match.addKillReward();
          hud.addKillFeed(shooterName, bot.name, part === 'head', 'van', 'cin');
          hud.setMoney(match.state.money);
        }
      }
      if (killed) onBotKilled(bot, shooterTeam, shooterName);
      return { point: hit.point, hit: 'bot', killed, bot };
    }
    if (object.userData.player) {
      if (shooterTeam === 'van') return { point: hit.point, hit: 'self' };
      damagePlayer(damageAt(hit.distance), shooterName);
      return { point: hit.point, hit: 'player' };
    }
    return { point: hit.point, hit: 'world' };
  }
  return { point: origin.clone().addScaledVector(dir, 60), hit: 'none' };
}

function resolveBotShot(bot, origin, dir, damage, headMult) {
  const result = resolveShot(origin, dir, () => damage, headMult, bot.team, bot.name);
  if (result.hit !== 'none') spawnTracer(origin, result.point);
}

function playerShoot(spread) {
  if (!weapons.takeRound()) {
    audio.dryFire();
    return;
  }
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  const origin = camera.position.clone();
  const result = resolveShot(origin, direction, (distance) => weapons.damageAt(distance), weapons.def().headMult, 'van', 'You');
  spawnTracer(origin.clone().addScaledVector(direction, 0.8), result.point);
  weapons.pullTrigger();
  playerBody.pitch = Math.min(1.45, playerBody.pitch + 0.009 + random() * 0.004);
  playerBody.yaw += (random() * 2 - 1) * 0.004;
  bots.hearShot(playerBody.position, 'van');
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
}

function damagePlayer(amount, attackerName) {
  if (!player.alive) return;
  let remaining = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, Math.round(amount * 0.5));
    player.armor -= absorbed;
    remaining -= absorbed;
  }
  player.health -= remaining;
  hud.flashDamage();
  audio.hurt();
  hud.setHealth(player.health, player.armor);
  if (player.health <= 0) {
    player.alive = false;
    player.survivedLastRound = false;
    player.health = 0;
    match.state.deaths += 1;
    hud.setDeathNote(true);
    hud.setHint('');
    if (attackerName) hud.addKillFeed(attackerName, 'You', false, 'cin', 'van');
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

function onBotKilled(bot, killerTeam, killerName) {
  if (killerTeam === 'cin' && bot.team === 'van') {
    hud.addKillFeed(killerName, bot.name, false, 'cin', 'van');
  }
}

function onBotFired(bot, origin) {
  const distance = camera.position.distanceTo(origin);
  if (distance > 4 && distance < 40) audio.distantShot();
}

function onFragExplode(position) {
  audio.explosion();
  shake = 1;
  const radius = GRENADE_DEFS.frag.radius;
  const victims = [{ body: playerBody, isPlayer: true, alive: player.alive }];
  for (const bot of bots.bots) victims.push({ body: bot.body, isPlayer: false, alive: bot.alive, bot });
  for (const victim of victims) {
    if (!victim.alive) continue;
    const target = new THREE.Vector3(victim.body.position.x, victim.body.position.y + 1.0, victim.body.position.z);
    const distance = position.distanceTo(target);
    if (distance > radius) continue;
    const eye = new THREE.Vector3(position.x, position.y + 0.2, position.z);
    raycaster.set(eye, target.clone().sub(eye).normalize());
    raycaster.far = distance;
    if (raycaster.intersectObjects(world.shootables, false).length > 0) continue;
    const amount = Math.round(GRENADE_DEFS.frag.maxDamage * (1 - (distance / radius) * 0.7));
    if (victim.isPlayer) damagePlayer(amount, 'Frag');
    else {
      const killed = bots.damage(victim.bot, amount);
      if (killed) {
        match.addKillReward();
        hud.addKillFeed('You', victim.bot.name, false, 'van', 'cin');
        hud.setMoney(match.state.money);
        onBotKilled(victim.bot, 'van', 'You');
      }
    }
  }
}

function onSmokeSpawn(position) {
  weapons.spawnSmoke(position);
}

function smokeBlocks(a, b) {
  for (const smoke of weapons.smokeList()) {
    const center = smoke.mesh.position;
    const radius = smoke.mesh.scale.x;
    const ab = new THREE.Vector3().subVectors(b, a);
    const t = Math.max(0, Math.min(1, new THREE.Vector3().subVectors(center, a).dot(ab) / ab.lengthSq()));
    const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    if (closest.distanceTo(center) < radius) return true;
  }
  return false;
}

function buyItem(item) {
  const owned = { ...weapons.inventory.owned, kevlar: player.kevlar };
  const result = match.buy(item, owned);
  if (!result.ok) {
    hud.setHint(result.reason);
    return;
  }
  if (item.kind === 'weapon') {
    weapons.give(item.id);
    weapons.equip(item.id);
  } else if (item.kind === 'grenade') {
    weapons.inventory.grenades[item.id] += 1;
  } else if (item.kind === 'armor') {
    player.kevlar = true;
    player.armor = 100;
  } else if (item.kind === 'ammo') {
    weapons.inventory.owned.p9.reserve = WEAPON_DEFS.p9.reserveAmmo;
  }
  audio.buy();
  hud.setMoney(match.state.money);
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
  hud.setWeapon(weapons.def().name);
  hud.setGrenades(weapons.inventory.grenades.frag, weapons.inventory.grenades.smoke);
  hud.setHealth(player.health, player.armor);
  hud.showBuy(true, { ...weapons.inventory.owned, kevlar: player.kevlar }, match.state.money);
}

function endRound(winner, reason) {
  const wasLive = match.state.phase === 'live';
  void wasLive;
  match.endRound(winner, reason);
  bomb.clear();
  weapons.clearProjectiles();
  const win = winner === 'van';
  hud.showBanner(win, win ? 'ROUND WON' : 'ROUND LOST', reason, 3400);
  hud.setBombStatus('');
  hud.setPlantBar(false, '', 0);
  hud.setScore(match.state.scoreVan, match.state.scoreCin);
  if (match.state.phase === 'matchEnd') {
    if (match.state.matchWinner === 'van') audio.roundWin();
    else audio.roundLose();
    hud.showOverlay(match.state.matchWinner === 'van' ? 'endWin' : 'endLose');
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (win) {
    audio.roundWin();
  } else {
    audio.roundLose();
  }
}

function checkRoundEnd() {
  if (match.state.phase !== 'live') return;
  const vanAlive = (player.alive ? 1 : 0) + bots.aliveCount('van');
  const cinAlive = bots.aliveCount('cin');
  if (bomb.state.status === 'planted') {
    if (bomb.state.fuseLeft <= 0) {
      endRound('van', 'The ember charge detonated.');
      return;
    }
    if (bomb.state.defuseProgress >= DEFUSE_TIME) {
      endRound('cin', 'Cinder defused the charge.');
      return;
    }
  }
  if (cinAlive === 0) {
    endRound('van', bomb.state.status === 'planted' ? 'Cinder eliminated after the plant.' : 'Cinder eliminated.');
    return;
  }
  if (vanAlive === 0) {
    endRound('cin', 'Vanguard eliminated.');
  }
}

function step(dt) {
  elapsed += dt;
  shake = Math.max(0, shake - dt * 2.2);
  world.update(elapsed);
  stepTracers(dt);

  const phase = match.state.phase;
  match.state.phaseTime -= dt;

  if (phase === 'buy') {
    if (match.state.phaseTime <= 0) {
      match.startRound();
      hud.setHint('Plant the charge at the marked site — hold E inside the ring.');
      hud.hideBuy();
      buyOpen = false;
    }
  } else if (phase === 'live') {
    if (match.state.phaseTime <= 0 && bomb.state.status !== 'planted') {
      endRound('cin', 'Time expired — the charge was never planted.');
    }
  } else if (phase === 'roundEnd') {
    if (match.state.phaseTime <= 0) {
      match.nextRound();
      setupRound();
    }
  }

  if (phase === 'live' || phase === 'buy') {
    // Movement only while the player is alive and the game is not paused by the overlay.
    if (player.alive && started) {
      const keys = input.state.keys;
      const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const sin = Math.sin(playerBody.yaw);
      const cos = Math.cos(playerBody.yaw);
      mover.step(
        playerBody, dt,
        -sin * forward + cos * strafe,
        -cos * forward - sin * strafe,
        keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC'),
        keys.has('Space'),
      );
      const speed = mover.groundSpeed(playerBody);
      if (speed > 3 && elapsed - stepSoundAt > 0.34) {
        stepSoundAt = elapsed;
        audio.step();
      }
    }
    weapons.step(dt, mover.groundSpeed(playerBody));
    const bombState = { ...bomb.state, position: bomb.group.position };
    bots.step(dt, elapsed, player, bombState);

    // Planting: hold E inside a site ring while the charge is idle.
    if (phase === 'live' && player.alive && bomb.state.status !== 'planted') {
      const keys = input.state.keys;
      let siteKey = null;
      for (const key of ['A', 'B']) {
        const site = world.sites[key];
        if (Math.hypot(playerBody.position.x - site.center.x, playerBody.position.z - site.center.z) < site.radius) siteKey = key;
      }
      if (siteKey && keys.has('KeyE')) {
        plantHeld += dt;
        hud.setPlantBar(true, `PLANTING CHARGE — SITE ${siteKey}`, Math.min(1, plantHeld / PLANT_TIME));
        if (plantHeld >= PLANT_TIME) {
          const site = world.sites[siteKey];
          bomb.place(siteKey, new THREE.Vector3(site.center.x, 0, site.center.z));
          match.addPlantReward();
          hud.setMoney(match.state.money);
          hud.setPlantBar(false, '', 0);
          hud.setBombStatus(`CHARGE PLANTED — SITE ${siteKey}`);
          hud.setHint('Defend the charge. Cinder will retake the site.');
          audio.plantTick(true);
          plantHeld = 0;
        }
      } else {
        if (plantHeld > 0) hud.setPlantBar(false, '', 0);
        plantHeld = 0;
      }
    }

    // Defusing: a Cinder bot standing at the planted charge works it, second by second.
    if (bomb.state.status === 'planted') {
      let defuser = null;
      for (const bot of bots.bots) {
        if (bot.team !== 'cin' || !bot.alive) continue;
        const distance = Math.hypot(bot.body.position.x - bomb.group.position.x, bot.body.position.z - bomb.group.position.z);
        if (distance < 1.7) defuser = bot;
      }
      if (defuser) {
        bomb.state.defuseProgress += dt;
        bomb.state.defuser = defuser;
        hud.setPlantBar(true, 'CINDER IS DEFUSING', Math.min(1, bomb.state.defuseProgress / DEFUSE_TIME));
        if (Math.floor(bomb.state.defuseProgress * 2) !== Math.floor((bomb.state.defuseProgress - dt) * 2)) audio.defuseTick();
      } else {
        bomb.state.defuseProgress = Math.max(0, bomb.state.defuseProgress - dt * 0.5);
        bomb.state.defuser = null;
        hud.setPlantBar(false, '', 0);
      }
      bomb.step(dt, elapsed, (urgent) => audio.plantTick(urgent));
      const fuseLeft = Math.max(0, Math.ceil(bomb.state.fuseLeft));
      hud.setBombStatus(`CHARGE PLANTED — detonates in ${fuseLeft}s`);
    }
    checkRoundEnd();
  }

  // HUD numbers, every step.
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
  hud.setWeapon(weapons.def().name);
  hud.setGrenades(weapons.inventory.grenades.frag, weapons.inventory.grenades.smoke);
  hud.setHealth(player.health, player.armor);
  hud.setMoney(match.state.money);
  hud.setScore(match.state.scoreVan, match.state.scoreCin);
  hud.setAlive((player.alive ? 1 : 0) + bots.aliveCount('van'), bots.aliveCount('cin'));
  if (phase === 'live' && bomb.state.status === 'planted') {
    hud.setTimer(bomb.state.fuseLeft, 'live');
  } else {
    hud.setTimer(match.state.phaseTime, phase);
  }
  hud.setCrosshairSpread(weapons.spread(mover.groundSpeed(playerBody)));
}

function frame(now) {
  requestAnimationFrame(frame);
  frameCount += 1;
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (player.alive) {
      playerBody.yaw -= look.x * 0.0022;
      playerBody.pitch = Math.max(-1.45, Math.min(1.45, playerBody.pitch - look.y * 0.0022));
    }
    const pressed = input.takePressed();
    handlePressed(pressed);
    const trigger = weapons.def().auto ? input.state.firing : input.peekTriggerEdge();
    if (trigger && player.alive && match.state.phase === 'live' && weapons.ready()) {
      if (!weapons.def().auto) input.clearTriggerEdge();
      playerShoot(shot ? 0 : weapons.spread(mover.groundSpeed(playerBody)));
    }
    if (input.state.keys.has('KeyR') && player.alive) weapons.reload();
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

function handlePressed(pressed) {
  if (pressed.size === 0) return;
  if (buyOpen) {
    for (const code of pressed) {
      if (code.startsWith('Digit')) {
        const item = BUY_ITEMS.find((entry) => entry.key === code.slice(5));
        if (item) buyItem(item);
      }
    }
    if (pressed.has('KeyB') || pressed.has('Escape')) {
      buyOpen = false;
      hud.hideBuy();
      if (started) input.requestLock();
    }
    return;
  }
  if (pressed.has('KeyB') && match.state.phase === 'buy') {
    buyOpen = true;
    hud.showBuy(true, { ...weapons.inventory.owned, kevlar: player.kevlar }, match.state.money);
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  if (!player.alive || match.state.phase !== 'live') return;
  if (pressed.has('Digit1') && weapons.inventory.owned.vk7) weapons.equip('vk7');
  if (pressed.has('Digit2') && weapons.inventory.owned.hornet) weapons.equip('hornet');
  if (pressed.has('Digit3') && weapons.inventory.owned.longbow) weapons.equip('longbow');
  if (pressed.has('Digit4')) {
    camera.getWorldDirection(direction);
    const origin = camera.position.clone().addScaledVector(direction, 0.5);
    origin.y -= 0.1;
    if (weapons.throwGrenade('frag', origin, direction.clone())) {
      hud.setGrenades(weapons.inventory.grenades.frag, weapons.inventory.grenades.smoke);
    }
  }
  if (pressed.has('Digit5')) {
    camera.getWorldDirection(direction);
    const origin = camera.position.clone().addScaledVector(direction, 0.5);
    origin.y -= 0.1;
    if (weapons.throwGrenade('smoke', origin, direction.clone())) {
      hud.setGrenades(weapons.inventory.grenades.frag, weapons.inventory.grenades.smoke);
    }
  }
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  started = true;
  match.state.phase = 'live';
  match.state.phaseTime = ROUND_TIME;
  bots.resetRound(1);
  botHitMeshes = bots.hitMeshes();
  shootables.length = 0;
  shootables.push(...world.shootables, ...botHitMeshes, playerHitbox);
  hud.setRound(1);
  hud.setObjective('A');
  playerBody.pitch = 0;
  playerBody.yaw = Math.PI;
  if (name === 'start') {
    playerBody.position.set(0.6, 0, 13.6);
    settle(20);
    // The menu shot looks straight down mid: lane lines, the kiln, the gantry lamp and
    // the dusk sky stacked in one frame behind the title panel. The capture lightens
    // the overlay's dim so the map sells itself behind the menu; the live game's menu
    // keeps its heavier dim for readability.
    aimAt(new THREE.Vector3(-0.5, 1.7, -8.6));
    hud.showOverlay('start');
    document.getElementById('overlay').style.background = 'color-mix(in srgb, var(--canvas) 58%, transparent)';
    hud.setHint('');
  } else if (name === 'play') {
    weapons.give('vk7');
    weapons.equip('vk7');
    match.state.money = 2450;
    playerBody.position.set(-7.4, 0, 2);
    settle(20);
    // First blood already happened down this lane: Ash is down in the open (the kill
    // feed tells that story), and the frozen frame is the NEXT shot — crosshair on Soot
    // across mid, muzzle flash lit, tracer in the air, hitmarker up. A screenshot of a
    // firefight, not of a pose.
    const fallen = bots.bots.find((bot) => bot.team === 'cin' && bot.name === 'Ash');
    if (fallen) {
      fallen.alive = false;
      fallen.health = 0;
      fallen.fall = 1;
      fallen.body.position.set(-7.4, 0, -8);
      fallen.mesh.group.position.set(-7.4, 0, -8);
      fallen.mesh.group.rotation.x = -1.45;
      hud.addKillFeed('You', 'Ash', true, 'van', 'cin');
      match.state.kills = 1;
    }
    const next = bots.bots.find((bot) => bot.team === 'cin' && bot.alive && bot.name === 'Soot');
    if (next) {
      next.body.position.set(-7.4, 0, -12);
      next.mesh.group.position.set(-7.4, 0, -12);
      next.body.yaw = Math.atan2(-(playerBody.position.x - -7.4), -(playerBody.position.z - -12));
      next.mesh.group.rotation.y = next.body.yaw;
    }
    const ally = bots.bots.find((bot) => bot.team === 'van' && bot.name === 'Kestrel');
    if (ally) {
      ally.body.position.set(-11, 0, -5);
      ally.mesh.group.position.set(-11, 0, -5);
      ally.body.yaw = Math.atan2(-(playerBody.position.x - -11), -(playerBody.position.z - -5));
      ally.mesh.group.rotation.y = ally.body.yaw;
    }
    aimAt(new THREE.Vector3(-7.4, 1.2, -12));
    // Fire the frozen shot LAST: no settle after it, so the flash, the kick and the
    // tracer are all still alive when the frame is painted. step(0) syncs the flash
    // mesh and light to the just-fired state without decaying anything.
    playerShoot(0);
    weapons.step(0);
    match.state.phaseTime = 62;
    hud.setTimer(62, 'live');
    hud.setHint('');
  } else if (name === 'plant') {
    weapons.give('vk7');
    weapons.equip('vk7');
    playerBody.position.set(-10.6, 0, -6.2);
    settle(20);
    bomb.place('A', new THREE.Vector3(-13, 0, -9.5));
    bomb.state.fuseLeft = 27;
    hud.setBombStatus('CHARGE PLANTED — detonates in 27s');
    hud.setTimer(27, 'live');
    const defender = bots.bots.find((bot) => bot.team === 'cin' && bot.name === 'Ember');
    if (defender) {
      defender.body.position.set(-12.6, 0, -12.6);
      defender.mesh.group.position.set(-12.6, 0, -12.6);
      defender.body.yaw = Math.atan2(-(playerBody.position.x - -12.6), -(playerBody.position.z - -12.6));
      defender.mesh.group.rotation.y = defender.body.yaw;
    }
    // A second defender pushes in past the furnace mouth, backlit by its glow: the
    // retake is coming and the screenshot says so.
    const second = bots.bots.find((bot) => bot.team === 'cin' && bot.name === 'Flint');
    if (second) {
      second.body.position.set(-16.5, 0, -6.5);
      second.mesh.group.position.set(-16.5, 0, -6.5);
      second.body.yaw = Math.atan2(-(playerBody.position.x - -16.5), -(playerBody.position.z - -6.5));
      second.mesh.group.rotation.y = second.body.yaw;
    }
    const ally = bots.bots.find((bot) => bot.team === 'van' && bot.name === 'Bram');
    if (ally) {
      ally.body.position.set(-8.6, 0, -3.6);
      ally.mesh.group.position.set(-8.6, 0, -3.6);
      ally.body.yaw = Math.atan2(-(-13 - -8.6), -(-9.5 - -3.6));
      ally.mesh.group.rotation.y = ally.body.yaw;
    }
    aimAt(new THREE.Vector3(-13, 0.5, -9.5));
    match.state.phaseTime = 27;
    hud.setHint('');
  } else if (name === 'end') {
    match.state.scoreVan = 1;
    match.state.scoreCin = 0;
    match.state.round = 2;
    for (const bot of bots.bots) {
      if (bot.team === 'cin') {
        bot.alive = false;
        bot.fall = 1;
        bot.mesh.group.rotation.x = -1.45;
      }
    }
    const fallen = bots.bots.find((bot) => bot.name === 'Ash');
    if (fallen) {
      fallen.body.position.set(4, 0, -4);
      fallen.mesh.group.position.set(4, 0, -4);
    }
    playerBody.position.set(2, 0, 3);
    settle(20);
    aimAt(new THREE.Vector3(4, 0.8, -4));
    hud.setScore(1, 0);
    hud.setRound(2);
    hud.showBanner(true, 'ROUND WON', 'Cinder eliminated.', 60000);
    hud.setHint('');
  }
  hud.setScore(match.state.scoreVan, match.state.scoreCin);
  hud.setAmmo(weapons.ammo().mag, weapons.ammo().reserve);
  hud.setHealth(player.health, player.armor);
  hud.setMoney(match.state.money);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug handle for play-testing: move the player, read the match, force a round.
window.__game = {
  state: match.state,
  player,
  bots,
  bomb,
  weapons,
  world,
  teleport(x, z, yaw = 0) {
    playerBody.position.set(x, 0, z);
    playerBody.yaw = yaw;
    playerBody.pitch = 0;
    syncCamera();
  },
  lookAt(x, y, z) {
    aimAt(new THREE.Vector3(x, y, z));
  },
  startRoundNow() {
    match.state.phaseTime = 0;
  },
  skipBuy() {
    match.state.phaseTime = 0.01;
  },
  keys() {
    return [...input.state.keys];
  },
  plantHeld() {
    return plantHeld;
  },
  frameCount() {
    return frameCount;
  },
};

let accumulator = 0;
let lastTime = performance.now();
let frameCount = 0;

syncCamera();
setupRound();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
