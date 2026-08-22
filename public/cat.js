// Draws a cute flying cat centered at (0,0) at the given scale.
// Wings flap using a sine wave driven by `t` (time in seconds).
function drawCat(ctx, t, color, isMe) {
  const flap = Math.sin(t * 8) * 0.5 + 0.5; // 0..1
  const bob = Math.sin(t * 2.3) * 3;

  ctx.save();
  ctx.translate(0, bob);

  // Soft glow behind own cat so it's easy to find
  if (isMe) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fill();
    ctx.restore();
  }

  // ---- Wings (behind body) ----
  drawWing(ctx, -1, flap, color);
  drawWing(ctx, 1, flap, color);

  // ---- Tail ----
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tailSway = Math.sin(t * 3) * 10;
  ctx.moveTo(-16, 8);
  ctx.quadraticCurveTo(-34, 10 + tailSway, -30, -6 + tailSway);
  ctx.stroke();
  ctx.restore();

  // ---- Body ----
  ctx.beginPath();
  ctx.ellipse(0, 4, 20, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // ---- Head ----
  ctx.beginPath();
  ctx.arc(15, -8, 13, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Ears
  ctx.beginPath();
  ctx.moveTo(6, -16);
  ctx.lineTo(9, -27);
  ctx.lineTo(15, -18);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(20, -18);
  ctx.lineTo(26, -27);
  ctx.lineTo(27, -15);
  ctx.closePath();
  ctx.fill();

  // Inner ears
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(9, -18);
  ctx.lineTo(11, -24);
  ctx.lineTo(14, -19);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(21, -19);
  ctx.lineTo(25, -24);
  ctx.lineTo(25.5, -17);
  ctx.closePath();
  ctx.fill();

  // Face (white patch)
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(17, -3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const blink = (Math.sin(t * 0.7 + 2) > 0.96) ? 0.2 : 1;
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(13, -9, 1.8, 2.6 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(20, -9.5, 1.8, 2.6 * blink, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#ff8fab';
  ctx.beginPath();
  ctx.moveTo(16.5, -4.5);
  ctx.lineTo(18.5, -4.5);
  ctx.lineTo(17.5, -3);
  ctx.closePath();
  ctx.fill();

  // Whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.8;
  [-1.5, 0, 1.5].forEach((dy, i) => {
    ctx.beginPath();
    ctx.moveTo(12, -4 + dy);
    ctx.lineTo(2, -5 + dy * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, -4 + dy);
    ctx.lineTo(32, -5 + dy * 1.4);
    ctx.stroke();
  });

  // Paws
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-6, 16, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, 17, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWing(ctx, side, flap, color) {
  // side: -1 (left) or 1 (right)
  ctx.save();
  const spread = 18 + flap * 14;
  const lift = -6 - flap * 10;

  ctx.translate(side * 6, -2);
  ctx.scale(side, 1);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(spread * 0.6, lift, spread, lift + 6);
  ctx.quadraticCurveTo(spread * 0.7, 8, spread * 0.3, 10);
  ctx.quadraticCurveTo(spread * 0.15, 4, 0, 0);
  ctx.closePath();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // feather lines
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(spread * (i / 4), lift * (i / 4) + 3);
    ctx.lineTo(spread * (i / 4) + 4, lift * (i / 4) + 10);
    ctx.stroke();
  }

  ctx.restore();
}
