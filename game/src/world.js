// The map: Kestrel Foundry, a dusk-lit industrial yard, 44 x 36 m. Two charge sites —
// Site A (the furnace, north-west) and Site B (the container depot, north-east) — joined by
// a mid lane past the kiln, with a west lane and an east lane around it. Every box is a
// collider for movement and a surface a bullet stops on. Plain geometry only, no models,
// no textures from disk; the site letters are drawn on a canvas at runtime.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function letterTexture(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255, 122, 26, 0.92)';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0x2b251d, roughness: 0.95, metalness: 0.02 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.9, metalness: 0.05 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x5c5348, roughness: 0.92, metalness: 0.03 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x7a3b1e, roughness: 0.8, metalness: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x3d454e, roughness: 0.55, metalness: 0.6 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x6b5636, roughness: 0.9, metalness: 0.05 }),
    containerA: new THREE.MeshStandardMaterial({ color: 0x274b5c, roughness: 0.75, metalness: 0.35 }),
    containerB: new THREE.MeshStandardMaterial({ color: 0x5c2e1e, roughness: 0.75, metalness: 0.35 }),
    sand: new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1, metalness: 0 }),
    ember: new THREE.MeshStandardMaterial({
      color: 0xff7a1a, roughness: 0.4, metalness: 0.1,
      emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 1.6,
    }),
  };

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  function cylinder(radius, height, x, y, z, material, segments = 12) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const half = radius;
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - half, y - height / 2, z - half),
      new THREE.Vector3(x + half, y + height / 2, z + half),
    ));
    shootables.push(mesh);
    return mesh;
  }

  // Floor and the outer shell, open to a dusk sky so one low sun reaches every lane.
  box(44.8, 0.4, 36.8, 0, -0.2, 0, 'floor');
  box(0.6, 5.2, 36.8, -22.2, 2.6, 0, 'wall');
  box(0.6, 5.2, 36.8, 22.2, 2.6, 0, 'wall');
  box(44.8, 5.2, 0.6, 0, 2.6, -18.2, 'wall');
  box(44.8, 5.2, 0.6, 0, 2.6, 18.2, 'wall');

  // Site A — the furnace: a rusted furnace block, chimney, pipes and sandbag ring.
  box(5.0, 3.4, 3.0, -17.5, 1.7, -13.5, 'rust');
  cylinder(0.7, 6.5, -19.2, 3.25, -15.2, 'steel');
  box(4.2, 0.5, 1.0, -16.2, 0.25, -10.6, 'steel');
  box(1.0, 1.1, 2.6, -12.4, 0.55, -13.2, 'sand');
  box(2.6, 1.1, 1.0, -13.8, 0.55, -15.8, 'sand');
  cylinder(0.45, 1.0, -14.6, 0.5, -11.4, 'rust');
  cylinder(0.45, 1.0, -15.6, 0.5, -11.4, 'rust');

  // Site B — the depot: stacked containers and a crate wall.
  box(6.0, 2.6, 2.6, 17.5, 1.3, -14.5, 'containerA');
  box(6.0, 2.6, 2.6, 17.5, 3.9, -14.5, 'containerB');
  box(2.6, 2.6, 6.0, 12.6, 1.3, -12.4, 'containerB');
  box(2.2, 1.1, 1.2, 14.6, 0.55, -10.2, 'crate');
  box(1.2, 1.1, 2.2, 19.6, 0.55, -10.6, 'crate');
  cylinder(0.45, 1.0, 15.2, 0.5, -9.2, 'steel');

  // Mid — the kiln block, the map's heart, with lanes east and west of it.
  box(4.0, 3.0, 4.0, 0, 1.5, -3.0, 'concrete');
  box(4.6, 0.6, 4.6, 0, 3.3, -3.0, 'steel');
  cylinder(0.55, 5.2, 0, 2.6, -3.0, 'rust');
  box(1.6, 1.1, 1.6, -5.4, 0.55, -6.4, 'crate');
  box(1.6, 1.1, 1.6, 5.4, 0.55, -6.4, 'crate');

  // South yard — Vanguard's half: crates, a low wall and a pipe run to fight around.
  box(3.4, 1.1, 1.2, -8.0, 0.55, 6.0, 'crate');
  box(1.2, 1.1, 3.4, 8.0, 0.55, 6.0, 'crate');
  box(6.0, 1.1, 1.0, 0, 0.55, 10.4, 'concrete');
  box(1.6, 0.7, 1.6, -13.6, 0.35, 9.6, 'crate');
  box(1.6, 0.7, 1.6, 13.6, 0.35, 9.6, 'crate');
  cylinder(0.5, 7.0, -20.5, 0.5, 4.0, 'steel').rotation.z = Math.PI / 2;
  box(2.4, 2.4, 1.2, -19.8, 1.2, -4.0, 'containerA');
  box(2.4, 2.4, 1.2, 19.8, 1.2, -4.0, 'containerB');

  // Mid-lane cover: two pillars the lanes bend around.
  box(1.4, 3.4, 1.4, -9.0, 1.7, -2.0, 'concrete');
  box(1.4, 3.4, 1.4, 9.0, 1.7, -2.0, 'concrete');

  // Site markers: an ember pad on the floor and a floating letter, drawn at runtime.
  const sites = {
    A: { center: new THREE.Vector3(-13, 0, -9.5), radius: 4.2 },
    B: { center: new THREE.Vector3(15.5, 0, -12.5), radius: 4.2 },
  };
  for (const key of ['A', 'B']) {
    const site = sites[key];
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(site.radius, 28),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(site.center.x, 0.02, site.center.z);
    group.add(pad);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ map: letterTexture(key), transparent: true, side: THREE.DoubleSide }),
    );
    sign.position.set(site.center.x, 3.4, site.center.z);
    group.add(sign);
    site.sign = sign;
  }

  // Furnace glow: the one warm point light, flickering in update().
  const furnaceLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 22, 16, 1.6);
  furnaceLight.position.set(-16.5, 2.2, -12.0);
  scene.add(furnaceLight);
  const depotLight = new THREE.PointLight(new THREE.Color(0xffd9a0), 12, 14, 1.6);
  depotLight.position.set(15.5, 3.0, -12.5);
  scene.add(depotLight);

  const sky = new THREE.HemisphereLight(new THREE.Color(0x8a6a4a), new THREE.Color(0x17130f), 0.85);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(new THREE.Color(0xffb36b), 2.4);
  sun.position.set(-18, 10, 14);
  sun.target.position.set(4, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(0x5a6a8a), 0.5);
  fill.position.set(14, 12, -12);
  scene.add(fill);

  // Waypoint graph for the bots: nodes on open ground, edges along the lanes.
  // 0 spawnV, 1 south, 2 west-mid, 3 east-mid, 4 kiln-west, 5 kiln-east, 6 A-approach,
  // 7 site A, 8 B-approach, 9 site B, 10 mid, 11 A-hold, 12 B-hold, 13 north-mid.
  const waypoints = {
    nodes: [
      [0, 14], [0, 8], [-8, 2], [8, 2], [-6, -6], [6, -6],
      [-12, -8], [-13, -9.5], [12, -8], [15.5, -12.5],
      [0, -2], [-11, -14.5], [11, -14.5], [0, -10],
    ],
    edges: [
      [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 8],
      [6, 7], [8, 9], [4, 10], [5, 10], [10, 13], [6, 11], [8, 12],
      [11, 13], [12, 13], [2, 10], [3, 10], [7, 11], [9, 12], [13, 11], [13, 12],
    ],
  };

  const spawns = {
    van: [[0, 14], [-2.5, 15], [2.5, 15]],
    cin: [[-18, -16], [15.5, -9], [-6, -14.5], [6, -14.5], [0, -15.5]],
  };

  return {
    colliders,
    shootables,
    sites,
    spawns,
    waypoints,
    group,
    update(time) {
      furnaceLight.intensity = 20 + Math.sin(time * 7.3) * 2.5 + Math.sin(time * 13.1) * 1.5;
      sites.A.sign.position.y = 3.4 + Math.sin(time * 1.2) * 0.08;
      sites.B.sign.position.y = 3.4 + Math.sin(time * 1.2 + 2) * 0.08;
    },
  };
}
