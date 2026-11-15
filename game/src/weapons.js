// Weapons: four hitscan guns and two grenades. Each definition owns its numbers — damage,
// magazine, fire rate, reload, spread — and the module owns the view models, the reload
// timer, the muzzle flash and the grenade projectiles. main.js owns the ray and the damage;
// this module never decides who was hit.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPON_DEFS = {
  p9: {
    id: 'p9', name: 'P9 SIDEARM', price: 0, damage: 34, headMult: 2.5, magSize: 12,
    reserveAmmo: 48, fireGap: 0.16, auto: false, reloadTime: 1.4,
    spreadStill: 0.004, spreadMoving: 0.03, falloffStart: 18, falloffEnd: 46, kind: 'pistol',
  },
  vk7: {
    id: 'vk7', name: 'VK-7 RIFLE', price: 2700, damage: 34, headMult: 3, magSize: 30,
    reserveAmmo: 90, fireGap: 0.105, auto: true, reloadTime: 2.0,
    spreadStill: 0.0022, spreadMoving: 0.028, falloffStart: 22, falloffEnd: 60, kind: 'rifle',
  },
  hornet: {
    id: 'hornet', name: 'HORNET-9 SMG', price: 1500, damage: 26, headMult: 3, magSize: 32,
    reserveAmmo: 96, fireGap: 0.07, auto: true, reloadTime: 1.7,
    spreadStill: 0.006, spreadMoving: 0.035, falloffStart: 12, falloffEnd: 34, kind: 'smg',
  },
  longbow: {
    id: 'longbow', name: 'LONGBOW DMR', price: 4100, damage: 88, headMult: 3.5, magSize: 5,
    reserveAmmo: 20, fireGap: 0.9, auto: false, reloadTime: 2.6,
    spreadStill: 0.0008, spreadMoving: 0.04, falloffStart: 26, falloffEnd: 80, kind: 'dmr',
  },
};

export const GRENADE_DEFS = {
  frag: { id: 'frag', name: 'FRAG GRENADE', price: 300, fuse: 1.6, radius: 7, maxDamage: 110 },
  smoke: { id: 'smoke', name: 'SMOKE GRENADE', price: 300, fuse: 1.4, radius: 4.5, duration: 14 },
};

const MUZZLE_TIME = 0.06;

function buildViewModel(def) {
  const grip = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7, metalness: 0.25 });
  const body = new THREE.MeshStandardMaterial({ color: 0xd8cfbc, roughness: 0.5, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.2,
  });
  const group = new THREE.Group();
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  if (def.id === 'p9') {
    add(new THREE.BoxGeometry(0.05, 0.09, 0.26), body, 0, 0, -0.1);
    add(new THREE.BoxGeometry(0.045, 0.12, 0.06), grip, 0, -0.08, 0.04);
    add(new THREE.BoxGeometry(0.02, 0.02, 0.05), accent, 0, 0.055, -0.2);
  } else if (def.id === 'vk7') {
    add(new THREE.BoxGeometry(0.09, 0.1, 0.44), body, 0, 0, -0.1);
    add(new THREE.BoxGeometry(0.045, 0.045, 0.42), grip, 0, 0.025, -0.5);
    add(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip, 0, -0.02, 0.2);
    add(new THREE.BoxGeometry(0.06, 0.05, 0.12), grip, 0, 0.06, -0.28);
    add(new THREE.BoxGeometry(0.02, 0.02, 0.3), accent, 0, 0.06, -0.12);
  } else if (def.id === 'hornet') {
    add(new THREE.BoxGeometry(0.08, 0.09, 0.3), body, 0, 0, -0.08);
    add(new THREE.BoxGeometry(0.04, 0.04, 0.3), grip, 0, 0.02, -0.36);
    add(new THREE.BoxGeometry(0.05, 0.16, 0.06), grip, 0, -0.1, -0.02);
    add(new THREE.BoxGeometry(0.07, 0.07, 0.1), grip, 0, -0.01, 0.14);
    add(new THREE.BoxGeometry(0.02, 0.02, 0.2), accent, 0, 0.05, -0.1);
  } else {
    add(new THREE.BoxGeometry(0.08, 0.09, 0.52), body, 0, 0, -0.14);
    add(new THREE.BoxGeometry(0.04, 0.04, 0.46), grip, 0, 0.02, -0.58);
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10), grip, 0, 0.09, -0.2).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.07, 0.08, 0.2), grip, 0, -0.02, 0.2);
    add(new THREE.BoxGeometry(0.02, 0.02, 0.36), accent, 0, 0.055, -0.16);
  }
  group.position.set(0.26, -0.22, -0.45);
  group.scale.setScalar(0.8);
  group.visible = false;
  return group;
}

