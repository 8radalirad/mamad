const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const onlineCountEl = document.getElementById('online-count');

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
// cats: id -> { x, y, targetX, targetY, color, isMe }
const cats = new Map();
let myId = null;

const socket = io();

socket.on('init', (data) => {
  myId = data.id;
  cats.clear();
  data.players.forEach((p) => {
    cats.set(p.id, {
      x: p.x, y: p.y,
      targetX: p.x, targetY: p.y,
      color: p.color,
      isMe: p.id === myId
    });
  });
  updateCount();
});

socket.on('player-joined', (p) => {
  cats.set(p.id, {
    x: p.x, y: p.y,
    targetX: p.x, targetY: p.y,
    color: p.color,
    isMe: false
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

socket.on('player-left', ({ id }) => {
  cats.delete(id);
  updateCount();
});

function updateCount() {
  onlineCountEl.textContent = cats.size;
}

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

// Gentle idle drift for my cat if mouse hasn't moved yet
let idleAngle = 0;

// Throttle outgoing move events
let lastSent = 0;
function maybeSendMove(x, y) {
  const now = performance.now();
  if (now - lastSent > 40) { // ~25 updates/sec
    socket.emit('move', { x, y });
    lastSent = now;
  }
}

// ---------- Animation loop ----------
let last = performance.now();

function animate(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  drawStars(t);

  const me = myId ? cats.get(myId) : null;

  if (me) {
    if (mouse.active) {
      me.targetX = mouse.x;
      me.targetY = mouse.y;
    } else {
      // idle gentle circling until the user moves the mouse
      idleAngle += dt * 0.4;
      me.targetX = 0.5 + Math.cos(idleAngle) * 0.15;
      me.targetY = 0.5 + Math.sin(idleAngle) * 0.1;
    }
    // Smoothly follow the target (springy feel)
    me.x += (me.targetX - me.x) * Math.min(dt * 8, 1);
    me.y += (me.targetY - me.y) * Math.min(dt * 8, 1);
    maybeSendMove(me.x, me.y);
  }

  // Interpolate remote cats toward their last known target
  for (const [id, c] of cats) {
    if (id === myId) continue;
    c.x += (c.targetX - c.x) * Math.min(dt * 5, 1);
    c.y += (c.targetY - c.y) * Math.min(dt * 5, 1);
  }

  // Draw all cats, sorted so "me" renders on top
  const ordered = Array.from(cats.entries()).sort((a, b) => (a[1].isMe ? 1 : 0) - (b[1].isMe ? 1 : 0));

  for (const [id, c] of ordered) {
    const px = c.x * width;
    const py = c.y * height;

    // Facing direction based on horizontal velocity
    const facing = (c.targetX - c.x) < -0.0005 ? -1 : 1;

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(facing, 1);
    drawCat(ctx, t + (id.length % 5), c.color, c.isMe);
    ctx.restore();
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
