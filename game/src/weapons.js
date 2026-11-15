// Weapons: four hitscan guns and two grenades. Each definition owns its numbers — damage,
// magazine, fire rate, reload, spread, and how hard the gun kicks — and the module owns
// the view models, the reload timer, the muzzle flash and the grenade projectiles.
// main.js owns the ray and the damage; this module never decides who was hit. The view
// models are built to be read in a screenshot: a clear silhouette per gun, a two-plane
// star flash with a hot core, and a kick that climbs, rolls and settles like weight.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPON_DEFS = {
  p9: {
    id: 'p9', name: 'P9 SIDEARM', price: 0, damage: 34, headMult: 2.5, magSize: 12,
    reserveAmmo: 48, fireGap: 0.16, auto: false, reloadTime: 1.4,
    spreadStill: 0.004, spreadMoving: 0.03, falloffStart: 18, falloffEnd: 46, kind: 'pistol',
    kick: 0.05, flashScale: 0.8, muzzleZ: -0.42,
  },
  vk7: {
    id: 'vk7', name: 'VK-7 RIFLE', price: 2700, damage: 34, headMult: 3, magSize: 30,
    reserveAmmo: 90, fireGap: 0.105, auto: true, reloadTime: 2.0,
    spreadStill: 0.0022, spreadMoving: 0.028, falloffStart: 22, falloffEnd: 60, kind: 'rifle',
    kick: 0.055, flashScale: 1.0, muzzleZ: -0.78,
  },
  hornet: {
    id: 'hornet', name: 'HORNET-9 SMG', price: 1500, damage: 26, headMult: 3, magSize: 32,
    reserveAmmo: 96, fireGap: 0.07, auto: true, reloadTime: 1.7,
    spreadStill: 0.006, spreadMoving: 0.035, falloffStart: 12, falloffEnd: 34, kind: 'smg',
    kick: 0.04, flashScale: 0.85, muzzleZ: -0.6,
  },
  longbow: {
    id: 'longbow', name: 'LONGBOW DMR', price: 4100, damage: 88, headMult: 3.5, magSize: 5,
    reserveAmmo: 20, fireGap: 0.9, auto: false, reloadTime: 2.6,
    spreadStill: 0.0008, spreadMoving: 0.04, falloffStart: 26, falloffEnd: 80, kind: 'dmr',
    kick: 0.1, flashScale: 1.25, muzzleZ: -0.95,
  },
};

export const GRENADE_DEFS = {
  frag: { id: 'frag', name: 'FRAG GRENADE', price: 300, fuse: 1.6, radius: 7, maxDamage: 110 },
  smoke: { id: 'smoke', name: 'SMOKE GRENADE', price: 300, fuse: 1.4, radius: 4.5, duration: 14 },
};

const MUZZLE_TIME = 0.055;

// One shared material set for every view model: dark polymer, worn steel, and the ember
// accent stripe that ties the guns to the foundry palette.
function viewMaterials() {
  return {
    grip: new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7, metalness: 0.25 }),
    body: new THREE.MeshStandardMaterial({ color: 0xa79b82, roughness: 0.5, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.4, metalness: 0.65 }),
    accent: new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.2,
      emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.35,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xffd9a0, roughness: 0.2, metalness: 0.1,
      emissive: new THREE.Color(0xffb454), emissiveIntensity: 1.4,
    }),
  };
}

