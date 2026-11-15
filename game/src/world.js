// The map: Kestrel Foundry, a dusk-lit industrial yard, 44 x 36 m. Two charge sites —
// Site A (the furnace, north-west) and Site B (the container depot, north-east) — joined by
// a mid lane under a pipe gantry, with a west lane and an east lane around the kiln. Every
// crate, barrel and container is dressed to be read at a glance in a screenshot: hazard
// stripes on the working edges, ember light spilling from the furnace mouth, lamps over
// both sites, painted lane lines worn into the concrete. All geometry is plain three.js,
// all surfaces are canvas textures painted at runtime — no models, no files, no network.
// Every solid box is a collider for movement and a surface a bullet stops on.
import * as THREE from 'three';
import { PALETTE, SKY, LIGHTS } from './palette.js';

function letterTexture(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255, 122, 26, 0.95)';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

// The floor: stained concrete with expansion joints, oil blotches and worn patches,
// painted once onto a canvas and stretched over the yard. The detail is large-scale on
// purpose — it reads as grime from playing height, never as noise.
function floorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#33291f';
  ctx.fillRect(0, 0, 1024, 1024);
  let rngState = 1234567;
  const rnd = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  // Broad tonal patches so no two lanes share the same shade of concrete.
  for (let i = 0; i < 46; i += 1) {
    const x = rnd() * 1024;
    const y = rnd() * 1024;
    const r = 60 + rnd() * 190;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? '58, 47, 35' : '38, 31, 24';
    grad.addColorStop(0, `rgba(${tone}, ${0.16 + rnd() * 0.14})`);
    grad.addColorStop(1, `rgba(${tone}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Oil and scorch stains, darker and tighter.
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * 1024;
    const y = rnd() * 1024;
    const r = 18 + rnd() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(12, 9, 7, ${0.25 + rnd() * 0.25})`);
    grad.addColorStop(1, 'rgba(12, 9, 7, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Expansion joints: a grid of dark seams with a pale worn edge on one side.
  ctx.strokeStyle = 'rgba(16, 12, 9, 0.55)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo((i * 1024) / 8, 0);
    ctx.lineTo((i * 1024) / 8, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i * 1024) / 8);
    ctx.lineTo(1024, (i * 1024) / 8);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(214, 196, 160, 0.10)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo((i * 1024) / 8 + 3, 0);
    ctx.lineTo((i * 1024) / 8 + 3, 1024);
    ctx.stroke();
  }
  // Speckle: fine aggregate grit across the whole slab.
  for (let i = 0; i < 5200; i += 1) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(230, 214, 180, 0.05)' : 'rgba(0, 0, 0, 0.07)';
    ctx.fillRect(rnd() * 1024, rnd() * 1024, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Hazard stripes for working edges: furnace mouth, gantry feet, the kiln rim. Diagonal
// ember-on-charcoal bands, worn at the edges.
function hazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241c14';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#c75b12';
  for (let i = -2; i < 6; i += 1) {
    ctx.save();
    ctx.translate(i * 32, 0);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -40, 16, 220);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(20, 14, 10, 0.35)';
  for (let i = 0; i < 300; i += 1) {
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The sky dome: a vertical gradient painted on canvas — indigo zenith melting through
// violet into the ember horizon, with a soft sun glow baked in low over the south-west,
// where the directional sun sits. BackSide sphere, fog-proof, depth-write off.
function skyDome() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, SKY.zenith);
  grad.addColorStop(0.42, SKY.upper);
  grad.addColorStop(0.68, SKY.lower);
  grad.addColorStop(0.86, SKY.horizon);
  grad.addColorStop(1.0, SKY.horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  dome.renderOrder = -10;
  return dome;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  scene.add(skyDome());

  // A low sun disc with a halo, hung on the dome in the same direction as the light,
  // so every screenshot that looks south-west has a reason for its rim light.
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255, 217, 160, 1)');
      grad.addColorStop(0.18, 'rgba(255, 170, 80, 0.85)');
      grad.addColorStop(0.5, 'rgba(255, 122, 26, 0.28)');
      grad.addColorStop(1, 'rgba(255, 122, 26, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })(),
    fog: false,
    depthWrite: false,
    transparent: true,
  }));
  sunSprite.position.set(-52, 17, 41);
  sunSprite.scale.setScalar(46);
  scene.add(sunSprite);

  const hazard = hazardTexture();
  const materials = {
    floor: new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.96, metalness: 0.02 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.9, metalness: 0.05 }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x37302a, roughness: 0.94, metalness: 0.04 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x5c5348, roughness: 0.92, metalness: 0.03 }),
    concreteLight: new THREE.MeshStandardMaterial({ color: 0x776c5c, roughness: 0.9, metalness: 0.03 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x7a3b1e, roughness: 0.8, metalness: 0.25 }),
    rustDark: new THREE.MeshStandardMaterial({ color: 0x552812, roughness: 0.85, metalness: 0.2 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x3d454e, roughness: 0.55, metalness: 0.6 }),
    steelLight: new THREE.MeshStandardMaterial({ color: 0x66707c, roughness: 0.45, metalness: 0.65 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x6b5636, roughness: 0.9, metalness: 0.05 }),
    crateDark: new THREE.MeshStandardMaterial({ color: 0x4e3d24, roughness: 0.92, metalness: 0.05 }),
    containerA: new THREE.MeshStandardMaterial({ color: 0x274b5c, roughness: 0.75, metalness: 0.35 }),
    containerB: new THREE.MeshStandardMaterial({ color: 0x5c2e1e, roughness: 0.75, metalness: 0.35 }),
    containerC: new THREE.MeshStandardMaterial({ color: 0x4d4a26, roughness: 0.75, metalness: 0.35 }),
    sand: new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1, metalness: 0 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.85, metalness: 0.1 }),
    ember: new THREE.MeshStandardMaterial({
      color: 0xff7a1a, roughness: 0.4, metalness: 0.1,
      emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 1.6,
    }),
    emberHot: new THREE.MeshStandardMaterial({
      color: 0xffc37a, roughness: 0.35, metalness: 0.05,
      emissive: new THREE.Color(0xff9a3d), emissiveIntensity: 2.6,
    }),
    lampGlass: new THREE.MeshStandardMaterial({
      color: 0xffd9a0, roughness: 0.3, metalness: 0.05,
      emissive: new THREE.Color(LIGHTS.lamp), emissiveIntensity: 2.2,
    }),
    paintLine: new THREE.MeshBasicMaterial({ color: 0xd8b25e, transparent: true, opacity: 0.4 }),
    paintEmber: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.5 }),
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

  // A box that is visible and stops bullets but is never walked into (overhead work).
  function beam(width, height, depth, x, y, z, material) {
    const mesh = box(width, height, depth, x, y, z, material, false);
    shootables.push(mesh);
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

  // Decorative barrel: a ribbed drum. With collide=true it joins the cover set.
  function barrel(x, z, material, collide = true) {
    const drum = cylinder(0.34, 0.95, x, 0.48, z, material, 14);
    const ribTop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 18), materials.steel);
    ribTop.rotation.x = Math.PI / 2;
    ribTop.position.set(x, 0.78, z);
    group.add(ribTop);
    const ribLow = ribTop.clone();
    ribLow.position.y = 0.2;
    group.add(ribLow);
    return drum;
  }

  // A lamp post: slim pole, emissive head. Light itself comes from the shared rig —
  // the glass sells the source in screenshots without another shadow-casting light.
  function lampPost(x, z, height = 3.4) {
    cylinder(0.06, height, x, height / 2, z, 'steel', 8);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), materials.lampGlass);
    head.position.set(x, height + 0.08, z);
    group.add(head);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 10), materials.steel);
    cap.position.set(x, height + 0.26, z);
    group.add(cap);
    return head;
  }

  // Floor and the outer shell, open to the dusk sky so one low sun reaches every lane.
  box(44.8, 0.4, 36.8, 0, -0.2, 0, 'floor');
  box(0.6, 5.2, 36.8, -22.2, 2.6, 0, 'wall');
  box(0.6, 5.2, 36.8, 22.2, 2.6, 0, 'wall');
  box(44.8, 5.2, 0.6, 0, 2.6, -18.2, 'wall');
  box(44.8, 5.2, 0.6, 0, 2.6, 18.2, 'wall');
  // Wall dressing: a darker wainscot band and a pale coping strip, so the shell reads
  // as built masonry instead of four flat slabs. Non-colliding; the shell carries that.
  for (const side of [-1, 1]) {
    box(0.15, 1.1, 36.8, side * 21.85, 0.55, 0, 'wallDark', false);
    box(0.15, 0.3, 36.8, side * 21.85, 5.05, 0, 'concreteLight', false);
    box(44.8, 1.1, 0.15, 0, 0.55, side * 17.85, 'wallDark', false);
    box(44.8, 0.3, 0.15, 0, 5.05, side * 17.85, 'concreteLight', false);
  }
  // Lit window slits high on the north wall — the foundry offices, still staffed.
  for (const x of [-15, -9, -3, 4, 10, 16]) {
    const slit = box(1.7, 0.5, 0.1, x, 4.1, -17.82, 'lampGlass', false);
    slit.castShadow = false;
  }

  // Painted lane lines worn into the concrete: the routes a forklift would take, and
  // the routes players actually take — mid, and the two site approaches.
  function laneLine(width, depth, x, z, material = 'paintLine') {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials[material]);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.015, z);
    line.receiveShadow = true;
    group.add(line);
  }
  laneLine(0.28, 26, -1.9, 1);
  laneLine(0.28, 26, 1.9, 1);
  laneLine(16, 0.28, -8, -7.6);
  laneLine(16, 0.28, 8, -7.6);
  laneLine(0.28, 12, -13.4, -3.4, 'paintEmber');
  laneLine(0.28, 12, 16.9, -6.4, 'paintEmber');

  // Site A — the furnace: a rusted furnace block with a glowing mouth, chimney, pipework,
  // a sandbag ring, coal barrels and a hazard-striped apron.
  box(5.0, 3.4, 3.0, -17.5, 1.7, -13.5, 'rust');
  box(5.3, 0.35, 3.3, -17.5, 3.55, -13.5, 'rustDark');
  box(1.9, 1.3, 0.25, -17.5, 0.75, -11.95, 'hazard');
  const furnaceMouth = box(1.5, 0.9, 0.1, -17.5, 0.62, -11.86, 'emberHot', false);
  furnaceMouth.castShadow = false;
  cylinder(0.7, 6.5, -19.2, 3.25, -15.2, 'steel');
  cylinder(0.78, 0.5, -19.2, 6.6, -15.2, 'rustDark');
  cylinder(0.16, 3.4, -16.4, 4.4, -14.8, 'steel').rotation.z = Math.PI / 2.6;
  box(4.2, 0.5, 1.0, -16.2, 0.25, -10.6, 'steel');
  box(1.0, 1.1, 2.6, -12.4, 0.55, -13.2, 'sand');
  box(2.6, 1.1, 1.0, -13.8, 0.55, -15.8, 'sand');
  box(1.0, 0.55, 2.6, -12.4, 1.38, -13.2, 'sand');
  cylinder(0.45, 1.0, -14.6, 0.5, -11.4, 'rust');
  cylinder(0.45, 1.0, -15.6, 0.5, -11.4, 'rust');
  barrel(-11.2, -15.6, 'rust');
  barrel(-10.5, -14.7, 'containerA');
  barrel(-20.6, -9.8, 'steel');
  lampPost(-10.8, -12.2);

  // Site B — the depot: stacked containers with ribbed doors, a crate wall, pallet stacks
  // and a lamp over the plant ring.
  box(6.0, 2.6, 2.6, 17.5, 1.3, -14.5, 'containerA');
  box(6.0, 2.6, 2.6, 17.5, 3.9, -14.5, 'containerB');
  box(6.3, 0.22, 2.9, 17.5, 5.3, -14.5, 'rustDark');
  for (const dx of [-2.2, -0.75, 0.75, 2.2]) {
    box(0.18, 2.3, 0.08, 17.5 + dx, 1.3, -13.16, 'steel', false);
    box(0.18, 2.3, 0.08, 17.5 + dx, 3.9, -13.16, 'steelLight', false);
  }
  box(2.6, 2.6, 6.0, 12.6, 1.3, -12.4, 'containerB');
  box(2.2, 1.1, 1.2, 14.6, 0.55, -10.2, 'crate');
  box(2.2, 0.55, 1.2, 14.6, 1.38, -10.2, 'crateDark');
  box(1.2, 1.1, 2.2, 19.6, 0.55, -10.6, 'crate');
  cylinder(0.45, 1.0, 15.2, 0.5, -9.2, 'steel');
  barrel(11.4, -9.4, 'containerC');
  barrel(12.1, -8.6, 'rust');
  barrel(20.8, -16.6, 'containerA');
  lampPost(13.2, -15.9);
  // Pallet stack by the depot wall: flat slats, honest cover at crouch height.
  box(1.8, 0.14, 1.4, 20.4, 0.07, -6.2, 'crateDark');
  box(1.8, 0.14, 1.4, 20.4, 0.72, -6.2, 'crateDark');
  box(0.16, 0.6, 1.4, 19.6, 0.4, -6.2, 'crate');
  box(0.16, 0.6, 1.4, 21.2, 0.4, -6.2, 'crate');

  // Mid — the kiln block, the map's heart, with lanes east and west of it, and the pipe
  // gantry spanning the lane north of it: two feet, a beam, three hanging pipes and a
  // work lamp swinging over the crossing every screenshot of mid will frame.
  box(4.0, 3.0, 4.0, 0, 1.5, -3.0, 'concrete');
  box(4.6, 0.6, 4.6, 0, 3.3, -3.0, 'steel');
  box(4.3, 0.18, 4.3, 0, 3.02, -3.0, 'hazard', false);
  cylinder(0.55, 5.2, 0, 2.6, -3.0, 'rust');
  cylinder(0.62, 0.4, 0, 5.35, -3.0, 'rustDark');
  box(1.6, 1.1, 1.6, -5.4, 0.55, -6.4, 'crate');
  box(1.1, 0.8, 1.1, -5.4, 1.5, -6.4, 'crateDark');
  box(1.6, 1.1, 1.6, 5.4, 0.55, -6.4, 'crate');
  barrel(-3.4, -7.2, 'rust');
  barrel(3.6, -7.4, 'containerA');
  // Gantry feet stand clear of the waypoint lanes (x ±5.6 at z -8.6).
  box(0.5, 4.4, 0.5, -5.6, 2.2, -8.6, 'steel');
  box(0.5, 4.4, 0.5, 5.6, 2.2, -8.6, 'steel');
  box(0.9, 0.3, 0.9, -5.6, 0.15, -8.6, 'hazard');
  box(0.9, 0.3, 0.9, 5.6, 0.15, -8.6, 'hazard');
  beam(11.7, 0.45, 0.6, 0, 4.5, -8.6, 'steel');
  for (const dx of [-3.4, 0, 3.4]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 11.4, 10), materials.rust);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(dx * 0.0, 4.05, -8.6 + (dx === 0 ? 0.34 : -0.3));
    pipe.position.x = 0;
    pipe.castShadow = true;
    group.add(pipe);
    shootables.push(pipe);
  }
  const gantryLamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), materials.lampGlass);
  gantryLamp.position.set(0, 4.1, -8.6);
  group.add(gantryLamp);
  cylinder(0.03, 0.35, 0, 4.32, -8.6, 'steel', 6);

  // South yard — Vanguard's half: crates, a low wall, a pipe run, a parked fuel bowser
  // and the long shadows of the spawn lamps.
  box(3.4, 1.1, 1.2, -8.0, 0.55, 6.0, 'crate');
  box(2.2, 0.7, 1.2, -8.6, 1.45, 6.0, 'crateDark');
  box(1.2, 1.1, 3.4, 8.0, 0.55, 6.0, 'crate');
  box(6.0, 1.1, 1.0, 0, 0.55, 10.4, 'concrete');
  box(6.0, 0.16, 1.0, 0, 1.18, 10.4, 'concreteLight', false);
  box(1.6, 0.7, 1.6, -13.6, 0.35, 9.6, 'crate');
  box(1.6, 0.7, 1.6, 13.6, 0.35, 9.6, 'crate');
  cylinder(0.5, 7.0, -20.5, 0.5, 4.0, 'steel').rotation.z = Math.PI / 2;
  box(2.4, 2.4, 1.2, -19.8, 1.2, -4.0, 'containerA');
  box(2.4, 2.4, 1.2, 19.8, 1.2, -4.0, 'containerB');
  // The bowser: a horizontal tank on a skid, west of spawn — silhouette and cover.
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.6, 16), materials.containerC);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(-15.5, 1.05, 12.8);
  tank.castShadow = true;
  tank.receiveShadow = true;
  group.add(tank);
  colliders.push(new THREE.Box3(
    new THREE.Vector3(-17.3, 0, 11.95),
    new THREE.Vector3(-13.7, 1.9, 13.65),
  ));
  shootables.push(tank);
  box(3.4, 0.22, 1.5, -15.5, 0.11, 12.8, 'steel');
  barrel(-12.6, 13.4, 'rust');
  barrel(15.8, 12.2, 'steel');
  barrel(16.5, 13.1, 'containerA');
  lampPost(-4.5, 12.6, 3.0);
  lampPost(4.5, 12.6, 3.0);

  // Mid-lane cover: two pillars the lanes bend around, now with lit caps.
  box(1.4, 3.4, 1.4, -9.0, 1.7, -2.0, 'concrete');
  box(1.4, 3.4, 1.4, 9.0, 1.7, -2.0, 'concrete');
  box(1.5, 0.16, 1.5, -9.0, 3.48, -2.0, 'hazard', false);
  box(1.5, 0.16, 1.5, 9.0, 3.48, -2.0, 'hazard', false);
  // West and east lane dressing: a leaning pallet, a drum pair, a low cable reel.
  box(0.18, 1.5, 1.3, -16.8, 0.72, 2.0, 'crateDark').rotation.z = 0.28;
  barrel(17.2, 3.4, 'rust');
  barrel(16.5, 4.3, 'steel');
  const reel = cylinder(0.75, 0.5, -18.6, 0.75, -5.4, 'crateDark', 16);
  reel.rotation.x = Math.PI / 2;

  // Site markers: an ember pad, a painted ring that pulses while the round runs, and a
  // floating letter, drawn at runtime.
  const sites = {
    A: { center: new THREE.Vector3(-13, 0, -9.5), radius: 4.2 },
    B: { center: new THREE.Vector3(15.5, 0, -12.5), radius: 4.2 },
  };
  const siteRings = [];
  for (const key of ['A', 'B']) {
    const site = sites[key];
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(site.radius, 28),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(site.center.x, 0.02, site.center.z);
    group.add(pad);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.radius - 0.14, site.radius, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.center.x, 0.025, site.center.z);
    group.add(ring);
    siteRings.push(ring);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ map: letterTexture(key), transparent: true, side: THREE.DoubleSide }),
    );
    sign.position.set(site.center.x, 3.4, site.center.z);
    group.add(sign);
    site.sign = sign;
  }

  // Drifting embers and dust: two hundred points rising off the yard on a slow loop,
  // catching the light over mid. Pure atmosphere — no collision, no cost to the sim.
  const emberCount = 220;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberSeeds = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i += 1) {
    emberPositions[i * 3] = (Math.random() - 0.5) * 42;
    emberPositions[i * 3 + 1] = Math.random() * 7;
    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 34;
    emberSeeds[i] = Math.random() * 100;
  }
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({
    color: new THREE.Color(0xffb454), size: 0.09, transparent: true, opacity: 0.75,
    depthWrite: false, sizeAttenuation: true,
  }));
  group.add(embers);

  // Furnace glow: the one warm point light, flickering in update().
  const furnaceLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 19, 17, 1.6);
  furnaceLight.position.set(-16.5, 2.2, -11.4);
  scene.add(furnaceLight);
  const depotLight = new THREE.PointLight(new THREE.Color(LIGHTS.lamp), 13, 15, 1.6);
  depotLight.position.set(15.5, 3.0, -12.5);
  scene.add(depotLight);
  const midLight = new THREE.PointLight(new THREE.Color(LIGHTS.lamp), 9, 12, 1.7);
  midLight.position.set(0, 3.9, -8.6);
  scene.add(midLight);

  const sky = new THREE.HemisphereLight(new THREE.Color(LIGHTS.sky), new THREE.Color(LIGHTS.ground), LIGHTS.skyIntensity);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(new THREE.Color(LIGHTS.sun), LIGHTS.sunIntensity);
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
  const fill = new THREE.DirectionalLight(new THREE.Color(LIGHTS.fill), LIGHTS.fillIntensity);
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
      [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 10], [5, 8],
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
      furnaceLight.intensity = 17 + Math.sin(time * 7.3) * 2.2 + Math.sin(time * 13.1) * 1.3;
      furnaceMouth.material.emissiveIntensity = 2.3 + Math.sin(time * 5.1) * 0.35;
      sites.A.sign.position.y = 3.4 + Math.sin(time * 1.2) * 0.08;
      sites.B.sign.position.y = 3.4 + Math.sin(time * 1.2 + 2) * 0.08;
      for (let i = 0; i < siteRings.length; i += 1) {
        siteRings[i].material.opacity = 0.32 + Math.sin(time * 2.2 + i * 2.1) * 0.14;
      }
      // Embers rise, wobble, and wrap back to the yard floor.
      const positions = emberGeometry.attributes.position.array;
      for (let i = 0; i < emberCount; i += 1) {
        const seed = emberSeeds[i];
        positions[i * 3 + 1] += 0.006 + (seed % 1) * 0.008;
        positions[i * 3] += Math.sin(time * 0.7 + seed) * 0.0035;
        if (positions[i * 3 + 1] > 7.5) positions[i * 3 + 1] = 0.15;
      }
      emberGeometry.attributes.position.needsUpdate = true;
    },
  };
}