export function createWeapons(camera, scene, colliders, audio, onFrag, onSmoke) {
  const models = {};
  for (const def of Object.values(WEAPON_DEFS)) {
    const model = buildViewModel(def);
    camera.add(model);
    models[def.id] = model;
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const inventory = {
    owned: { p9: { mag: WEAPON_DEFS.p9.magSize, reserve: WEAPON_DEFS.p9.reserveAmmo } },
    current: 'p9',
    grenades: { frag: 0, smoke: 0 },
  };
  const state = { cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, reloadDef: null };
  const projectiles = [];
  const smokes = [];
  const grenadeGeometry = new THREE.SphereGeometry(0.09, 10, 8);
  const grenadeMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.6, metalness: 0.5 });
  const smokeGeometry = new THREE.SphereGeometry(1, 18, 12);
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0x9a938a, transparent: true, opacity: 0.5, depthWrite: false });

  function def() {
    return WEAPON_DEFS[inventory.current];
  }
  function ammo() {
    return inventory.owned[inventory.current];
  }

  function equip(id) {
    if (!inventory.owned[id] || state.reloadLeft > 0) return false;
    inventory.current = id;
    for (const key of Object.keys(models)) models[key].visible = key === id;
    state.cooldown = Math.max(state.cooldown, 0.15);
    return true;
  }

  function give(id) {
    if (inventory.owned[id]) {
      inventory.owned[id].reserve = WEAPON_DEFS[id].reserveAmmo;
      return;
    }
    inventory.owned[id] = { mag: WEAPON_DEFS[id].magSize, reserve: WEAPON_DEFS[id].reserveAmmo };
  }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[inventory.current];
    model.position.z = -0.45 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (state.reloadDef.reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = state.reloadDef.magSize - ammo().mag;
        const take = Math.min(need, ammo().reserve);
        ammo().mag += take;
        ammo().reserve -= take;
      }
    }
    // Grenade projectiles: gravity, a floor bounce, and a fuse.
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const p = projectiles[i];
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const pos = p.mesh.position;
      if (pos.y < 0.1) {
        pos.y = 0.1;
        p.vel.y = Math.abs(p.vel.y) * 0.45;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      for (const box of colliders) {
        if (pos.x > box.min.x && pos.x < box.max.x && pos.y > box.min.y && pos.y < box.max.y && pos.z > box.min.z && pos.z < box.max.z) {
          p.vel.multiplyScalar(-0.4);
          pos.addScaledVector(p.vel, dt * 2);
          break;
        }
      }
      p.fuse -= dt;
      if (p.fuse <= 0) {
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
        if (p.kind === 'frag') onFrag(pos.clone());
        else onSmoke(pos.clone());
      }
    }
    // Smoke clouds grow, hang, then fade.
    for (let i = smokes.length - 1; i >= 0; i -= 1) {
      const s = smokes[i];
      s.left -= dt;
      const age = GRENADE_DEFS.smoke.duration - s.left;
      const target = Math.min(1, age / 1.2) * GRENADE_DEFS.smoke.radius;
      s.mesh.scale.setScalar(Math.max(0.1, target));
      s.mesh.material.opacity = s.left < 3 ? 0.5 * (s.left / 3) : 0.5;
      if (s.left <= 0) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        smokes.splice(i, 1);
      }
    }
  }

  return {
    inventory,
    state,
    def,
    ammo,
    equip,
    give,
    step,
    ready() {
      return ammo().mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = def().fireGap;
      state.flash = MUZZLE_TIME;
      state.kick = def().id === 'longbow' ? 0.09 : 0.055;
      audio.shot(def().kind);
    },
    takeRound() {
      if (ammo().mag <= 0) return false;
      ammo().mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || ammo().mag === def().magSize || ammo().reserve === 0) return;
      state.reloadLeft = def().reloadTime;
      state.reloadDef = def();
      audio.reload();
    },
    spread(speed) {
      const d = def();
      return d.spreadStill + Math.min(1, speed / 5.2) * d.spreadMoving + state.kick * 0.35;
    },
    damageAt(distance) {
      const d = def();
      if (distance <= d.falloffStart) return d.damage;
      if (distance >= d.falloffEnd) return Math.round(d.damage * 0.55);
      const t = (distance - d.falloffStart) / (d.falloffEnd - d.falloffStart);
      return Math.round(d.damage * (1 - 0.45 * t));
    },
    refill() {
      for (const id of Object.keys(inventory.owned)) {
        inventory.owned[id].mag = WEAPON_DEFS[id].magSize;
        inventory.owned[id].reserve = WEAPON_DEFS[id].reserveAmmo;
      }
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
    resetLoadout() {
      inventory.owned = { p9: { mag: WEAPON_DEFS.p9.magSize, reserve: WEAPON_DEFS.p9.reserveAmmo } };
      inventory.current = 'p9';
      inventory.grenades = { frag: 0, smoke: 0 };
      for (const key of Object.keys(models)) models[key].visible = key === 'p9';
    },
    throwGrenade(kind, origin, direction) {
      if (inventory.grenades[kind] <= 0) return false;
      inventory.grenades[kind] -= 1;
      const mesh = new THREE.Mesh(grenadeGeometry, grenadeMaterial);
      mesh.position.copy(origin);
      scene.add(mesh);
      projectiles.push({
        kind,
        mesh,
        vel: direction.clone().multiplyScalar(13).add(new THREE.Vector3(0, 4.5, 0)),
        fuse: GRENADE_DEFS[kind].fuse,
      });
      audio.grenadePin();
      return true;
    },
    spawnSmoke(position) {
      const mesh = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());
      mesh.position.set(position.x, 1.4, position.z);
      mesh.scale.setScalar(0.1);
      scene.add(mesh);
      smokes.push({ mesh, left: GRENADE_DEFS.smoke.duration });
    },
    smokeList() {
      return smokes;
    },
    clearProjectiles() {
      for (const p of projectiles) scene.remove(p.mesh);
      projectiles.length = 0;
      for (const s of smokes) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
      }
      smokes.length = 0;
    },
  };
}
