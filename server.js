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

const usedColors = new Map(); // socketId -> color
const players = new Map(); // socketId -> { x, y, color, name }

function pickColor(socketId) {
  const taken = new Set(usedColors.values());
  let color = BASE_COLORS.find(c => !taken.has(c));
  if (!color) {
    // Procedurally generate a color if we run out of the base palette
    const hue = Math.floor(Math.random() * 360);
    color = `hsl(${hue}, 70%, 60%)`;
  }
  usedColors.set(socketId, color);
  return color;
}

io.on('connection', (socket) => {
  const color = pickColor(socket.id);
  const startX = 0.5 + (Math.random() - 0.5) * 0.3;
  const startY = 0.5 + (Math.random() - 0.5) * 0.3;

  players.set(socket.id, { x: startX, y: startY, color, id: socket.id });

  // Tell the new player who they are and who's already here
  socket.emit('init', {
    id: socket.id,
    color,
    players: Array.from(players.values())
  });

  // Tell everyone else about the new cat
  socket.broadcast.emit('player-joined', players.get(socket.id));

  socket.on('move', (pos) => {
    const p = players.get(socket.id);
    if (!p) return;
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
    p.x = Math.max(0, Math.min(1, pos.x));
    p.y = Math.max(0, Math.min(1, pos.y));
    socket.broadcast.emit('player-moved', { id: socket.id, x: p.x, y: p.y });
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
