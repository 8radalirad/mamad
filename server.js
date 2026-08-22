const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// A nice set of distinct, cute cat colors. If more users than colors join,
// we generate extra colors procedurally.
const BASE_COLORS = [
  '#ff6b6b', '#ffa94d', '#ffd43b', '#a9e34b', '#69db7c',
  '#38d9a9', '#3bc9db', '#4dabf7', '#748ffc', '#9775fa',
  '#da77f2', '#f783ac', '#e64980', '#20c997', '#fab005'
];

const MAX_HEALTH = 100;
const HIT_DAMAGE = 34; // 3 hits to explode
const HIT_RANGE = 0.07; // normalized distance a hit can reach
const HIT_COOLDOWN_MS = 350;
const RESPAWN_MS = 10000;

const usedColors = new Map(); // socketId -> color
const players = new Map(); // socketId -> { x, y, color, id, name, health, dead, lastHitAt }

function pickColor(socketId) {
  const taken = new Set(usedColors.values());
  let color = BASE_COLORS.find(c => !taken.has(c));
  if (!color) {
    const hue = Math.floor(Math.random() * 360);
    color = `hsl(${hue}, 70%, 60%)`;
  }
  usedColors.set(socketId, color);
  return color;
}

function randomSpawn() {
  return {
    x: 0.5 + (Math.random() - 0.5) * 0.3,
    y: 0.5 + (Math.random() - 0.5) * 0.3
  };
}

function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'Cat';
  const trimmed = raw.trim().slice(0, 16);
  return trimmed.length ? trimmed : 'Cat';
}

io.on('connection', (socket) => {
  const color = pickColor(socket.id);
  const spawn = randomSpawn();

  players.set(socket.id, {
    id: socket.id,
    x: spawn.x,
    y: spawn.y,
    color,
    name: 'Cat',
    health: MAX_HEALTH,
    dead: false,
    lastHitAt: 0
  });

  socket.emit('init', {
    id: socket.id,
    color,
    players: Array.from(players.values())
  });

  socket.broadcast.emit('player-joined', players.get(socket.id));

  socket.on('set-name', (name) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.name = sanitizeName(name);
    io.emit('player-renamed', { id: socket.id, name: p.name });
  });

  socket.on('move', (pos) => {
    const p = players.get(socket.id);
    if (!p || p.dead) return;
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
    p.x = Math.max(0, Math.min(1, pos.x));
    p.y = Math.max(0, Math.min(1, pos.y));
    socket.broadcast.emit('player-moved', { id: socket.id, x: p.x, y: p.y });
  });

  socket.on('hit', ({ targetId }) => {
    const attacker = players.get(socket.id);
    const target = players.get(targetId);
    if (!attacker || !target || attacker.dead || target.dead) return;
    if (attacker.id === target.id) return;

    const now = Date.now();
    if (now - attacker.lastHitAt < HIT_COOLDOWN_MS) return;

    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > HIT_RANGE) return;

    attacker.lastHitAt = now;
    target.health = Math.max(0, target.health - HIT_DAMAGE);

    io.emit('player-hit', { id: target.id, health: target.health, by: attacker.id });

    if (target.health <= 0) {
      target.dead = true;
      io.emit('player-exploded', { id: target.id });

      setTimeout(() => {
        const p = players.get(target.id);
        if (!p) return; // disconnected while dead
        const respawn = randomSpawn();
        p.x = respawn.x;
        p.y = respawn.y;
        p.health = MAX_HEALTH;
        p.dead = false;
        io.emit('player-respawned', { id: p.id, x: p.x, y: p.y, health: p.health });
      }, RESPAWN_MS);
    }
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    usedColors.delete(socket.id);
    io.emit('player-left', { id: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Flying cats server running on http://localhost:${PORT}`);
});
