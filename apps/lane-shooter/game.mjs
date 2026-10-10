export const ENEMIES = {
  mouse: {hp: 1, speed: 0.067, size: 0.16, points: 10},
  hamster: {hp: 2, speed: 0.09, size: 0.17, points: 20},
  golden: {hp: 5, speed: 0.05, size: 0.19, points: 35},
  boss: {hp: 180, speed: 0.019, size: 0.32, points: 500},
};
export const GATES = [
  {time: 3, x: 0.27, hp: 12, reward: 'rate'},
  {time: 16, x: 0.73, hp: 18, reward: 'dual'},
  {time: 32, x: 0.27, hp: 28, reward: 'power'},
  {time: 48, x: 0.73, hp: 34, reward: 'rate'},
  {time: 64, x: 0.27, hp: 42, reward: 'power'},
  {time: 79, x: 0.73, hp: 28, reward: 'dual'},
];
export const REWARDS = {rate: '连射升级', dual: '双发升级', power: '重弹升级'};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createGame(seed = 7) {
  return {status: 'ready', time: 0, playerX: 0.5, targetX: 0.5, lives: 3, score: 0, kills: 0,
    weapon: {rate: 4, damage: 1, barrels: 1}, enemies: [], gates: [], bullets: [], particles: [],
    events: [], nextWave: 1, nextShot: 0, nextGate: 0, bossSpawned: false, hitUntil: 0, seed, nextId: 1};
}
function random(game) {
  game.seed = (game.seed * 1664525 + 1013904223) >>> 0;
  return game.seed / 4294967296;
}
export function movePlayer(game, x) { game.targetX = clamp(x, 0.13, 0.87); }
export function addEnemy(game, type, x, z = 1) {
  const data = ENEMIES[type];
  const actor = {id: game.nextId++, type, x, z, hp: data.hp, maxHp: data.hp, ...data};
  game.enemies.push(actor);
  return actor;
}
export function addGate(game, config) {
  const gate = {id: game.nextId++, x: config.x, z: 1, hp: config.hp, maxHp: config.hp, reward: config.reward, size: 0.22};
  game.gates.push(gate);
  return gate;
}
export function applyUpgrade(game, reward) {
  if (reward === 'rate') game.weapon.rate = Math.min(10, game.weapon.rate * 1.35);
  else if (reward === 'dual') game.weapon.barrels = Math.min(3, game.weapon.barrels + 1);
  else if (reward === 'power') game.weapon.damage++;
  else return false;
  game.events.push({type: 'upgrade', reward});
  return true;
}
function burst(game, target, type) {
  for (let i = 0; i < 7; i++) game.particles.push({x: target.x, z: target.z, vx: (random(game) - .5) * .24, vz: (random(game) - .5) * .18, age: 0, life: .5 + random(game) * .25, type});
}
function hitDefense(game, actor) {
  if (game.status !== 'running') return;
  if (actor.type === 'boss') game.lives = 0;
  else if (game.time >= game.hitUntil) {
    game.lives--;
    game.hitUntil = game.time + 0.7;
    game.events.push({type: 'hurt'});
  }
  if (game.lives <= 0) { game.status = 'lost'; game.events.push({type: 'end'}); }
}
function spawnWave(game) {
  if (game.bossSpawned) return;
  const time = game.time;
  const count = time < 15 ? 2 : time < 45 ? 3 : 4;
  for (let i = 0; i < count; i++) {
    const lane = (Math.floor(time / 3) + i) % 2;
    const x = (lane ? .73 : .27) + (random(game) - .5) * .11;
    const roll = random(game);
    const type = time > 45 && roll < .25 ? 'golden' : time > 25 && roll < .45 ? 'hamster' : 'mouse';
    addEnemy(game, type, x, 1 + i * .045);
  }
  game.nextWave = time + (time < 15 ? 3.8 : time < 45 ? 3.5 : 3);
}

export function step(game, dt) {
  if (game.status !== 'running') return;
  dt = clamp(dt, 0, 0.05);
  game.time += dt;
  game.playerX += (game.targetX - game.playerX) * Math.min(1, dt * 22);
  if (game.time >= game.nextWave) spawnWave(game);
  while (game.nextGate < GATES.length && game.time >= GATES[game.nextGate].time) addGate(game, GATES[game.nextGate++]);
  if (!game.bossSpawned && game.time >= 90) {
    game.bossSpawned = true;
    addEnemy(game, 'boss', .5);
    game.events.push({type: 'boss'});
  }
  if (game.time >= game.nextShot) {
    const count = game.weapon.barrels;
    for (let i = 0; i < count; i++) game.bullets.push({x: game.playerX + (i - (count - 1) / 2) * .055, z: .08, damage: game.weapon.damage});
    game.nextShot = game.time + 1 / game.weapon.rate;
  }
  for (const enemy of game.enemies) enemy.z -= enemy.speed * dt;
  for (const gate of game.gates) gate.z -= .065 * dt;
  const targets = [...game.enemies, ...game.gates].sort((a, b) => a.z - b.z);
  for (const bullet of game.bullets) {
    const previous = bullet.z;
    bullet.z += 1.55 * dt;
    const target = targets.find(target => target.hp > 0 && Math.abs(target.x - bullet.x) <= target.size / 2 + .012 && target.z >= previous - .025 && target.z <= bullet.z + .025);
    if (!target) continue;
    bullet.z = 2;
    target.hp -= bullet.damage;
    target.hitAt = game.time;
    if (target.hp > 0) continue;
    if (target.reward) {
      applyUpgrade(game, target.reward);
      burst(game, target, 'paper');
    } else {
      game.kills++;
      game.score += target.points;
      burst(game, target, 'bubble');
      if (target.type === 'boss') { game.status = 'won'; game.events.push({type: 'end'}); }
    }
  }
  for (const enemy of game.enemies) if (enemy.hp > 0 && enemy.z <= .055) { enemy.hp = 0; hitDefense(game, enemy); }
  for (const gate of game.gates) if (gate.hp > 0 && gate.z <= .055) {
    gate.hp = 0;
    if (Math.abs(gate.x - game.playerX) < .13) hitDefense(game, gate);
    game.events.push({type: 'missed', reward: gate.reward});
  }
  game.enemies = game.enemies.filter(actor => actor.hp > 0);
  game.gates = game.gates.filter(actor => actor.hp > 0);
  game.bullets = game.bullets.filter(bullet => bullet.z <= 1.1);
  for (const particle of game.particles) { particle.age += dt; particle.x += particle.vx * dt; particle.z += particle.vz * dt; }
  game.particles = game.particles.filter(particle => particle.age < particle.life);
}
