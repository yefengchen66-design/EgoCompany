import type { OfficeConfig, DepartmentZone, Character, DeskSlot, Vec2 } from '../types.js';

const FLOOR_COLOR = '#1a1a2e';
const FLOOR_LINE_COLOR = '#16213e';
const DESK_COLOR = '#4a3728';
const DESK_TOP_COLOR = '#5c4033';
const CHAIR_COLOR = '#333';

export function renderOffice(
  ctx: CanvasRenderingContext2D,
  config: OfficeConfig,
  characters: Character[],
  camera: Vec2,
  scale: number,
) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-camera.x, -camera.y);

  const ts = config.tileSize;

  // Floor
  ctx.fillStyle = FLOOR_COLOR;
  ctx.fillRect(0, 0, config.cols * ts, config.rows * ts);

  // Grid lines
  ctx.strokeStyle = FLOOR_LINE_COLOR;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= config.cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * ts, 0);
    ctx.lineTo(x * ts, config.rows * ts);
    ctx.stroke();
  }
  for (let y = 0; y <= config.rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * ts);
    ctx.lineTo(config.cols * ts, y * ts);
    ctx.stroke();
  }

  // Department zones
  for (const dept of config.departments) {
    renderDepartmentZone(ctx, dept, ts);
  }

  // Characters (sorted by Y for depth)
  const sorted = [...characters].sort((a, b) => a.pos.y - b.pos.y);
  for (const char of sorted) {
    renderCharacter(ctx, char, ts);
  }

  ctx.restore();
}

function renderDepartmentZone(ctx: CanvasRenderingContext2D, dept: DepartmentZone, ts: number) {
  const x = dept.origin.x * ts;
  const y = dept.origin.y * ts;
  const w = dept.width * ts;
  const h = dept.height * ts;

  // Zone background
  ctx.fillStyle = hexToRgba(dept.color, 0.08);
  ctx.fillRect(x, y, w, h);

  // Zone border
  ctx.strokeStyle = hexToRgba(dept.color, 0.3);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Department label
  ctx.fillStyle = hexToRgba(dept.color, 0.7);
  ctx.font = `bold ${ts * 0.55}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(`${dept.emoji} ${dept.name}`, x + 4, y + ts * 0.7);

  // Desks
  for (const desk of dept.desks) {
    renderDesk(ctx, desk, ts);
  }
}

function renderDesk(ctx: CanvasRenderingContext2D, desk: DeskSlot, ts: number) {
  const cx = desk.tile.x * ts + ts / 2;
  const cy = desk.tile.y * ts + ts / 2;
  const dw = ts * 0.7;
  const dh = ts * 0.4;

  // Desk surface
  ctx.fillStyle = DESK_COLOR;
  ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.fillStyle = DESK_TOP_COLOR;
  ctx.fillRect(cx - dw / 2 + 1, cy - dh / 2, dw - 2, dh / 2);

  // Small monitor on desk
  ctx.fillStyle = desk.occupantId ? '#4fc3f7' : '#333';
  ctx.fillRect(cx - 3, cy - dh / 2 + 2, 6, 4);
}

export function renderCharacter(ctx: CanvasRenderingContext2D, char: Character, ts: number) {
  const { pos, color, state, animFrame, facing, role, bobOffset } = char;

  const opacity = state === 'offline' ? 0.3 : 1.0;
  ctx.globalAlpha = opacity;

  const x = pos.x;
  const y = pos.y + bobOffset;

  const size = ts * 0.35;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.9, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(x - size * 0.4, y - size * 0.3, size * 0.8, size * 0.8);

  // Head
  const headColor = lightenHex(color, 40);
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.5, size * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (based on facing)
  ctx.fillStyle = '#fff';
  const eyeY = y - size * 0.55;
  if (facing === 'down' || facing === 'left' || facing === 'right') {
    const eyeOffX = facing === 'left' ? -2 : facing === 'right' ? 2 : 0;
    ctx.fillRect(x - 3 + eyeOffX, eyeY, 2, 2);
    ctx.fillRect(x + 1 + eyeOffX, eyeY, 2, 2);
    // Pupils
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2 + eyeOffX, eyeY + 0.5, 1, 1);
    ctx.fillRect(x + 2 + eyeOffX, eyeY + 0.5, 1, 1);
  }

  // Director crown
  if (role === 'director') {
    ctx.fillStyle = '#FFD700';
    const crownY = y - size * 0.85;
    ctx.fillRect(x - 4, crownY, 8, 3);
    ctx.fillRect(x - 4, crownY - 2, 2, 2);
    ctx.fillRect(x - 1, crownY - 3, 2, 3);
    ctx.fillRect(x + 2, crownY - 2, 2, 2);
  }

  // Typing animation — small sparkles
  if (state === 'typing') {
    const sparkle = animFrame % 2 === 0;
    if (sparkle) {
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(x + size * 0.3, y - size * 0.2, 2, 2);
      ctx.fillRect(x + size * 0.5, y - size * 0.4, 2, 2);
    }
  }

  // Walking animation — feet
  if (state === 'walking') {
    const step = Math.floor(animFrame) % 2;
    ctx.fillStyle = darkenHex(color, 30);
    if (step === 0) {
      ctx.fillRect(x - size * 0.3, y + size * 0.5, size * 0.25, size * 0.15);
      ctx.fillRect(x + size * 0.05, y + size * 0.45, size * 0.25, size * 0.15);
    } else {
      ctx.fillRect(x - size * 0.3, y + size * 0.45, size * 0.25, size * 0.15);
      ctx.fillRect(x + size * 0.05, y + size * 0.5, size * 0.25, size * 0.15);
    }
  }

  // Zzz for offline
  if (state === 'offline') {
    ctx.fillStyle = '#666';
    ctx.font = `${size * 0.4}px monospace`;
    ctx.fillText('z', x + size * 0.3, y - size * 0.7 - (animFrame % 3));
    ctx.fillText('Z', x + size * 0.5, y - size * 1.0 - (animFrame % 3));
  }

  // Status bubble for busy (typing)
  if (state === 'typing') {
    ctx.fillStyle = 'rgba(79, 195, 247, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y - size * 1.2, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fc3f7';
    ctx.font = `${size * 0.35}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡', x, y - size * 1.1);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// Utility functions
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Suppress unused variable warning for CHAIR_COLOR
void CHAIR_COLOR;
