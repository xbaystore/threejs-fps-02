// The ember charge: the objective beyond killing. The player plants it at a site (3.5 s,
// standing inside the site's ring), it ticks for 35 s, and a defender defuses it in 5 s.
// The module owns the timers and the charge mesh; main.js owns who may plant or defuse.
// The mesh is dressed to be found in a screenshot: a slab charge with an ember core strip
// that pulses faster as the fuse burns down, a blinking mast lamp and a real point light
// that throws the pulse onto the site around it.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const PLANT_TIME = 3.5;
export const DEFUSE_TIME = 5;
export const FUSE_TIME = 35;

export function createBomb(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.24, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.5, metalness: 0.4 }),
  );
  body.position.y = 0.14;
  body.castShadow = true;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.05, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.6, metalness: 0.35 }),
  );
  lid.position.y = 0.29;
  // The ember core: a glowing strip around the charge's waist, the thing the eye finds.
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.47, 0.07, 0.33),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 1.6,
    }),
  );
  core.position.y = 0.14;
  // A short mast with the status lamp, so the planted charge reads from down the lane.
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x3d454e, roughness: 0.5, metalness: 0.6 }),
  );
  mast.position.set(-0.14, 0.44, 0);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 2.4,
    }),
  );
  lamp.position.set(-0.14, 0.64, 0);
  const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 7, 1.8);
  light.position.set(0, 0.55, 0);
  group.add(body, lid, core, mast, lamp, light);
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
      // The pulse rate follows the beep rate: calm breathing early, a heartbeat late.
      const pulse = Math.sin(time * (urgent ? 18 : 6));
      light.intensity = 2.6 + pulse * 1.6;
      core.material.emissiveIntensity = 1.5 + pulse * 0.7;
      lamp.material.emissiveIntensity = pulse > 0 ? 3 : 0.7;
      const interval = urgent ? 0.5 : 1;
      if (time - state.lastBeep >= interval) {
        state.lastBeep = time;
        onBeep(urgent);
      }
    },
  };
}
