// The ember charge: the objective beyond killing. The player plants it at a site (3.5 s,
// standing inside the site's ring), it ticks for 35 s, and a defender defuses it in 5 s.
// The module owns the timers and the charge mesh; main.js owns who may plant or defuse.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const PLANT_TIME = 3.5;
export const DEFUSE_TIME = 5;
export const FUSE_TIME = 35;

export function createBomb(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.26, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.5, metalness: 0.4 }),
  );
  body.position.y = 0.13;
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 2,
    }),
  );
  lamp.position.set(0.12, 0.3, 0);
  const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6, 1.8);
  light.position.set(0, 0.5, 0);
  group.add(body, lamp, light);
  group.visible = false;
  scene.add(group);

  const state = {
    status: 'idle', // idle | planted
    site: null,
    fuseLeft: 0,
    plantProgress: 0,
    defuseProgress: 0,
    defuser: null,
    lastBeep: 0,
  };

  return {
    state,
    group,
    place(siteKey, position) {
      state.status = 'planted';
      state.site = siteKey;
      state.fuseLeft = FUSE_TIME;
      state.plantProgress = 0;
      state.defuseProgress = 0;
      state.defuser = null;
      state.lastBeep = 0;
      group.position.copy(position);
      group.position.y = 0;
      group.visible = true;
    },
    clear() {
      state.status = 'idle';
      state.site = null;
      state.fuseLeft = 0;
      state.plantProgress = 0;
      state.defuseProgress = 0;
      state.defuser = null;
      group.visible = false;
      light.intensity = 0;
    },
    step(dt, time, onBeep) {
      if (state.status !== 'planted') return;
      state.fuseLeft -= dt;
      const urgent = state.fuseLeft < 10;
      light.intensity = 2.5 + Math.sin(time * (urgent ? 18 : 6)) * 1.5;
      const interval = urgent ? 0.5 : 1;
      if (time - state.lastBeep >= interval) {
        state.lastBeep = time;
        onBeep(urgent);
      }
    },
  };
}
