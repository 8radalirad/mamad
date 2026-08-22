const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const onlineCountEl = document.getElementById('online-count');
const nameOverlay = document.getElementById('name-overlay');
const nameInput = document.getElementById('name-input');
const nameSubmit = document.getElementById('name-submit');

let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---------- Starfield background ----------
const stars = Array.from({ length: 220 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.6 + 0.3,
  twinkle: Math.random() * Math.PI * 2,
  speed: Math.random() * 0.5 + 0.2
}));

function drawStars(t) {
  ctx.fillStyle = '#04041a';
  ctx.fillRect(0, 0, width, height);

  for (const s of stars) {
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.twinkle));
    ctx.beginPath();
    ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }
}

// ---------- Multiplayer state ----------
const MAX_HEALTH = 100;
const RESPAWN_MS = 10000;

// cats: id -> { x, y, targetX, targetY, color, isMe, name, health, dead, respawnAt }
const cats = new Map();
let myId = null;
const explosions = []; // { x, y, t0, color }

const socket = io();

socket.on('init', (data) => {
  myId = data.id;
  cats.clear();
  data.players.forEach((p) => {
    cats.set(p.id, {
      x: p.x, y: p.y,
      targetX: p.x, targetY: p.y,
      color: p.color,
      isMe: p.id === myId,
      name: p.name || 'Cat',
      health: p.health ?? MAX_HEALTH,
      dead: !!p.dead
    });
  });
  updateCount();
});

socket.on('player-joined', (p) => {
  cats.set(p.id, {
    x: p.x, y: p.y,
    targetX: p.x, targetY: p.y,
    color: p.color,
    isMe: false,
    name: p.name || 'Cat',
    health: p.health ?? MAX_HEALTH,
    dead: !!p.dead
  });
  updateCount();
});

socket.on('player-moved', ({ id, x, y }) => {
  const c = cats.get(id);
  if (c) {
    c.targetX = x;
    c.targetY = y;
  }
});

socket.on('player-renamed', ({ id, name }) => {
  const c = cats.get(id);
  if (c) c.name = name;
});

socket.on('player-hit', ({ id, health }) => {
  const c = cats.get(id);
  if (c) {
    c.health = health;
    c.flashUntil = performance.now() + 150;
  }
});

socket.on('player-exploded', ({ id }) => {
  const c = cats.get(id);
  if (!c) return;
  c.dead = true;
  explosions.push({
    x: c.x * width,
    y: c.y * height,
    t0: performance.now(),
    color: c.color
  });
});

socket.on('player-respawned', ({ id, x, y, health }) => {
  const c = cats.get(id);
  if (!c) return;
  c.x = c.targetX = x;
  c.y = c.targetY = y;
  c.health = health;
  c.dead = false;
});

socket.on('player-left', ({ id }) => {
  cats.delete(id);
  updateCount();
});

function updateCount() {
  onlineCountEl.textContent = cats.size;
}

// ---------- Name entry ----------
function submitName() {
  const value = nameInput.value.trim() || 'Cat';
  socket.emit('set-name', value);
  const me = myId ? cats.get(myId) : null;
  if (me) me.name = value;
  nameOverlay.classList.add('hidden');
  mouse.active = false; // start idle-drifting until they move the mouse
}

nameSubmit.addEventListener('click', submitName);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitName();
});
nameInput.focus();

// ---------- Mouse control for my cat ----------
let mouse = { x: 0.5, y: 0.5, active: false };

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX / width;
  mouse.y = e.clientY / height;
  mouse.active = true;
});

window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    mouse.x = e.touches[0].clientX / width;
    mouse.y = e.touches[0].clientY / height;
    mouse.active = true;
  }
}, { passive: true });

// ---------- Click-to-hit ----------
const HIT_PICK_RADIUS = 36; // pixels

function handleAttack(clientX, clientY) {
  let closestId = null;
  let closestDist = Infinity;

  for (const [id, c] of cats) {
    if (id === myId || c.dead) continue;
    const px = c.x * width;
    const py = c.y * height;
    const d = Math.hypot(px - clientX, py - clientY);
    if (d < HIT_PICK_RADIUS && d < closestDist) {
      closestDist = d;
      closestId = id;
    }
  }

  if (closestId) {
    socket.emit('hit', { targetId: closestId });
  }
}