function buildViewModel(def, mats) {
  const group = new THREE.Group();
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const tube = (r, len) => new THREE.CylinderGeometry(r, r, len, 10);
  if (def.id === 'p9') {
    // Compact sidearm: slide, frame, beavertail grip, tritium front post.
    add(box(0.05, 0.07, 0.27), mats.body, 0, 0.01, -0.1);
    add(box(0.046, 0.05, 0.24), mats.steel, 0, -0.045, -0.09);
    add(box(0.045, 0.13, 0.06), mats.grip, 0, -0.1, 0.045).rotation.x = 0.18;
    add(box(0.03, 0.03, 0.03), mats.grip, 0, 0.02, 0.055);
    add(box(0.008, 0.025, 0.008), mats.glass, 0, 0.055, -0.21);
    add(box(0.02, 0.015, 0.1), mats.accent, 0, 0.048, -0.08);
  } else if (def.id === 'vk7') {
    // The rifle: receiver, handguard with rail teeth, curved magazine, stock, carry
    // handle with a glass dot sight — the silhouette the screenshots sell.
    add(box(0.085, 0.1, 0.4), mats.body, 0, 0, -0.08);
    add(box(0.07, 0.075, 0.34), mats.grip, 0, -0.005, -0.42);
    for (let i = 0; i < 5; i += 1) add(box(0.075, 0.02, 0.03), mats.steel, 0, 0.045, -0.28 - i * 0.07);
    add(tube(0.021, 0.2), mats.steel, 0, 0.01, -0.66).rotation.x = Math.PI / 2;
    add(box(0.05, 0.05, 0.07), mats.steel, 0, 0.01, -0.76);
    add(box(0.055, 0.17, 0.09), mats.grip, 0, -0.12, -0.12).rotation.x = -0.12;
    add(box(0.045, 0.11, 0.05), mats.grip, 0, -0.09, 0.1).rotation.x = 0.25;
    add(box(0.07, 0.09, 0.2), mats.grip, 0, -0.01, 0.24);
    add(box(0.02, 0.05, 0.16), mats.steel, 0, 0.075, -0.1);
    add(tube(0.032, 0.05), mats.steel, 0, 0.115, -0.18).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.016, 8, 8), mats.glass, 0, 0.115, -0.2);
    add(box(0.02, 0.02, 0.3), mats.accent, 0, 0.055, -0.3);
    add(box(0.088, 0.03, 0.1), mats.accent, 0, -0.06, 0.02);
  } else if (def.id === 'hornet') {
    // The SMG: short and fat — slab body, long suppressor, stick magazine raked forward.
    add(box(0.08, 0.095, 0.3), mats.body, 0, 0, -0.06);
    add(tube(0.035, 0.3), mats.grip, 0, 0.005, -0.36).rotation.x = Math.PI / 2;
    add(box(0.04, 0.2, 0.055), mats.grip, 0, -0.13, -0.08).rotation.x = 0.1;
    add(box(0.045, 0.1, 0.05), mats.grip, 0, -0.08, 0.08).rotation.x = 0.3;
    add(box(0.065, 0.07, 0.12), mats.grip, 0, -0.01, 0.17);
    add(box(0.012, 0.03, 0.012), mats.steel, 0, 0.06, -0.16);
    add(box(0.02, 0.02, 0.22), mats.accent, 0, 0.052, -0.08);
  } else {
    // The DMR: long barrel, bipod folded along it, a real scope with a glowing lens.
    add(box(0.08, 0.09, 0.5), mats.body, 0, 0, -0.12);
    add(tube(0.02, 0.5), mats.steel, 0, 0.015, -0.6).rotation.x = Math.PI / 2;
    add(box(0.055, 0.055, 0.09), mats.steel, 0, 0.015, -0.86);
    add(box(0.05, 0.13, 0.07), mats.grip, 0, -0.1, -0.05).rotation.x = -0.1;
    add(box(0.045, 0.1, 0.05), mats.grip, 0, -0.08, 0.12).rotation.x = 0.25;
    add(box(0.07, 0.085, 0.22), mats.grip, 0, -0.01, 0.26);
    add(tube(0.042, 0.2), mats.steel, 0, 0.1, -0.18).rotation.x = Math.PI / 2;
    add(new THREE.CircleGeometry(0.034, 12), mats.glass, 0, 0.1, -0.285).rotation.y = Math.PI;
    add(box(0.015, 0.05, 0.015), mats.steel, -0.05, -0.06, -0.55).rotation.z = 0.5;
    add(box(0.015, 0.05, 0.015), mats.steel, 0.05, -0.06, -0.55).rotation.z = -0.5;
    add(box(0.02, 0.02, 0.36), mats.accent, 0, 0.055, -0.16);
  }
  group.position.set(0.26, -0.22, -0.45);
  group.scale.setScalar(0.72);
  group.visible = false;
  return group;
}

