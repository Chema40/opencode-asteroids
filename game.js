'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;
const SPEED_BOOST_DURATION = 5;
const TRIPLE_SHOT_DURATION = 5;
const POWER_UP_CHANCE = 0.2;
const SHIELD_DURATION = 8;
const SHIELD_POWER_UP_CHANCE = 0.15;
const SHOOTING_STAR_DURATION = 8;
const SHOOTING_STAR_SPEED_MULTIPLIER = 3;
const SHOOTING_STAR_INTERVAL_MIN = 5;
const SHOOTING_STAR_INTERVAL_MAX = 12;
const SKIN_STORAGE_KEY = 'asteroids-ship-skin';
const SKINS = {
  classic: {
    stroke: '#fff',
    fill: 'rgba(255, 255, 255, 0.06)',
    thrust: '#ff8200',
    glow: 0,
    shape: 'classic',
  },
  neon: {
    stroke: '#00e5ff',
    fill: 'rgba(0, 229, 255, 0.12)',
    thrust: '#ff4fd8',
    glow: 10,
    shape: 'classic',
  },
  solar: {
    stroke: '#ffd166',
    fill: 'rgba(255, 209, 102, 0.14)',
    thrust: '#ff5c35',
    glow: 8,
    shape: 'classic',
  },
  enterprise: {
    stroke: '#b9c7d8',
    fill: 'rgba(185, 199, 216, 0.16)',
    thrust: '#8be9fd',
    glow: 5,
    shape: 'enterprise',
  },
  falcon: {
    stroke: '#d8c5a5',
    fill: 'rgba(216, 197, 165, 0.15)',
    thrust: '#79d8ff',
    glow: 4,
    shape: 'falcon',
  },
};

const skinButtons = document.querySelectorAll('[data-skin]');
let activeSkin = 'classic';

try {
  const savedSkin = localStorage.getItem(SKIN_STORAGE_KEY);
  if (savedSkin && SKINS[savedSkin]) activeSkin = savedSkin;
} catch (error) {
  // El juego sigue funcionando si el navegador bloquea el almacenamiento local.
}

function selectSkin(skinName) {
  if (!SKINS[skinName]) return;
  activeSkin = skinName;
  skinButtons.forEach(button => {
    const selected = button.dataset.skin === activeSkin;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected);
  });
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, activeSkin);
  } catch (error) {
    // La selección se mantiene durante la sesión aunque no pueda persistirse.
  }
}

skinButtons.forEach(button => {
  button.addEventListener('click', () => selectSkin(button.dataset.skin));
});
selectSkin(activeSkin);

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3, shootingStar = false) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.shootingStar = shootingStar;
    this.ttl = shootingStar ? SHOOTING_STAR_DURATION : null;
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = (SPEEDS[size] + rand(-15, 15)) *
      (shootingStar ? SHOOTING_STAR_SPEED_MULTIPLIER : 1);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    if (this.shootingStar) {
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.shootingStar) {
      const angle = Math.atan2(this.vy, this.vx);
      ctx.rotate(angle);

      // Estela cónica que queda detrás de la cabeza de la estrella.
      const gradient = ctx.createLinearGradient(-68, 0, 0, 0);
      gradient.addColorStop(0, 'rgba(255, 209, 102, 0)');
      gradient.addColorStop(0.7, 'rgba(255, 209, 102, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 245, 200, 0.75)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-68, 0);
      ctx.quadraticCurveTo(-34, -10, -7, -5);
      ctx.lineTo(-7, 5);
      ctx.quadraticCurveTo(-34, 10, -68, 0);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 245, 200, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-60, -2);
      ctx.quadraticCurveTo(-32, -5, -9, -2);
      ctx.moveTo(-52, 3);
      ctx.quadraticCurveTo(-28, 7, -9, 3);
      ctx.stroke();

      // Cabeza de cinco puntas con orientación hacia el movimiento.
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#fff5c4';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const starAngle = -Math.PI / 2 + i * Math.PI / 5;
        const radius = i % 2 === 0 ? 12 : 5;
        const x = Math.cos(starAngle) * radius;
        const y = Math.sin(starAngle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-up: Velocidad ───────────────────────────────────────────────────────
class SpeedPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.vx = rand(-25, 25);
    this.vy = rand(-25, 25);
    this.ttl = 12;
    this.dead = false;
    this.pulse = 0;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    this.pulse += dt * 5;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const size = this.radius + Math.sin(this.pulse) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#00e5ff';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, -9);
    ctx.lineTo(-5, 1);
    ctx.lineTo(1, 1);
    ctx.lineTo(-3, 9);
    ctx.lineTo(7, -2);
    ctx.lineTo(1, -2);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-up: Triple shot ──────────────────────────────────────────────────────
class TripleShotPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.vx = rand(-25, 25);
    this.vy = rand(-25, 25);
    this.ttl = 12;
    this.dead = false;
    this.pulse = 0;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    this.pulse += dt * 5;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const size = this.radius + Math.sin(this.pulse) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#ff4fd8';
    ctx.fillStyle = 'rgba(255, 79, 216, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3', 0, 0);
    ctx.restore();
  }
}

