// The bots: two Vanguard allies and five Cinder defenders. Defenders hold the sites and
// patrol the lanes; allies push with the player toward a site. Every bot walks the waypoint
// graph (breadth-first search over world.waypoints), sees through a field of view plus a
// line-of-sight ray against the world, hears gunshots, fires in bursts with a reaction delay,
// and retakes and defuses when the charge is planted. No bot knows the player's position
// until it sees or hears something — the same information a human would have. The meshes
// are dressed to read at range in dusk light: team-coloured armour with a glowing visor
// slit, a chest stripe, pack and pouches — so a screenshot always shows who is who.
import * as THREE from 'three';
import { createBody } from './mover.js';
import { PALETTE } from './palette.js';

const BOT_HEALTH = 100;
const SEE_DISTANCE = 34;
const HEAR_DISTANCE = 28;
const REACTION_MIN = 0.45;
const REACTION_MAX = 0.8;
const BURST_MIN = 3;
const BURST_MAX = 4;
const BOT_DAMAGE = 16;
const BOT_HEAD_MULT = 2.5;

const CIN_NAMES = ['Ash', 'Cinder', 'Soot', 'Ember', 'Flint'];
const VAN_NAMES = ['Bram', 'Kestrel'];

function bfsPath(nodes, edges, from, to) {
  if (from === to) return [to];
  const adjacency = new Map();
  for (const [a, b] of edges) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
  }
  const prev = new Map([[from, -1]]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === to) break;
    for (const next of adjacency.get(current) ?? []) {
      if (!prev.has(next)) {
        prev.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!prev.has(to)) return [to];
  const path = [];
  let node = to;
  while (node !== -1) {
    path.unshift(node);
    node = prev.get(node);
  }
  return path;
}

function nearestNode(nodes, x, z) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    const dx = nodes[i][0] - x;
    const dz = nodes[i][1] - z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

// A bot figure, built to silhouette: armoured torso with a team chest stripe, shoulder
// pauldrons, a helmet with a glowing visor slit (emissive, so it reads across the yard
// at dusk), backpack, belt pouches, knee pads and a rifle held at the ready. Only the
// torso and head carry hit data — the dressing is visual and never blocks a bullet the
// hitboxes would have let through. `shadeShift` varies each bot's armour a touch so a
// squad is seven people, not one clone seven times.
function buildBotMesh(team, shadeShift) {
  const teamColor = new THREE.Color(team === 'van' ? PALETTE.ally : PALETTE.danger);
  teamColor.offsetHSL(0, 0, shadeShift);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.55, metalness: 0.15 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.8, metalness: 0.2 });
  const clothMaterial = new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 0.95, metalness: 0.02 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.7, metalness: 0.05 });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: teamColor, emissive: teamColor, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.1,
  });
  const group = new THREE.Group();
  const part = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // Legs and boots, then knee pads so a crouched holder still reads as armoured.
  const legL = part(box(0.2, 0.7, 0.22), clothMaterial, -0.14, 0.35, 0);
  const legR = part(box(0.2, 0.7, 0.22), clothMaterial, 0.14, 0.35, 0);
  part(box(0.21, 0.1, 0.3), darkMaterial, -0.14, 0.05, -0.03);
  part(box(0.21, 0.1, 0.3), darkMaterial, 0.14, 0.05, -0.03);
  part(box(0.22, 0.2, 0.05), darkMaterial, -0.14, 0.52, -0.12);
  part(box(0.22, 0.2, 0.05), darkMaterial, 0.14, 0.52, -0.12);
  // Torso: the hitbox part. Chest stripe and belt break up the slab; the pack rides behind.
  const torso = part(box(0.56, 0.72, 0.32), bodyMaterial, 0, 1.08, 0);
  torso.userData.part = 'torso';
  part(box(0.57, 0.12, 0.33), darkMaterial, 0, 1.3, 0);
  part(box(0.57, 0.09, 0.33), visorMaterial, 0, 1.12, 0);
  part(box(0.5, 0.08, 0.34), darkMaterial, 0, 0.74, 0);
  part(box(0.4, 0.5, 0.16), darkMaterial, 0, 1.12, 0.24);
  part(box(0.16, 0.2, 0.1), darkMaterial, -0.16, 0.68, -0.18);
  part(box(0.16, 0.2, 0.1), darkMaterial, 0.16, 0.68, -0.18);
  // Shoulders and arms angled down to the rifle.
  part(box(0.18, 0.2, 0.24), bodyMaterial, -0.37, 1.36, 0);
  part(box(0.18, 0.2, 0.24), bodyMaterial, 0.37, 1.36, 0);
  part(box(0.13, 0.42, 0.15), clothMaterial, -0.38, 1.05, -0.06).rotation.x = -0.35;
  part(box(0.13, 0.42, 0.15), clothMaterial, 0.38, 1.05, -0.06).rotation.x = -0.35;
  // Head: the hitbox part — helmet shell, face, and the glowing visor slit facing -z.
  const head = part(new THREE.SphereGeometry(0.17, 14, 10), headMaterial, 0, 1.6, 0);
  head.userData.part = 'head';
  part(new THREE.SphereGeometry(0.185, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), darkMaterial, 0, 1.63, 0);
  part(box(0.27, 0.055, 0.05), visorMaterial, 0, 1.62, -0.155);
  part(box(0.3, 0.04, 0.3), darkMaterial, 0, 1.76, 0);
  // The rifle: receiver, barrel, magazine — long enough to read in silhouette.
  part(box(0.07, 0.1, 0.66), darkMaterial, 0.2, 1.14, -0.32);
  part(box(0.04, 0.04, 0.3), darkMaterial, 0.2, 1.16, -0.78);
  part(box(0.05, 0.14, 0.07), darkMaterial, 0.2, 1.0, -0.3);
  group.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return { group, torso, head };
}