// The flash: two crossed star planes plus a hot core sphere, lit by a real point light
// so a shot throws light onto the lane for a frame. Random rotation per shot keeps two
// screenshots from ever showing the same star.
function buildFlash() {
  const group = new THREE.Group();
  const starMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa63d, transparent: true, opacity: 0.95, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
  });
  const shape = new THREE.Shape();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i += 1) {
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? 0.21 : 0.055;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * (i % 4 === 0 ? 1.5 : 0.7);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const starGeometry = new THREE.ShapeGeometry(shape);
  const starA = new THREE.Mesh(starGeometry, starMaterial);
  const starB = new THREE.Mesh(starGeometry, starMaterial);
  starB.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 1, depthWrite: false, fog: false }),
  );
  group.add(starA, starB, core);
  group.visible = false;
  return { group, starA, starB };
}

export function createWeapons(camera, scene, colliders, audio, onFrag, onSmoke) {
  const mats = viewMaterials();
  const models = {};
  for (const def of Object.values(WEAPON_DEFS)) {
    const model = buildViewModel(def, mats);
    camera.add(model);
    models[def.id] = model;
  }
  const flash = buildFlash();
  camera.add(flash.group);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 7, 1.4);
  camera.add(flashLight);

  const inventory = {
    owned: { p9: { mag: WEAPON_DEFS.p9.magSize, reserve: WEAPON_DEFS.p9.reserveAmmo } },
    current: 'p9',
    grenades: { frag: 0, smoke: 0 },
  };
  const state = { cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, climb: 0, reloadDef: null, bobPhase: 0 };
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
    state.kick = 0;
    state.climb = 0;
    return true;
  }

  function give(id) {
    if (inventory.owned[id]) {
      inventory.owned[id].reserve = WEAPON_DEFS[id].reserveAmmo;
      return;
    }
    inventory.owned[id] = { mag: WEAPON_DEFS[id].magSize, reserve: WEAPON_DEFS[id].reserveAmmo };
  }

  function step(dt, speed = 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    // Kick: a fast shove back that springs home; climb: the slower muzzle rise that
    // lingers across a burst and bleeds off when the trigger rests.
    state.kick += (0 - state.kick) * Math.min(1, dt * 16);
    state.climb += (0 - state.climb) * Math.min(1, dt * 5);
    const d = def();
    const model = models[inventory.current];
    // Walk bob: the gun breathes with the stride, twice the step frequency, and sways
    // a fraction sideways. Still air when standing — accuracy you can see.
    state.bobPhase += dt * Math.min(1, speed / 5.2) * 9;
    const bobAmount = Math.min(1, speed / 5.2);
    const bobY = Math.abs(Math.sin(state.bobPhase)) * 0.012 * bobAmount;
    const bobX = Math.sin(state.bobPhase) * 0.006 * bobAmount;
    model.position.set(0.26 + bobX, -0.22 + bobY, -0.45 + state.kick);
    // A whisper of base yaw (0.07) turns the gun's flank to the camera, so the
    // silhouette reads as a weapon instead of a plank seen from above.
    model.rotation.set(state.kick * 2.4 + state.climb, 0.07, state.kick * 0.7);
    // The flash sits on the muzzle of the gun in hand and scales with it.
    const flashOn = state.flash > 0;
    flash.group.visible = flashOn;
    if (flashOn) {
      flash.group.position.set(0.26, -0.2, d.muzzleZ);
      flash.group.scale.setScalar(d.flashScale * (0.85 + state.flash * 2));
      flashLight.position.set(0.26, -0.16, d.muzzleZ - 0.1);
    }
    flashLight.intensity = flashOn ? 22 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      // Reload: the gun dips muzzle-down and rolls, deepest at the midpoint, so the
      // magazine swap reads even in a single frame.
      const progress = 1 - state.reloadLeft / state.reloadDef.reloadTime;
      const dip = Math.sin(Math.min(1, progress) * Math.PI);
      model.position.y = -0.22 + bobY - dip * 0.13;
      model.rotation.x = -dip * 0.7;
      model.rotation.z = -dip * 0.25;
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
      state.kick = def().kick;
      state.climb = Math.min(0.05, state.climb + def().kick * 0.35);
      flash.starA.rotation.z = Math.random() * Math.PI;
      flash.starB.rotation.y = Math.random() * Math.PI;
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
      return d.spreadStill + Math.min(1, speed / 5.2) * d.spreadMoving + state.kick * 0.35 + state.climb * 0.5;
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
      state.climb = 0;
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