// ── Power-up: Escudo ──────────────────────────────────────────────────────────
class ShieldPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.vx = rand(-25, 25);
    this.vy = rand(-25, 25);
    this.ttl = 12;
    this.dead = false;
    this.pulse = 0;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    this.pulse += dt * 5;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const size = this.radius + Math.sin(this.pulse) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#b388ff';
    ctx.fillStyle = 'rgba(179, 136, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, -5);
    ctx.lineTo(6, 3);
    ctx.quadraticCurveTo(4, 8, 0, 10);
    ctx.quadraticCurveTo(-4, 8, -6, 3);
    ctx.lineTo(-7, -5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

function drawClassicShip() {
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -9);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawEnterpriseShip() {
  // Disco frontal, casco central y dos góndolas laterales.
  ctx.beginPath();
  ctx.ellipse(5, 0, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-8, -3);
  ctx.lineTo(-15, -7);
  ctx.lineTo(-17, -5);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-17, 5);
  ctx.lineTo(-15, 7);
  ctx.lineTo(-8, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const y of [-11, 11]) {
    ctx.beginPath();
    ctx.roundRect(-8, y - 2, 19, 4, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, y);
    ctx.lineTo(7, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 5);
  ctx.stroke();
}

function drawFalconShip() {
  // Silueta ancha con morro partido y cabina lateral.
  ctx.beginPath();
  ctx.moveTo(20, -3);
  ctx.lineTo(10, -10);
  ctx.lineTo(-3, -12);
  ctx.lineTo(-14, -8);
  ctx.lineTo(-9, -2);
  ctx.lineTo(-17, 0);
  ctx.lineTo(-9, 2);
  ctx.lineTo(-14, 8);
  ctx.lineTo(-3, 12);
  ctx.lineTo(10, 10);
  ctx.lineTo(20, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(5, -8);
  ctx.lineTo(13, -2);
  ctx.lineTo(7, -2);
  ctx.lineTo(3, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-9, -5);
  ctx.lineTo(4, -5);
  ctx.lineTo(9, 0);
  ctx.lineTo(4, 5);
  ctx.lineTo(-9, 5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-14, -3);
  ctx.lineTo(-3, -3);
  ctx.moveTo(-14, 3);
  ctx.lineTo(-3, 3);
  ctx.stroke();
}

function drawShipShape(skin) {
  if (skin.shape === 'enterprise') drawEnterpriseShip();
  else if (skin.shape === 'falcon') drawFalconShip();
  else drawClassicShip();
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoostTimer = 0;
    this.tripleShotTimer = 0;
    this.shieldTimer = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
    if (this.tripleShotTimer > 0) this.tripleShotTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    const speedMultiplier = this.speedBoostTimer > 0 ? 2 : 1;
    this.x = wrap(this.x + this.vx * dt * speedMultiplier, W);
    this.y = wrap(this.y + this.vy * dt * speedMultiplier, H);
  }

  activateSpeedBoost() {
    this.speedBoostTimer = SPEED_BOOST_DURATION;
  }

  activateTripleShot() {
    this.tripleShotTimer = TRIPLE_SHOT_DURATION;
  }

  activateShield() {
    this.shieldTimer = SHIELD_DURATION;
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const offsets = this.tripleShotTimer > 0 ? [-8, 0, 8] : [0];
    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);
    const sideX = -forwardY;
    const sideY = forwardX;
    return offsets.map(offset => new Bullet(
      this.x + forwardX * NOSE + sideX * offset,
      this.y + forwardY * NOSE + sideY * offset,
      this.angle
    ));
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const skin = SKINS[activeSkin];
    ctx.strokeStyle = skin.stroke;
    ctx.fillStyle = skin.fill;
    ctx.shadowColor = skin.stroke;
    ctx.shadowBlur = skin.glow;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    if (this.shieldTimer > 0) {
      const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.04;
      ctx.strokeStyle = 'rgba(179, 136, 255, 0.9)';
      ctx.fillStyle = 'rgba(179, 136, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#b388ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 23 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    drawShipShape(skin);

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = skin.thrust;
      ctx.shadowColor = skin.thrust;
      ctx.shadowBlur = skin.glow;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let shootingStarTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function scheduleShootingStar() {
  shootingStarTimer = rand(SHOOTING_STAR_INTERVAL_MIN, SHOOTING_STAR_INTERVAL_MAX);
}

function spawnShootingStar() {
  const SAFE_DIST = 160;
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - ship.x, y - ship.y) < SAFE_DIST);
  asteroids.push(new Asteroid(x, y, 3, true));
}

function spawnSpeedPowerUp(x, y) {
  powerUps.push(new SpeedPowerUp(x, y));
}

function spawnTripleShotPowerUp(x, y) {
  powerUps.push(new TripleShotPowerUp(x, y));
}

function spawnShieldPowerUp(x, y) {
  powerUps.push(new ShieldPowerUp(x, y));
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
  scheduleShootingStar();
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  ship.reset();
  spawnAsteroids(3 + level);
  scheduleShootingStar();
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  ship.speedBoostTimer = 0;
  ship.tripleShotTimer = 0;
  ship.shieldTimer = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    asteroids = asteroids.filter(a => !a.dead);
    powerUps.forEach(p => p.update(dt));
    powerUps = powerUps.filter(p => !p.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  shootingStarTimer -= dt;
  if (shootingStarTimer <= 0) {
    spawnShootingStar();
    scheduleShootingStar();
  }
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size] * (a.shootingStar ? 2 : 1);
        explode(a.x, a.y, a.size * 5);
        if (a.shootingStar) {
          spawnSpeedPowerUp(a.x, a.y);
        } else if (Math.random() < POWER_UP_CHANCE) {
          if (Math.random() < 0.5) spawnSpeedPowerUp(a.x, a.y);
          else spawnTripleShotPowerUp(a.x, a.y);
        } else if (Math.random() < SHIELD_POWER_UP_CHANCE) {
          spawnShieldPowerUp(a.x, a.y);
        }
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (ship.shieldTimer <= 0 && dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nave vs power-up
  for (const powerUp of powerUps) {
    if (dist(ship, powerUp) < ship.radius + powerUp.radius) {
      if (powerUp instanceof SpeedPowerUp) ship.activateSpeedBoost();
      else if (powerUp instanceof TripleShotPowerUp) ship.activateTripleShot();
      else ship.activateShield();
      powerUp.dead = true;
      break;
    }
  }
  powerUps = powerUps.filter(powerUp => !powerUp.dead);

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = SKINS[activeSkin];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.scale(0.45, 0.45);
  ctx.strokeStyle = skin.stroke;
  ctx.fillStyle = skin.fill;
  ctx.shadowColor = skin.stroke;
  ctx.shadowBlur = skin.glow;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  drawShipShape(skin);
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  let powerUpHudY = 48;
  if (ship.speedBoostTimer > 0) {
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`VELOCIDAD ${ship.speedBoostTimer.toFixed(1)}s`, W / 2, powerUpHudY);
    powerUpHudY += 20;
  }

  if (ship.tripleShotTimer > 0) {
    ctx.fillStyle = '#ff4fd8';
    ctx.fillText(`TRIPLE SHOT ${ship.tripleShotTimer.toFixed(1)}s`, W / 2, powerUpHudY);
    powerUpHudY += 20;
  }

  if (ship.shieldTimer > 0) {
    ctx.fillStyle = '#b388ff';
    ctx.fillText(`ESCUDO ${ship.shieldTimer.toFixed(1)}s`, W / 2, powerUpHudY);
  }

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