canvas.addEventListener('click', (e) => {
  if (!nameOverlay.classList.contains('hidden')) return;
  handleAttack(e.clientX, e.clientY);
});

// ---------- Throttled outgoing move events ----------
let lastSent = 0;
function maybeSendMove(x, y) {
  const now = performance.now();
  if (now - lastSent > 40) { // ~25 updates/sec
    socket.emit('move', { x, y });
    lastSent = now;
  }
}

// ---------- Explosion particles ----------
function drawExplosions(now) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    const age = (now - ex.t0) / 1000;
    if (age > 0.7) {
      explosions.splice(i, 1);
      continue;
    }
    const progress = age / 0.7;
    const particleCount = 14;
    for (let p = 0; p < particleCount; p++) {
      const angle = (p / particleCount) * Math.PI * 2;
      const dist = progress * 60;
      const px = ex.x + Math.cos(angle) * dist;
      const py = ex.y + Math.sin(angle) * dist;
      const size = Math.max(0, 5 * (1 - progress));
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = ex.color;
      ctx.globalAlpha = 1 - progress;
      ctx.fill();
    }
    // flash
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, 30 * (1 - progress), 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5 * (1 - progress);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- Health bar + name label ----------
function drawLabel(c, px, py) {
  const barWidth = 40;
  const barHeight = 5;
  const barY = py - 44;

  // Name
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = c.isMe ? '#ffe066' : '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText(c.name, px, barY - 6);
  ctx.shadowBlur = 0;

  // Health bar background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px - barWidth / 2, barY, barWidth, barHeight);

  // Health bar fill
  const pct = Math.max(0, c.health / MAX_HEALTH);
  const fillColor = pct > 0.5 ? '#69db7c' : pct > 0.25 ? '#ffd43b' : '#ff6b6b';
  ctx.fillStyle = fillColor;
  ctx.fillRect(px - barWidth / 2, barY, barWidth * pct, barHeight);

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px - barWidth / 2, barY, barWidth, barHeight);
}

// ---------- Animation loop ----------
let last = performance.now();
let idleAngle = 0;

function animate(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  drawStars(t);

  const me = myId ? cats.get(myId) : null;
  const overlayHidden = nameOverlay.classList.contains('hidden');

  if (me && overlayHidden && !me.dead) {
    if (mouse.active) {
      me.targetX = mouse.x;
      me.targetY = mouse.y;
    } else {
      idleAngle += dt * 0.4;
      me.targetX = 0.5 + Math.cos(idleAngle) * 0.15;
      me.targetY = 0.5 + Math.sin(idleAngle) * 0.1;
    }
    me.x += (me.targetX - me.x) * Math.min(dt * 8, 1);
    me.y += (me.targetY - me.y) * Math.min(dt * 8, 1);
    maybeSendMove(me.x, me.y);
  }

  for (const [id, c] of cats) {
    if (id === myId) continue;
    c.x += (c.targetX - c.x) * Math.min(dt * 5, 1);
    c.y += (c.targetY - c.y) * Math.min(dt * 5, 1);
  }

  const ordered = Array.from(cats.entries()).sort((a, b) => (a[1].isMe ? 1 : 0) - (b[1].isMe ? 1 : 0));

  for (const [id, c] of ordered) {
    if (c.dead) continue; // hidden while waiting to respawn

    const px = c.x * width;
    const py = c.y * height;
    const facing = (c.targetX - c.x) < -0.0005 ? -1 : 1;

    const flashing = c.flashUntil && now < c.flashUntil;

    ctx.save();
    ctx.translate(px, py);
    if (flashing) {
      ctx.filter = 'brightness(2) saturate(0.3)';
    }
    ctx.scale(facing, 1);
    drawCat(ctx, t + (id.length % 5), c.color, c.isMe);
    ctx.restore();

    drawLabel(c, px, py);
  }

  drawExplosions(now);

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