export function createBots(scene, world, mover, shootables, random, hooks) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const bots = [];
  let now = 0;

  function spawn(team, name, spawnIndex, role) {
    const [x, z] = world.spawns[team][spawnIndex % world.spawns[team].length];
    const body = createBody(x, z, team === 'van' ? 0 : Math.PI);
    const mesh = buildBotMesh(team, (random() - 0.5) * 0.07);
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    mesh.torso.userData.bot = null;
    mesh.head.userData.bot = null;
    const bot = {
      id: `${team}-${name}`,
      name,
      team,
      role,
      body,
      mesh,
      health: BOT_HEALTH,
      alive: true,
      fall: 0,
      mode: role === 'defend' ? 'hold' : 'push',
      holdNode: role === 'defend' ? (name === 'Ash' || name === 'Cinder' ? 11 : 12) : 1,
      path: [],
      pathIndex: 0,
      target: null,
      lastSeen: null,
      lastKnown: null,
      reactionAt: 0,
      burstLeft: 0,
      shotAt: 0,
      stuckAt: 0,
      lastX: x,
      lastZ: z,
      destNode: -1,
      aimYaw: 0,
      seed: random(),
    };
    mesh.torso.userData.bot = bot;
    mesh.head.userData.bot = bot;
    bots.push(bot);
    return bot;
  }

  function resetRound(roundNumber) {
    for (const bot of bots) scene.remove(bot.mesh.group);
    bots.length = 0;
    spawn('van', VAN_NAMES[0], 1, 'ally');
    spawn('van', VAN_NAMES[1], 2, 'ally');
    for (let i = 0; i < CIN_NAMES.length; i += 1) {
      spawn('cin', CIN_NAMES[i], i, 'defend');
    }
    // The attack site alternates by round so the defence cannot camp one site forever.
    const site = roundNumber % 2 === 1 ? 'A' : 'B';
    for (const bot of bots) if (bot.team === 'van') bot.attackSite = site;
    return site;
  }

  function losClear(from, to) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const distance = direction.length();
    if (distance < 0.01) return true;
    direction.normalize();
    raycaster.set(from, direction);
    raycaster.far = distance;
    const hits = raycaster.intersectObjects(shootables, false);
    if (hits.length > 0) return false;
    return !hooks.smokeBlocks(from, to);
  }

  function canSee(bot, enemy) {
    const eye = new THREE.Vector3(bot.body.position.x, bot.body.position.y + 1.55, bot.body.position.z);
    const target = new THREE.Vector3(enemy.body.position.x, enemy.body.position.y + 1.2, enemy.body.position.z);
    const distance = eye.distanceTo(target);
    if (distance > SEE_DISTANCE) return false;
    const forward = new THREE.Vector3(-Math.sin(bot.body.yaw), 0, -Math.cos(bot.body.yaw));
    const toTarget = new THREE.Vector3().subVectors(target, eye).setY(0).normalize();
    if (forward.dot(toTarget) < 0.25 && distance > 6) return false;
    return losClear(eye, target);
  }

  function setPath(bot, destNode) {
    const nodes = world.waypoints.nodes;
    const from = nearestNode(nodes, bot.body.position.x, bot.body.position.z);
    bot.path = bfsPath(nodes, world.waypoints.edges, from, destNode).map((index) => nodes[index]);
    bot.pathIndex = 0;
    bot.destNode = destNode;
  }

  function pickHoldTarget(bot) {
    // A defender holds its site node, drifting between two nearby nodes so it is not a statue.
    const options = bot.holdNode === 11 ? [11, 6, 13] : [12, 8, 13];
    const choice = options[Math.floor(random() * options.length)];
    setPath(bot, choice);
    bot.mode = 'hold';
  }

  function stepBot(bot, dt, player, bombState) {
    if (!bot.alive) {
      bot.fall = Math.min(1, bot.fall + dt / 0.4);
      bot.mesh.group.rotation.x = -bot.fall * 1.45;
      return;
    }
    bot.mesh.group.rotation.x = 0;

    // Choose a target: the player first, then the nearest living enemy bot.
    let enemy = null;
    if (player.alive && canSee(bot, player)) enemy = player;
    else {
      let bestDistance = Infinity;
      for (const other of bots) {
        if (other.team === bot.team || !other.alive) continue;
        if (!canSee(bot, other)) continue;
        const distance = bot.body.position.distanceTo(other.body.position);
        if (distance < bestDistance) {
          bestDistance = distance;
          enemy = other;
        }
      }
    }
    if (enemy) {
      bot.target = enemy;
      bot.lastSeen = now;
      bot.lastKnown = new THREE.Vector3(enemy.body.position.x, 0, enemy.body.position.z);
      if (bot.reactionAt === 0) bot.reactionAt = now + REACTION_MIN + random() * (REACTION_MAX - REACTION_MIN);
    } else if (bot.lastSeen !== null && now - bot.lastSeen > 4) {
      bot.target = null;
      bot.lastSeen = null;
    }

    // Mode: retake and defuse when the charge is planted; otherwise hold or push.
    if (bombState.status === 'planted') {
      if (bot.team === 'cin') {
        const bombPos = bombState.position;
        const distance = Math.hypot(bot.body.position.x - bombPos.x, bot.body.position.z - bombPos.z);
        if (distance < 1.7) {
          bot.mode = 'defuse';
        } else if (bot.mode !== 'retake') {
          bot.mode = 'retake';
          setPath(bot, nearestNode(world.waypoints.nodes, bombPos.x, bombPos.z));
        }
      } else if (bot.team === 'van') {
        if (bot.mode !== 'guard') {
          bot.mode = 'guard';
          const siteNode = bombState.site === 'A' ? 7 : 9;
          setPath(bot, siteNode);
        }
      }
    } else if (bot.team === 'cin') {
      if (bot.mode === 'retake' || bot.mode === 'defuse' || bot.mode === 'guard') {
        bot.mode = 'hold';
        pickHoldTarget(bot);
      } else if (bot.mode === 'hold' && bot.pathIndex >= bot.path.length) {
        if (random() < dt * 0.25) pickHoldTarget(bot);
      }
    } else if (bot.team === 'van') {
      if (bot.mode === 'push' && bot.pathIndex >= bot.path.length) {
        const siteNode = bot.attackSite === 'A' ? 7 : 9;
        setPath(bot, siteNode);
      }
    }

    // Movement: walk the path, or strafe-hold while engaging.
    let wishX = 0;
    let wishZ = 0;
    let crouch = false;
    if (bot.mode === 'defuse') {
      wishX = 0;
      wishZ = 0;
      const bombPos = bombState.position;
      bot.body.yaw = Math.atan2(-(bombPos.x - bot.body.position.x), -(bombPos.z - bot.body.position.z));
    } else if (bot.target && now >= bot.reactionAt) {
      // Face the target; shuffle sideways a little so a duel is not a firing line.
      const t = bot.target.body.position;
      bot.body.yaw = Math.atan2(-(t.x - bot.body.position.x), -(t.z - bot.body.position.z));
      const strafe = Math.sin(now * 0.9 + bot.seed * 9) * 0.5;
      const sin = Math.sin(bot.body.yaw);
      const cos = Math.cos(bot.body.yaw);
      wishX = cos * strafe;
      wishZ = -sin * strafe;
      crouch = bot.mode === 'hold' && random() < 0.3;
    } else if (bot.pathIndex < bot.path.length) {
      const node = bot.path[bot.pathIndex];
      const dx = node[0] - bot.body.position.x;
      const dz = node[1] - bot.body.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.7) {
        bot.pathIndex += 1;
      } else {
        wishX = dx / distance;
        wishZ = dz / distance;
        bot.body.yaw = Math.atan2(-wishX, -wishZ);
      }
      // Stuck detection: no progress in two seconds means pick a fresh route.
      const moved = Math.hypot(bot.body.position.x - bot.lastX, bot.body.position.z - bot.lastZ);
      if (moved > 0.05) {
        bot.stuckAt = now;
        bot.lastX = bot.body.position.x;
        bot.lastZ = bot.body.position.z;
      } else if (now - bot.stuckAt > 2) {
        bot.stuckAt = now;
        if (bot.team === 'cin') pickHoldTarget(bot);
        else setPath(bot, bot.attackSite === 'A' ? 7 : 9);
      }
    } else if (bot.team === 'cin' && bot.mode === 'hold') {
      bot.body.yaw += dt * 0.25 * (bot.seed > 0.5 ? 1 : -1);
    }

    mover.step(bot.body, dt, wishX, wishZ, crouch, false);
    bot.mesh.group.position.copy(bot.body.position);
    bot.mesh.group.rotation.y = bot.body.yaw;
    // Walk bob: the legs swing while the body moves, and the arms settle the rifle.
    const speed = mover.groundSpeed(bot.body);
    bot.mesh.group.position.y = bot.body.position.y + Math.abs(Math.sin(now * 9)) * 0.03 * Math.min(1, speed / 4);

    // Fire in bursts once the reaction delay has passed and the target is still seen.
    if (bot.target && now >= bot.reactionAt && bot.target.alive !== false) {
      if (bot.burstLeft === 0 && now - bot.shotAt > 0.55 + bot.seed * 0.3) {
        bot.burstLeft = BURST_MIN + Math.floor(random() * (BURST_MAX - BURST_MIN + 1));
      }
      if (bot.burstLeft > 0 && now - bot.shotAt > 0.13) {
        bot.shotAt = now;
        bot.burstLeft -= 1;
        const origin = new THREE.Vector3(bot.body.position.x, bot.body.position.y + 1.45, bot.body.position.z);
        const target = bot.target.body.position;
        const aim = new THREE.Vector3(target.x, target.y + 1.25, target.z);
        const direction = aim.sub(origin).normalize();
        direction.x += (random() * 2 - 1) * 0.022;
        direction.y += (random() * 2 - 1) * 0.022;
        direction.z += (random() * 2 - 1) * 0.022;
        direction.normalize();
        hooks.resolveBotShot(bot, origin, direction, BOT_DAMAGE, BOT_HEAD_MULT);
        hooks.onBotFired(bot, origin);
      }
    } else if (!bot.target) {
      bot.reactionAt = 0;
      bot.burstLeft = 0;
    }
  }

  return {
    bots,
    resetRound,
    step(dt, time, player, bombState) {
      now = time;
      for (const bot of bots) stepBot(bot, dt, player, bombState);
    },
    hearShot(position, team) {
      for (const bot of bots) {
        if (!bot.alive || bot.team === team) continue;
        const distance = Math.hypot(bot.body.position.x - position.x, bot.body.position.z - position.z);
        if (distance < HEAR_DISTANCE) {
          bot.lastKnown = new THREE.Vector3(position.x, 0, position.z);
          if (bot.team === 'cin' && bot.mode === 'hold') pickHoldTarget(bot);
        }
      }
    },
    damage(bot, amount) {
      if (!bot.alive) return false;
      bot.health -= amount;
      if (bot.health > 0) return false;
      bot.alive = false;
      bot.fall = 0;
      return true;
    },
    aliveCount(team) {
      return bots.filter((bot) => bot.team === team && bot.alive).length;
    },
    hitMeshes() {
      const meshes = [];
      for (const bot of bots) {
        meshes.push(bot.mesh.torso, bot.mesh.head);
      }
      return meshes;
    },
    nearestNodeFor(x, z) {
      return nearestNode(world.waypoints.nodes, x, z);
    },
  };
}
