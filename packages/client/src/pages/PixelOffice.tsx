import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api } from '@/api/client';
import { useWebSocket } from '@/api/ws';
import { useI18n } from '@/i18n/context';

// ========== CONSTANTS ==========
const T = 16, MW = 24, MH = 16, CW = MW * T, CH = MH * T;
const HAIR = ['#1A0A00','#3A2010','#6B4520','#A07840','#D0B060','#1A1A30','#4A1A10','#C06830','#E8D090','#2A1A2A','#707070','#F0E0C0'];
const SHIRT = ['#4080C0','#C04848','#40A060','#C0A030','#7858C0','#C06080','#40B0A8','#D08040','#6080A0','#A0A040','#D06868','#4060A0','#A05050','#50A0A0'];
const SKIN = ['#F5C5A3','#E8A87C','#D09060','#C08050','#A06040','#F0D8C0','#804830'];
const PANTS = ['#2A2A48','#383838','#2A3828','#483828','#242424','#303050'];
const STAT_LABELS = {
  en: { working: 'Working', idle: 'Standby', resting: 'Idle', waiting: 'Offline' },
  zh: { working: '工作中', idle: '待命', resting: '空闲', waiting: '离线' },
} as const;

// Department color configs (mapped by index)
const DEPT_COLORS = [
  { fc: '#8B7555', cc: '#3B5580', cl: '#4A90D9' },   // 0 engineering
  { fc: '#8B7565', cc: '#5B3580', cl: '#D94A90' },   // 1 design
  { fc: '#857B65', cc: '#403560', cl: '#9060D0' },   // 2 product
  { fc: '#8B7555', cc: '#804530', cl: '#D9904A' },   // 3 marketing
  { fc: '#857565', cc: '#305530', cl: '#40C060' },   // 4 sales
  { fc: '#8B7B55', cc: '#503020', cl: '#D06040' },   // 5 paid-media
  { fc: '#8B7B65', cc: '#504520', cl: '#D0A030' },   // 6 project-mgmt
  { fc: '#7B7565', cc: '#502020', cl: '#D04040' },   // 7 qa
  { fc: '#7B7B65', cc: '#204050', cl: '#40A0D0' },   // 8 data-ai
  { fc: '#7B8565', cc: '#204020', cl: '#30A050' },   // 9 infrastructure
  { fc: '#7B6575', cc: '#402040', cl: '#D04090' },   // 10 game-dev
  { fc: '#7B8555', cc: '#205520', cl: '#40D060' },   // 11 finance
  { fc: '#7B6555', cc: '#403020', cl: '#A07050' },   // 12 legal
  { fc: '#7B7B65', cc: '#205050', cl: '#40C0D0' },   // 13 customer-service
  { fc: '#7B7B7B', cc: '#303040', cl: '#A0A0D0' },   // 14 support
];

// ========== HELPERS ==========
function rng(seed: number) {
  return { s: seed, next(n: number) { this.s = (this.s * 1103515245 + 12345) & 0x7fffffff; return this.s % n; } };
}

function mkApp(seed: number) {
  const r = rng(seed);
  return { skin: SKIN[r.next(SKIN.length)], hair: HAIR[r.next(HAIR.length)], shirt: SHIRT[r.next(SHIRT.length)],
    pants: PANTS[r.next(PANTS.length)], hs: r.next(5), gender: r.next(2) };
}

type Appearance = ReturnType<typeof mkApp>;

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt), g = Math.min(255, ((n >> 8) & 255) + amt), b = Math.min(255, (n & 255) + amt);
  return '#' + (Math.max(0, r) << 16 | Math.max(0, g) << 8 | Math.max(0, b)).toString(16).padStart(6, '0');
}
function darken(hex: string, amt: number) { return lighten(hex, -amt); }

// ========== TILE DRAW ==========
function dFloor(cx: CanvasRenderingContext2D, x: number, y: number, a: string, b: string) {
  const tx = x / T | 0, ty = y / T | 0;
  cx.fillStyle = (tx + ty) % 2 ? a : b;
  cx.fillRect(x, y, T, T);
}
function dCarpet(cx: CanvasRenderingContext2D, x: number, y: number, a: string, b: string) {
  cx.fillStyle = (x / T + y / T | 0) % 2 ? a : b; cx.fillRect(x, y, T, T);
}
function dWall(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#181828'; cx.fillRect(x, y, T, T);
  cx.fillStyle = '#222238'; cx.fillRect(x + 1, y + 1, T - 2, T - 2);
  cx.fillStyle = '#2A2A42'; cx.fillRect(x + 1, y + T - 3, T - 2, 2);
}
function dWallTop(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#222238'; cx.fillRect(x, y, T, T);
  cx.fillStyle = '#2E2E48'; cx.fillRect(x, y + T - 5, T, 4);
  cx.fillStyle = '#383858'; cx.fillRect(x + 1, y + T - 4, T - 2, 2);
  cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.fillRect(x, y + T - 1, T, 1);
}
function dDoor(cx: CanvasRenderingContext2D, x: number, y: number, fa: string) {
  cx.fillStyle = fa; cx.fillRect(x, y, T, T);
  cx.fillStyle = '#5A3A1A'; cx.fillRect(x + 2, y, 12, 3);
}

// ========== FURNITURE ==========
function dDesk(cx: CanvasRenderingContext2D, x: number, y: number, glow: boolean) {
  cx.fillStyle = '#604820'; cx.fillRect(x + 1, y + 9, 14, 5);
  cx.fillStyle = '#906830'; cx.fillRect(x + 1, y + 5, 14, 5);
  cx.fillStyle = '#A07838'; cx.fillRect(x + 1, y + 4, 14, 2);
  cx.fillStyle = '#181828'; cx.fillRect(x + 4, y + 1, 8, 5);
  cx.fillStyle = glow ? '#60E8C0' : '#40B898'; cx.fillRect(x + 5, y + 2, 6, 3);
  if (glow) { cx.fillStyle = 'rgba(64,184,152,0.15)'; cx.fillRect(x + 2, y, 12, 8); }
  cx.fillStyle = '#181828'; cx.fillRect(x + 7, y + 6, 2, 1);
  cx.fillStyle = '#E0E0E8'; cx.fillRect(x + 1, y + 5, 2, 2);
}
function dChair(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#383850'; cx.fillRect(x + 3, y + 2, 10, 3);
  cx.fillStyle = '#484868'; cx.fillRect(x + 4, y + 5, 8, 7);
  cx.fillStyle = '#2A2A40'; cx.fillRect(x + 5, y + 12, 2, 2); cx.fillRect(x + 9, y + 12, 2, 2);
}
function dShelf(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#5A3A10'; cx.fillRect(x + 1, y, 14, T);
  cx.fillStyle = '#4A2A08'; cx.fillRect(x + 1, y + 5, 14, 1); cx.fillRect(x + 1, y + 11, 14, 1);
  const c = ['#C04040', '#4060C0', '#40A050', '#C0A030', '#8040A0'];
  for (let i = 0; i < 4; i++) { cx.fillStyle = c[(x / T + i) % 5 | 0]; cx.fillRect(x + 2 + i * 3, y + 1, 2, 4); cx.fillStyle = c[(x / T + i + 2) % 5 | 0]; cx.fillRect(x + 2 + i * 3, y + 6, 2, 5); }
}
function dPlant(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#5A3818'; cx.fillRect(x + 5, y + 10, 6, 5); cx.fillStyle = '#7A5028'; cx.fillRect(x + 4, y + 9, 8, 2);
  cx.fillStyle = '#2A6838'; cx.fillRect(x + 6, y + 4, 4, 6);
  cx.fillStyle = '#38A050'; cx.fillRect(x + 4, y + 2, 3, 4); cx.fillRect(x + 9, y + 2, 3, 4); cx.fillRect(x + 5, y + 0, 6, 4);
  cx.fillStyle = '#48C068'; cx.fillRect(x + 6, y + 1, 4, 2);
}
function dCoffee(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#505068'; cx.fillRect(x + 3, y + 2, 10, 12); cx.fillStyle = '#606078'; cx.fillRect(x + 4, y + 3, 8, 4);
  cx.fillStyle = '#D06020'; cx.fillRect(x + 5, y + 4, 2, 2); cx.fillStyle = '#40A0E0'; cx.fillRect(x + 9, y + 4, 2, 2);
  cx.fillStyle = '#404058'; cx.fillRect(x + 5, y + 9, 6, 4); cx.fillStyle = '#7A5030'; cx.fillRect(x + 6, y + 10, 4, 3);
}
function dFridge(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#A8A8B8'; cx.fillRect(x + 2, y, 12, T); cx.fillStyle = '#9898A8'; cx.fillRect(x + 3, y + 1, 10, 6); cx.fillRect(x + 3, y + 9, 10, 6);
  cx.fillStyle = '#787888'; cx.fillRect(x + 12, y + 2, 1, 4); cx.fillRect(x + 12, y + 10, 1, 4);
}
function dClock(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#D8D8E0'; cx.fillRect(x + 4, y + 3, 8, 8); cx.fillStyle = '#F0F0F8'; cx.fillRect(x + 5, y + 4, 6, 6);
  cx.fillStyle = '#181828'; cx.fillRect(x + 7, y + 5, 1, 3); cx.fillRect(x + 8, y + 6, 2, 1);
}
function dPaint(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#5A3818'; cx.fillRect(x + 2, y + 2, 12, 10); cx.fillStyle = '#70B8E0'; cx.fillRect(x + 3, y + 3, 10, 5);
  cx.fillStyle = '#48A058'; cx.fillRect(x + 3, y + 7, 10, 4); cx.fillStyle = '#E8C040'; cx.fillRect(x + 10, y + 3, 3, 3);
  cx.fillStyle = '#387838'; cx.fillRect(x + 5, y + 5, 3, 6);
}
function dVend(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#3050A0'; cx.fillRect(x + 2, y, 12, T); cx.fillStyle = '#4060B0'; cx.fillRect(x + 3, y + 1, 10, 8);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { cx.fillStyle = ['#C04040', '#40A040', '#D0A030'][c]; cx.fillRect(x + 4 + c * 3, y + 2 + r * 2, 2, 1); }
  cx.fillStyle = '#181828'; cx.fillRect(x + 4, y + 11, 8, 4);
}
function dWB(cx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  for (let i = 0; i < w; i++) {
    cx.fillStyle = '#B0B0C0'; cx.fillRect(x + i * T + 1, y + 2, T - 2, 10); cx.fillStyle = '#E0E0F0'; cx.fillRect(x + i * T + 2, y + 3, T - 4, 8);
  }
  cx.fillStyle = '#3858B0'; cx.fillRect(x + 4, y + 5, 8, 1); cx.fillRect(x + 4, y + 7, 5, 1);
  if (w > 1) { cx.fillStyle = '#B83838'; cx.fillRect(x + T + 3, y + 5, 7, 1); cx.fillStyle = '#38A048'; cx.fillRect(x + T + 3, y + 7, 9, 1); }
}
function dConfTable(cx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  cx.fillStyle = '#4A2810'; cx.fillRect(x + 2, y + 2, w * T - 4, h * T - 4);
  cx.fillStyle = '#6A4828'; cx.fillRect(x + 3, y + 3, w * T - 6, h * T - 6);
  cx.fillStyle = '#7A5838'; cx.fillRect(x + 5, y + 5, w * T - 10, h * T - 10);
  cx.fillStyle = '#684020'; cx.fillRect(x + 4, y + (h * T / 2 - 1 | 0), w * T - 8, 2);
}
function dSofa(cx: CanvasRenderingContext2D, x: number, y: number) {
  cx.fillStyle = '#6A2838'; cx.fillRect(x + 1, y + 4, 14, 10); cx.fillStyle = '#8A3848'; cx.fillRect(x + 2, y + 5, 12, 8);
  cx.fillStyle = '#5A1828'; cx.fillRect(x + 1, y + 4, 2, 10); cx.fillRect(x + 13, y + 4, 2, 10);
}

// ========== CHARACTERS ==========
function dChar(cx: CanvasRenderingContext2D, x: number, y: number, ap: Appearance, st: string, fr: number, isLd: boolean) {
  const f = (fr / 12 | 0) % 4, bob = st === 'idle' ? (f % 2 ? -1 : 0) : 0, py = y + bob;

  cx.fillStyle = ap.pants;
  if (st === 'walking') { const s = f % 2; cx.fillRect(x - 3 - s, py + 4, 3, 4); cx.fillRect(x + 1 + s, py + 4, 3, 4); }
  else { cx.fillRect(x - 3, py + 4, 3, 4); cx.fillRect(x + 1, py + 4, 3, 4); }
  cx.fillStyle = '#181828';
  cx.fillRect(x - 3, py + 8, 3, 1); cx.fillRect(x + 1, py + 8, 3, 1);

  cx.fillStyle = ap.shirt;
  cx.fillRect(x - 4, py - 1, 9, 6);
  const lighter = lighten(ap.shirt, 20);
  cx.fillStyle = lighter; cx.fillRect(x - 3, py, 2, 4);

  cx.fillStyle = ap.skin;
  if (st === 'working') { const a = f % 2; cx.fillRect(x - 5, py + a, 2, 3); cx.fillRect(x + 5, py - a, 2, 3); }
  else { cx.fillRect(x - 5, py + 1, 2, 3); cx.fillRect(x + 5, py + 1, 2, 3); }

  cx.fillStyle = ap.skin;
  cx.fillRect(x - 4, py - 8, 9, 7);

  cx.fillStyle = ap.hair;
  const hs = ap.hs;
  cx.fillRect(x - 4, py - 9, 9, 3);
  if (hs === 0) { cx.fillRect(x - 5, py - 8, 1, 5); cx.fillRect(x + 5, py - 8, 1, 5); }
  else if (hs === 1) { cx.fillRect(x - 5, py - 9, 1, 6); cx.fillRect(x + 5, py - 9, 1, 6); cx.fillRect(x - 4, py - 10, 9, 2); }
  else if (hs === 2) { cx.fillRect(x - 5, py - 8, 1, 7); cx.fillRect(x + 5, py - 8, 1, 7); }
  else if (hs === 3) { cx.fillRect(x - 4, py - 10, 9, 2); cx.fillRect(x - 5, py - 9, 2, 4); cx.fillRect(x + 4, py - 9, 2, 4); }
  else { cx.fillRect(x - 4, py - 10, 9, 3); cx.fillRect(x - 5, py - 9, 1, 3); cx.fillRect(x + 5, py - 9, 1, 3); }

  cx.fillStyle = '#181828';
  if (st === 'idle' && f === 3) { cx.fillRect(x - 2, py - 5, 2, 1); cx.fillRect(x + 2, py - 5, 2, 1); }
  else { cx.fillRect(x - 2, py - 5, 1, 2); cx.fillRect(x + 2, py - 5, 1, 2); }

  if (st === 'waiting') { cx.fillStyle = '#E0E0F0'; cx.fillRect(x - 1, py - 3, 3, 1); }
  else { cx.fillStyle = '#D08080'; cx.fillRect(x, py - 3, 1, 1); }

  if (isLd) {
    cx.fillStyle = '#D9A04A';
    cx.fillRect(x - 2, py - 11, 1, 1); cx.fillRect(x, py - 12, 1, 1); cx.fillRect(x + 2, py - 11, 1, 1);
    cx.fillRect(x - 3, py - 10, 7, 1);
  }

  if (st === 'waiting') {
    const bk = (fr / 18 | 0) % 6;
    if (bk < 3) {
      cx.fillStyle = '#FFF'; cx.fillRect(x - 9, py - 16, 16, 9);
      cx.fillStyle = '#181828'; cx.fillRect(x - 8, py - 15, 14, 7);
      cx.fillStyle = '#FFF'; cx.fillRect(x - 7, py - 14, 12, 5);
      cx.fillStyle = '#E04040';
      cx.fillRect(x - 5, py - 13, 1, 1); cx.fillRect(x - 3, py - 12, 1, 1); cx.fillRect(x - 5, py - 12, 1, 1);
    }
  }
  if (st === 'working') {
    const sparkF = (fr / 6 | 0) % 8;
    if (sparkF < 3) {
      cx.fillStyle = 'rgba(64,184,152,0.5)';
      cx.fillRect(x - 4 - sparkF, py - 14, 1 + sparkF, 1);
      cx.fillRect(x + 3 + sparkF, py - 13, 1 + sparkF, 1);
    }
  }
}

// ========== FLOOR LAYOUT ==========
interface Furniture { t: string; x: number; y: number; w?: number; h?: number }
interface Seat { x: number; y: number }
interface Layout { g: string[][]; fur: Furniture[]; seats: Seat[]; ld: { x: number; y: number } }

function mkFloor(agentCount: number): Layout {
  // Dynamic floor size: scale height based on agent count
  // Small teams (<=8): standard MH=16. Large teams: grow vertically.
  const ac = agentCount;
  const neededRows = Math.ceil(ac / 6); // 6 desks per row
  const floorH = Math.max(MH, neededRows * 3 + 6); // 3 tiles per desk row + walls/margins
  const g: string[][] = [];
  for (let y = 0; y < floorH; y++) { g[y] = []; for (let x = 0; x < MW; x++) g[y][x] = 'f'; }
  // Walls
  for (let x = 0; x < MW; x++) { g[0][x] = 'w'; g[1][x] = 't'; g[floorH - 1][x] = 'w'; }
  for (let y = 0; y < floorH; y++) { g[y][0] = 'w'; g[y][MW - 1] = 'w'; }

  // Leader office (top-right corner, compact)
  const lx = MW - 5;
  for (let y = 1; y <= 5; y++) g[y][lx] = 'w';
  g[4][lx] = 't'; g[5][lx] = 'd';
  for (let x = lx + 1; x < MW - 1; x++) for (let y = 2; y <= 4; y++) g[y][x] = 'c';

  const fur: Furniture[] = [];
  fur.push({ t: 'desk', x: lx + 1, y: 3 });
  fur.push({ t: 'chair', x: lx + 1, y: 4 });
  fur.push({ t: 'shelf', x: MW - 2, y: 1 });

  // Work area: fill from y=3 downward, 6 columns with spacing 3
  const seats: Seat[] = [];
  const cols = Math.min(6, Math.max(2, Math.ceil(ac / Math.ceil(ac / 6))));
  const sp = 3; // tighter spacing: 3 tiles between desks
  const sx = 2, sy = 3;
  let ai = 0;
  for (let r = 0; ai < ac; r++) {
    const ry = sy + r * 3;
    if (ry + 1 >= floorH - 1) break;
    for (let c = 0; c < cols && ai < ac; c++) {
      const dx = sx + c * sp;
      if (dx >= lx - 1) continue; // don't overlap leader office
      if (ry + 1 >= floorH - 1) break;
      fur.push({ t: 'desk', x: dx, y: ry });
      fur.push({ t: 'chair', x: dx, y: ry + 1 });
      seats.push({ x: dx * T + T / 2, y: (ry + 1) * T + T / 2 });
      ai++;
    }
  }

  // Decorations
  fur.push({ t: 'shelf', x: 1, y: 1 }); fur.push({ t: 'shelf', x: 2, y: 1 });
  fur.push({ t: 'plant', x: 1, y: floorH - 2 }); fur.push({ t: 'plant', x: MW - 2, y: floorH - 2 });
  fur.push({ t: 'clock', x: (MW / 2 | 0), y: 1 });
  if (ac <= 10) { fur.push({ t: 'coffee', x: lx - 2, y: floorH - 3 }); fur.push({ t: 'fridge', x: lx - 1, y: 1 }); }
  if (ac <= 6) { fur.push({ t: 'sofa', x: sx, y: floorH - 3 }); fur.push({ t: 'plant', x: lx + 1, y: 2 }); }

  return { g, fur, seats, ld: { x: (lx + 1) * T + T / 2, y: 4 * T + T / 2 } };
}

function mkMeeting(): Layout {
  const g: string[][] = [];
  for (let y = 0; y < MH; y++) { g[y] = []; for (let x = 0; x < MW; x++) g[y][x] = 'c'; }
  for (let x = 0; x < MW; x++) { g[0][x] = 'w'; g[1][x] = 't'; g[MH - 1][x] = 'w'; }
  for (let y = 0; y < MH; y++) { g[y][0] = 'w'; g[y][MW - 1] = 'w'; }

  const fur: Furniture[] = [];
  const tw = 8, th = 4, tx = 7, ty = 5;
  fur.push({ t: 'conf', x: tx, y: ty, w: tw, h: th });

  const seats: Seat[] = [];
  for (let i = 0; i < 6; i++) { fur.push({ t: 'chair', x: tx + 1 + i, y: ty - 1 }); seats.push({ x: (tx + 1 + i) * T + T / 2, y: (ty - 1) * T + T / 2 }); }
  for (let i = 0; i < 6; i++) { fur.push({ t: 'chair', x: tx + 1 + i, y: ty + th }); seats.push({ x: (tx + 1 + i) * T + T / 2, y: (ty + th) * T + T / 2 }); }

  fur.push({ t: 'chair', x: tx - 1, y: ty + 1 });

  fur.push({ t: 'wb', x: 8, y: 1, w: 3 });
  fur.push({ t: 'plant', x: 1, y: 2 }); fur.push({ t: 'plant', x: MW - 2, y: 2 });
  fur.push({ t: 'plant', x: 1, y: MH - 2 }); fur.push({ t: 'plant', x: MW - 2, y: MH - 2 });
  fur.push({ t: 'clock', x: 16, y: 1 }); fur.push({ t: 'paint', x: 3, y: 1 });
  fur.push({ t: 'shelf', x: 1, y: 1 }); fur.push({ t: 'shelf', x: MW - 2, y: 1 });
  fur.push({ t: 'plant', x: tx + tw + 1, y: ty + 1 });

  return { g, fur, seats, ld: { x: (tx - 1) * T + T / 2, y: (ty + 1) * T + T / 2 } };
}

// ========== RENDER ==========
interface PixelAgent {
  id: string; name: string; emoji: string; dep: number; isLd: boolean;
  ap: Appearance; st: string; x: number; y: number; fr: number;
  departmentId: string; role: string; status: string;
}

function renderScene(
  cx: CanvasRenderingContext2D, floor: number, layouts: Layout[], meetLay: Layout,
  floorAgents: PixelAgent[], selAgent: PixelAgent | null, frame: number, deptColors: typeof DEPT_COLORS,
  meetingFloor: number
) {
  const isM = floor === meetingFloor;
  const lay = isM ? meetLay : layouts[floor];
  if (!lay) return;
  const fh = lay.g.length; // dynamic floor height
  const cw = MW * T, ch = fh * T;
  cx.clearRect(0, 0, cw, ch);
  const dc = isM ? null : deptColors[floor];
  const fa = dc ? dc.fc : '#3B4B60', fb = dc ? darken(dc.fc, 12) : '#2D3D50';
  const ca = dc ? dc.cc : '#2D3D55', cb = dc ? darken(dc.cc, 8) : '#253348';

  for (let y = 0; y < fh; y++) for (let x = 0; x < MW; x++) {
    const t = lay.g[y][x], px = x * T, py = y * T;
    if (t === 'w') dWall(cx, px, py); else if (t === 't') dWallTop(cx, px, py);
    else if (t === 'f') dFloor(cx, px, py, fa, fb); else if (t === 'c') dCarpet(cx, px, py, ca, cb);
    else if (t === 'd') dDoor(cx, px, py, fa);
  }

  lay.fur.forEach(f => {
    const px = f.x * T, py = f.y * T;
    if (f.t === 'desk') {
      const nearby = floorAgents.find(a => Math.abs(a.x - px - T / 2) < T * 1.5 && Math.abs(a.y - py - T) < T * 2);
      dDesk(cx, px, py, !!(nearby && nearby.st === 'working'));
    } else if (f.t === 'chair') dChair(cx, px, py);
    else if (f.t === 'shelf') dShelf(cx, px, py); else if (f.t === 'plant') dPlant(cx, px, py);
    else if (f.t === 'coffee') dCoffee(cx, px, py); else if (f.t === 'fridge') dFridge(cx, px, py);
    else if (f.t === 'clock') dClock(cx, px, py); else if (f.t === 'paint') dPaint(cx, px, py);
    else if (f.t === 'vend') dVend(cx, px, py); else if (f.t === 'sofa') dSofa(cx, px, py);
    else if (f.t === 'conf') dConfTable(cx, px, py, f.w!, f.h!); else if (f.t === 'wb') dWB(cx, px, py, f.w!);
  });

  const sorted = [...floorAgents].sort((a, b) => a.y - b.y);
  sorted.forEach(a => {
    if (a.st === 'working' && frame % 30 < 15) {
      cx.fillStyle = 'rgba(60,190,90,0.08)';
      cx.fillRect(a.x - 8, a.y - 10, 16, 20);
    }
    if (a.st === 'resting' && frame % 40 < 20) {
      cx.fillStyle = 'rgba(60,120,220,0.06)';
      cx.fillRect(a.x - 8, a.y - 10, 16, 20);
    }
    if (a.st === 'waiting') {
      cx.fillStyle = 'rgba(210,70,70,0.06)';
      cx.fillRect(a.x - 8, a.y - 10, 16, 20);
    }
    // 'resting' uses 'idle' animation (bob) with blue tint handled above
    const charSt = a.st === 'resting' ? 'idle' : a.st;
    dChar(cx, a.x, a.y, a.ap, charSt, a.fr, a.isLd);
  });

  if (selAgent && selAgent.dep === floor) {
    cx.save();
    cx.strokeStyle = '#D9A04A'; cx.lineWidth = 1; cx.setLineDash([2, 2]);
    cx.strokeRect(selAgent.x - 7, selAgent.y - 14, 14, 24);
    cx.restore();
    // Extract English name for canvas label
    const nameMatch = selAgent.name.match(/\(([^)]+)\)/);
    const label = nameMatch ? nameMatch[1] : selAgent.name;
    cx.font = '6px monospace';
    const tw = cx.measureText(label).width + 6;
    const lx = selAgent.x - tw / 2, ly = selAgent.y - 24;
    cx.fillStyle = 'rgba(0,0,0,0.7)'; cx.fillRect(lx - 1, ly - 1, tw + 2, 10);
    cx.fillStyle = 'rgba(217,160,74,0.3)'; cx.fillRect(lx, ly, tw, 8);
    cx.fillStyle = '#F0E8D0';
    cx.fillText(label, lx + 3, ly + 6);
  }

  // Border
  cx.fillStyle = 'rgba(0,0,0,0.2)';
  cx.fillRect(0, 0, cw, 1); cx.fillRect(0, ch - 1, cw, 1); cx.fillRect(0, 0, 1, ch); cx.fillRect(cw - 1, 0, 1, ch);

  // Floor indicator
  cx.fillStyle = 'rgba(0,0,0,0.55)'; cx.fillRect(cw - 38, ch - 14, 36, 12);
  cx.fillStyle = 'rgba(74,144,217,0.6)'; cx.fillRect(cw - 37, ch - 13, 34, 10);
  cx.fillStyle = 'rgba(0,0,0,0.55)'; cx.fillRect(cw - 36, ch - 12, 32, 8);
  cx.fillStyle = '#A0C0E0'; cx.font = 'bold 7px monospace';
  cx.fillText(`F${floor + 1}`, cw - 33, ch - 6);

  // Scanline CRT effect
  for (let sy = 0; sy < ch; sy += 2) {
    cx.fillStyle = 'rgba(0,0,0,0.04)';
    cx.fillRect(0, sy, cw, 1);
  }
}

// ========== CSS ==========
const CSS = `
.po-root{display:flex;flex-direction:column;height:100%;width:100%;background:#080810;color:#c0c0d0;font-family:'Courier New','Menlo',monospace;font-size:12px;overflow:hidden;border-radius:12px}
.po-header{display:flex;align-items:center;padding:8px 14px;background:#0e0e1a;border-bottom:2px solid #222238;gap:10px;flex-shrink:0}
.po-header h1{font-size:13px;color:#d9a04a;letter-spacing:2px;margin:0}
.po-header p{font-size:9px;color:#555568;margin:0}
.po-body{display:flex;flex:1;min-height:0}
.po-sidebar{width:190px;background:#0e0e1a;border-right:2px solid #222238;display:flex;flex-direction:column;flex-shrink:0;overflow:hidden}
.po-sidebar-inner{flex:1;overflow-y:auto;padding:4px 6px}
.po-sidebar-inner::-webkit-scrollbar{width:3px}
.po-sidebar-inner::-webkit-scrollbar-thumb{background:#222238;border-radius:2px}
.po-fbtn{display:flex;align-items:center;width:100%;padding:7px 8px;margin-bottom:2px;background:transparent;border:1px solid transparent;border-radius:3px;color:#c0c0d0;cursor:pointer;font-family:inherit;font-size:11px;text-align:left;transition:all .12s}
.po-fbtn:hover{background:#151525;border-color:#222238}
.po-fbtn.act{background:#141430;border-color:#4a90d9;color:#8ab8e8}
.po-fbtn .fn{width:26px;height:18px;line-height:18px;text-align:center;background:#222238;border-radius:2px;margin-right:6px;font-size:9px;font-weight:bold;flex-shrink:0}
.po-fbtn.act .fn{background:#4a90d9;color:#fff}
.po-fbtn .fi{margin-right:5px;font-size:12px}
.po-fbtn .fm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.po-fbtn .fc{font-size:8px;color:#555568;background:#222238;padding:1px 4px;border-radius:6px;margin-left:auto}
.po-fbtn.meeting{margin-top:6px;border-top:1px solid #222238;padding-top:9px}
.po-fbtn.meeting .fn{background:#d9a04a;color:#000}
.po-mini{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 12px}
.po-center{flex:1;display:flex;flex-direction:column;min-width:0}
.po-topbar{height:32px;background:#0e0e1a;border-bottom:2px solid #222238;display:flex;align-items:center;padding:0 14px;gap:10px;flex-shrink:0}
.po-topbar .fl{font-size:12px;font-weight:bold;color:#d9a04a}
.po-topbar .sep{color:#222238}
.po-topbar .dn{color:#4a90d9;font-size:11px}
.po-topbar .stats{margin-left:auto;display:flex;gap:10px;font-size:10px}
.po-st{display:flex;align-items:center;gap:3px}
.po-dot{width:6px;height:6px;border-radius:50%;display:inline-block}
.po-dot.w{background:#3dbf5e;box-shadow:0 0 4px #3dbf5e}
.po-dot.i{background:#d0a030}
.po-dot.r{background:#d04848;animation:po-blink 1.2s infinite}
@keyframes po-blink{0%,100%{opacity:1}50%{opacity:.3}}
.po-cvs-wrap{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#060610}
.po-cvs-wrap canvas{image-rendering:pixelated;image-rendering:crisp-edges;cursor:crosshair;display:block}
.po-actbar{height:80px;background:#0e0e1a;border-top:2px solid #222238;display:flex;flex-direction:column;flex-shrink:0}
.po-actbar .ah{padding:3px 12px;font-size:9px;color:#4a90d9;border-bottom:1px solid #222238;display:flex;align-items:center;gap:5px}
.po-actbar .ld{width:5px;height:5px;border-radius:50%;background:#d04848;animation:po-blink .8s infinite}
.po-actfeed{flex:1;overflow-y:auto;padding:2px 12px;font-size:10px}
.po-actfeed::-webkit-scrollbar{width:2px}
.po-actfeed::-webkit-scrollbar-thumb{background:#222238}
.po-ai{padding:1px 0;border-bottom:1px solid #0a0a14}
.po-ai .t{color:#555568}
.po-ai .n{color:#4a90d9}
.po-ai .a{color:#777}
.po-rpanel{width:240px;background:#0e0e1a;border-left:2px solid #222238;display:flex;flex-direction:column;flex-shrink:0;overflow:hidden}
.po-rpanel .rh{padding:8px 12px;border-bottom:2px solid #222238;font-size:11px;color:#4a90d9;text-align:center}
.po-alist{flex:1;overflow-y:auto;padding:6px}
.po-alist::-webkit-scrollbar{width:3px}
.po-alist::-webkit-scrollbar-thumb{background:#222238}
.po-ac{background:#0a0a14;border:1px solid #1a1a28;border-radius:3px;padding:7px 8px;margin-bottom:4px;cursor:pointer;transition:all .12s}
.po-ac:hover{border-color:#2a2a48;background:#101020}
.po-ac.sel{border-color:#d9a04a;background:#14142a}
.po-ac .at{display:flex;align-items:center;gap:5px;margin-bottom:3px}
.po-ac .ai2{font-size:14px}
.po-ac .an{font-size:10px;font-weight:bold;flex:1}
.po-ac .as{font-size:8px;padding:2px 5px;border-radius:6px;font-weight:bold;letter-spacing:.5px}
.po-as-working{background:#0a2a0a;color:#3dbf5e}
.po-as-resting{background:#0a1a2a;color:#60a0e0}
.po-as-idle{background:#2a2a0a;color:#d0a030}
.po-as-waiting{background:#2a0a0a;color:#d04848}
.po-ltag{font-size:7px;background:#d9a04a;color:#000;padding:1px 3px;border-radius:2px;margin-left:3px;font-weight:bold;vertical-align:middle}
`;

// ========== MEETING ROOM PANEL ==========
function MeetingRoomPanel({ departments: depts }: { departments: any[] }) {
  const { agentName, deptName, lang } = useI18n();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState('');
  const [followup, setFollowup] = useState('');
  const [activeTab, setActiveTab] = useState<'new' | 'active' | 'history'>('new');

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings-panel'],
    queryFn: api.getMeetings,
    refetchInterval: 3000,
  });

  const activeMeeting = meetings.find((m: any) => m.status === 'in_progress' || m.status === 'pending');
  const completedMeetings = meetings.filter((m: any) => m.status === 'completed');

  const directors = depts.map((d: any) => {
    const directorIds: Record<string, string> = {
      engineering: 'eng-000', design: 'des-000', product: 'prd-000', marketing: 'mkt-000',
      sales: 'sal-000', 'paid-media': 'pmd-000', 'project-mgmt': 'pmg-000', qa: 'qa-000',
      'data-ai': 'dai-000', infrastructure: 'inf-000', 'game-dev': 'gam-000',
      finance: 'fin-000', legal: 'leg-000', 'customer-service': 'csr-000', support: 'sup-000',
    };
    return { deptId: d.id, directorId: directorIds[d.id] || '', emoji: d.emoji };
  });

  const toggle = (dirId: string) => {
    const next = new Set(selected);
    if (next.has(dirId)) next.delete(dirId); else next.add(dirId);
    setSelected(next);
  };

  const createMeeting = useMutation({
    mutationFn: () => api.createMeeting({
      title: lang === 'en' ? 'Executive Meeting' : '高管会议',
      topic,
      participantIds: Array.from(selected),
    }),
    onSuccess: () => {
      setTopic(''); setSelected(new Set()); setActiveTab('active');
      queryClient.invalidateQueries({ queryKey: ['meetings-panel'] });
    },
  });

  const sendFollowup = useMutation({
    mutationFn: () => {
      if (!activeMeeting) throw new Error('No active meeting');
      return api.meetingFollowup(activeMeeting.id, followup);
    },
    onSuccess: () => { setFollowup(''); queryClient.invalidateQueries({ queryKey: ['meetings-panel'] }); },
  });

  const dispatch = useMutation({
    mutationFn: () => {
      if (!activeMeeting) throw new Error('No meeting');
      return api.dispatchMeetingWork(activeMeeting.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings-panel'] }),
  });

  return (
    <div className="po-rpanel" style={{ width: 300 }}>
      <div className="rh">🏛️ {lang === 'en' ? 'Meeting Room' : '会议室'}</div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222238' }}>
        {[
          { key: 'new' as const, label: lang === 'en' ? 'New' : '新建' },
          { key: 'active' as const, label: lang === 'en' ? 'Active' : '进行中', badge: activeMeeting ? 1 : 0 },
          { key: 'history' as const, label: lang === 'en' ? 'History' : '历史', badge: completedMeetings.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '6px 4px', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
              background: activeTab === tab.key ? '#141430' : 'transparent',
              color: activeTab === tab.key ? '#4a90d9' : '#555568',
              border: 'none', borderBottom: activeTab === tab.key ? '2px solid #4a90d9' : '2px solid transparent',
            }}>
            {tab.label}{tab.badge ? ` (${tab.badge})` : ''}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* NEW MEETING TAB */}
        {activeTab === 'new' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 9, color: '#555568' }}>{lang === 'en' ? 'Select directors to invite:' : '选择参会领导:'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {directors.map(d => (
                <button key={d.directorId} onClick={() => toggle(d.directorId)}
                  style={{
                    padding: '4px 6px', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer',
                    background: selected.has(d.directorId) ? '#141430' : '#0a0a14',
                    border: `1px solid ${selected.has(d.directorId) ? '#4a90d9' : '#1a1a28'}`,
                    borderRadius: 3, color: selected.has(d.directorId) ? '#8ab8e8' : '#777',
                    textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                  {d.emoji} {deptName(d.deptId)}
                  {selected.has(d.directorId) && ' ✓'}
                </button>
              ))}
            </div>
            <textarea value={topic} onChange={e => setTopic(e.target.value)}
              placeholder={lang === 'en' ? 'Meeting topic...' : '会议议题...'}
              style={{
                width: '100%', height: 50, padding: '6px 8px', fontSize: 10, fontFamily: 'inherit',
                background: '#12121f', border: '1px solid #222238', borderRadius: 4, color: '#c0c0d0', resize: 'none', outline: 'none',
              }} />
            <button onClick={() => createMeeting.mutate()}
              disabled={selected.size < 2 || !topic.trim() || createMeeting.isPending}
              style={{
                padding: '6px 0', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                background: selected.size >= 2 && topic.trim() ? '#4a90d9' : '#333', color: '#fff',
                border: 'none', borderRadius: 4, opacity: selected.size < 2 || !topic.trim() ? 0.5 : 1,
              }}>
              {createMeeting.isPending ? '...' : `${lang === 'en' ? 'Start Meeting' : '开始会议'} (${selected.size})`}
            </button>
          </div>
        )}

        {/* ACTIVE MEETING TAB */}
        {activeTab === 'active' && (
          activeMeeting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: '#d9a04a', fontWeight: 'bold' }}>{activeMeeting.title}</div>
              <div style={{ fontSize: 9, color: '#8888a0' }}>{activeMeeting.topic}</div>

              {/* Messages */}
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(activeMeeting.messages || []).map((msg: any, i: number) => (
                  <div key={i} style={{ background: '#12121f', border: '1px solid #1a1a28', borderRadius: 4, padding: '6px 8px' }}>
                    <div style={{ fontSize: 9, color: '#4a90d9', fontWeight: 'bold', marginBottom: 2 }}>
                      {msg.agentName} <span style={{ color: '#555568', fontWeight: 'normal' }}>{msg.agentId}</span>
                    </div>
                    <div style={{ fontSize: 9, color: '#a0a0b0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {msg.content?.substring(0, 300)}{msg.content?.length > 300 ? '...' : ''}
                    </div>
                  </div>
                ))}
                {(activeMeeting.messages || []).length === 0 && (
                  <div style={{ fontSize: 9, color: '#555568', textAlign: 'center', padding: 12 }}>
                    {activeMeeting.status === 'in_progress' ? (lang === 'en' ? 'Waiting for responses...' : '等待发言...') : (lang === 'en' ? 'Starting...' : '启动中...')}
                  </div>
                )}
              </div>

              {activeMeeting.status === 'in_progress' && (
                <div style={{ fontSize: 9, color: '#d0a030' }}>
                  ⏳ {(activeMeeting.messages || []).length}/{activeMeeting.participantIds?.length || 0} {lang === 'en' ? 'responded' : '已发言'}
                </div>
              )}

              {/* Follow-up */}
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={followup} onChange={e => setFollowup(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && followup.trim() && sendFollowup.mutate()}
                  placeholder={lang === 'en' ? 'Follow-up...' : '追问...'}
                  style={{
                    flex: 1, padding: '4px 8px', fontSize: 9, fontFamily: 'inherit',
                    background: '#12121f', border: '1px solid #222238', borderRadius: 4, color: '#c0c0d0', outline: 'none',
                  }} />
                <button onClick={() => sendFollowup.mutate()} disabled={!followup.trim()}
                  style={{
                    padding: '4px 8px', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer',
                    background: '#4a90d9', color: '#fff', border: 'none', borderRadius: 4,
                    opacity: followup.trim() ? 1 : 0.5,
                  }}>
                  {lang === 'en' ? 'Send' : '发送'}
                </button>
              </div>

              {activeMeeting.status === 'completed' && (
                <button onClick={() => dispatch.mutate()} disabled={dispatch.isPending}
                  style={{
                    padding: '6px 0', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                    background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4,
                  }}>
                  {dispatch.isPending ? '...' : (lang === 'en' ? '▶ Dispatch Tasks' : '▶ 派发任务')}
                </button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: '#555568', textAlign: 'center', padding: 20 }}>
              {lang === 'en' ? 'No active meeting. Create one in the "New" tab.' : '无进行中的会议。在"新建"标签页创建。'}
            </div>
          )
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          completedMeetings.length === 0 ? (
            <div style={{ fontSize: 10, color: '#555568', textAlign: 'center', padding: 20 }}>
              {lang === 'en' ? 'No meeting history yet.' : '暂无历史会议。'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {completedMeetings.map((m: any) => (
                <MeetingHistoryItem key={m.id} meeting={m} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function MeetingHistoryItem({ meeting }: { meeting: any }) {
  const { lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #1a1a28', borderRadius: 4 }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '6px 8px', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer',
          background: 'transparent', border: 'none', color: '#c0c0d0', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>{meeting.title}</span>
        <span style={{ color: '#3dbf5e', fontSize: 8 }}>✓</span>
      </button>
      {expanded && (
        <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 8, color: '#555568' }}>{meeting.topic}</div>
          <div style={{ fontSize: 8, color: '#555568' }}>{new Date(meeting.createdAt).toLocaleString()} · {meeting.participantIds?.length || 0} {lang === 'en' ? 'participants' : '人'}</div>
          {(meeting.messages || []).map((msg: any, i: number) => (
            <div key={i} style={{ background: '#12121f', borderRadius: 3, padding: '4px 6px' }}>
              <div style={{ fontSize: 8, color: '#4a90d9', fontWeight: 'bold' }}>{msg.agentName}</div>
              <div style={{ fontSize: 8, color: '#8888a0', whiteSpace: 'pre-wrap' }}>{msg.content?.substring(0, 200)}{msg.content?.length > 200 ? '...' : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== AGENT INTERACTION PANEL ==========
function AgentInteractionPanel({ agent, onClose }: { agent: PixelAgent; onClose: () => void }) {
  const { t, agentName, deptName, lang } = useI18n();
  const queryClient = useQueryClient();
  const [taskInput, setTaskInput] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const navigate = useNavigate();
  const statLabels = STAT_LABELS[lang];

  // Fetch agent details (with profile)
  const { data: agentDetail } = useQuery({
    queryKey: ['agent-detail-panel', agent.id],
    queryFn: () => api.getAgent(agent.id),
    enabled: !!agent.id,
  });

  // Fetch agent's tasks
  const { data: agentTasks = [] } = useQuery({
    queryKey: ['agent-tasks-panel', agent.id],
    queryFn: () => api.getTasks({ assigned_to: agent.id }),
    enabled: !!agent.id,
    refetchInterval: 5000,
  });

  const lastTask = agentTasks[0];

  const executeTask = useMutation({
    mutationFn: async () => {
      return api.createTask({
        title: `Task for ${agentName(agent.name)}`,
        input: taskInput,
        assignedTo: agent.id,
        departmentId: agentDetail?.departmentId,
        autoStart: true,
      });
    },
    onSuccess: () => {
      setTaskInput('');
      queryClient.invalidateQueries({ queryKey: ['agent-tasks-panel', agent.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <div style={{
      position: 'absolute', right: 270, bottom: 100, background: '#0e0e1a', border: '1px solid #222238',
      borderRadius: 8, padding: 0, width: 320, zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      maxHeight: 'calc(100vh - 200px)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #222238', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{agent.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: 12 }}>{agentName(agent.name)}</div>
          <div style={{ fontSize: 9, color: '#555568' }}>
            {agent.id} · {agentDetail?.departmentId ? deptName(agentDetail.departmentId) : ''}
            {agent.isLd && <span style={{ marginLeft: 4, color: '#d9a04a' }}>👑 {t('agents.director')}</span>}
          </div>
        </div>
        <span className={`po-dot ${agent.st === 'working' ? 'w' : agent.st === 'resting' ? '' : agent.st === 'idle' ? 'i' : 'r'}`}
          style={{ width: 8, height: 8, ...(agent.st === 'resting' ? {background:'#60a0e0',boxShadow:'0 0 4px #60a0e0'} : {}) }} />
        <span style={{ fontSize: 9, color: agent.st === 'working' ? '#3dbf5e' : agent.st === 'resting' ? '#60a0e0' : agent.st === 'idle' ? '#d0a030' : '#d04848' }}>
          {statLabels[agent.st as keyof typeof statLabels] || agent.st}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555568', cursor: 'pointer', fontSize: 14, marginLeft: 4 }}>✕</button>
      </div>

      {/* Body - scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Brief identity */}
        {agentDetail?.identity && (
          <p style={{ fontSize: 10, color: '#8888a0', marginBottom: 8, lineHeight: 1.5 }}>
            {agentDetail.identity.substring(0, 100)}{agentDetail.identity.length > 100 ? '...' : ''}
          </p>
        )}

        {/* Task input — always available */}
        <div style={{ marginBottom: 8 }}>
          <textarea
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            placeholder={lang === 'en' ? 'Enter task instructions...' : '输入任务指令...'}
            style={{
              width: '100%', height: 60, padding: '6px 8px', background: '#12121f', border: '1px solid #222238',
              borderRadius: 4, color: '#c0c0d0', fontSize: 10, fontFamily: 'inherit', resize: 'none',
              outline: 'none',
            }}
          />
          <button
            onClick={() => executeTask.mutate()}
            disabled={!taskInput.trim() || executeTask.isPending}
            style={{
              width: '100%', padding: '6px 0', marginTop: 4,
              background: executeTask.isPending ? '#333' : '#4a90d9', color: '#fff', border: 'none',
              borderRadius: 4, cursor: taskInput.trim() ? 'pointer' : 'not-allowed', fontSize: 10, fontFamily: 'inherit',
              opacity: !taskInput.trim() || executeTask.isPending ? 0.5 : 1,
            }}>
            {executeTask.isPending ? (lang === 'en' ? 'Executing...' : '执行中...') : (lang === 'en' ? '▶ Execute Now' : '▶ 立即执行')}
          </button>
        </div>

        {/* Last task result */}
        {lastTask && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: '#555568' }}>{lang === 'en' ? 'Recent task:' : '最近任务:'}</span>
              <span style={{
                fontSize: 8, padding: '1px 4px', borderRadius: 3,
                background: lastTask.status === 'completed' ? '#0a2a0a' : lastTask.status === 'running' ? '#2a2a0a' : '#2a0a0a',
                color: lastTask.status === 'completed' ? '#3dbf5e' : lastTask.status === 'running' ? '#d0a030' : '#d04848',
              }}>{t(`taskStatus.${lastTask.status}` as any)}</span>
            </div>
            <div style={{ fontSize: 9, color: '#8888a0', marginBottom: 2 }}>{lastTask.title}</div>
            {lastTask.output && (
              <>
                <button
                  onClick={() => setShowOutput(!showOutput)}
                  style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontSize: 9, padding: 0, fontFamily: 'inherit' }}>
                  {showOutput ? (lang === 'en' ? 'Hide ▲' : '收起结果 ▲') : (lang === 'en' ? 'View Result ▼' : '查看结果 ▼')}
                </button>
                {showOutput && (
                  <div style={{
                    marginTop: 4, padding: '6px 8px', background: '#080810', borderRadius: 4, border: '1px solid #1a1a28',
                    fontSize: 9, color: '#a0a0b0', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
                  }}>
                    {lastTask.output}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Link to full detail */}
        <button
          onClick={() => navigate(`/agents/${agent.id}`)}
          style={{ width: '100%', padding: '4px 0', background: 'transparent', color: '#4a90d9', border: '1px solid #222238',
            borderRadius: 4, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}>
          {lang === 'en' ? 'View Full Profile →' : '查看完整详情 →'}
        </button>
      </div>
    </div>
  );
}

// ========== REACT COMPONENT ==========
export default function PixelOffice() {
  const { t, agentName, deptName, lang } = useI18n();
  const statLabels = STAT_LABELS[lang];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(0);
  const [selAgent, setSelAgent] = useState<PixelAgent | null>(null);
  const frameRef = useRef(0);
  const pixelAgentsRef = useRef<PixelAgent[]>([]);
  const [, forceUpdate] = useState(0);

  // Activity feed
  const actsRef = useRef<Array<{ t: string; n: string; a: string }>>([]);

  // Real-time activity feed via WebSocket
  useWebSocket((event) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    if (event.type === 'task:update') {
      const task = (event as any).data.task;
      const statusMap: Record<string, Record<string, string>> = {
        en: { running: 'Started task', completed: '✅ Task completed', failed: '❌ Task failed', cancelled: 'Task cancelled' },
        zh: { running: '开始执行任务', completed: '✅ 任务完成', failed: '❌ 任务失败', cancelled: '任务已取消' },
      };
      const msg = statusMap[lang]?.[task.status];
      if (msg) {
        actsRef.current.unshift({ t: ts, n: `${task.assignedTo || ''}`, a: `${msg}: ${task.title}` });
        if (actsRef.current.length > 50) actsRef.current.pop();
      }
    } else if (event.type === 'agent:status') {
      const { agentId, status } = (event as any).data;
      const statusMsg: Record<string, Record<string, string>> = {
        en: { busy: 'Started working', idle: 'Now idle', offline: 'Went offline' },
        zh: { busy: '开始工作', idle: '进入空闲', offline: '已离线' },
      };
      if (statusMsg[lang]?.[status]) {
        actsRef.current.unshift({ t: ts, n: agentId, a: statusMsg[lang][status] });
        if (actsRef.current.length > 50) actsRef.current.pop();
      }
      // Immediately refetch agents so pixel office updates in real-time
      queryClient.invalidateQueries({ queryKey: ['agents-all'] });
    }
  });

  // Fetch data
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-all'],
    queryFn: () => api.getAgents(),
    refetchInterval: 5000,
  });

  // Build department index map
  const deptIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    departments.forEach((d: any, i: number) => { map[d.id] = i; });
    return map;
  }, [departments]);

  // Build layouts
  const layouts = useMemo(() => {
    if (departments.length === 0) return [];
    return departments.map((dept: any) => {
      const memberCount = agents.filter((a: any) => a.departmentId === dept.id && a.role !== 'director').length;
      return mkFloor(memberCount);
    });
  }, [departments, agents]);

  const meetLay = useMemo(() => mkMeeting(), []);

  // Map API status to pixel status
  // busy → working (green glow), idle → resting (blue tint), standby → idle (standing), offline → waiting (red)
  function mapStatus(agent: any): string {
    if (agent.status === 'busy') return 'working';
    if (agent.status === 'idle') return 'resting'; // completed a task, now resting
    if (agent.status === 'standby' || agent.status === 'online') return 'idle';
    return 'waiting'; // offline
  }

  // Sync agents to pixel agents
  useEffect(() => {
    if (departments.length === 0 || layouts.length === 0 || agents.length === 0) return;

    const existing = pixelAgentsRef.current;
    const existingMap: Record<string, PixelAgent> = {};
    existing.forEach(a => { existingMap[a.id] = a; });

    const newAgents: PixelAgent[] = [];
    let seedCounter = 42;

    departments.forEach((dept: any, di: number) => {
      const lay = layouts[di];
      if (!lay) return;

      const deptAgents = agents.filter((a: any) => a.departmentId === dept.id);
      const leader = deptAgents.find((a: any) => a.role === 'director');
      const members = deptAgents.filter((a: any) => a.role !== 'director');

      if (leader) {
        const prev = existingMap[leader.id];
        newAgents.push({
          id: leader.id, name: leader.name, emoji: leader.emoji || dept.emoji,
          dep: di, isLd: true, ap: prev?.ap || mkApp(seedCounter++),
          st: mapStatus(leader), x: lay.ld.x, y: lay.ld.y, fr: prev?.fr || (Math.random() * 100 | 0),
          departmentId: leader.departmentId, role: leader.role, status: leader.status,
        });
      }

      members.forEach((a: any, ai: number) => {
        const s = lay.seats[ai];
        if (!s) return;
        const prev = existingMap[a.id];
        newAgents.push({
          id: a.id, name: a.name, emoji: a.emoji || '🤖',
          dep: di, isLd: false, ap: prev?.ap || mkApp(seedCounter++),
          st: mapStatus(a), x: s.x, y: s.y, fr: prev?.fr || (Math.random() * 100 | 0),
          departmentId: a.departmentId, role: a.role, status: a.status,
        });
      });
    });

    // Meeting room (top floor): directors from each department
    const directors = agents.filter((a: any) => a.role === 'director');
    directors.forEach((d: any, i: number) => {
      const s = meetLay.seats[i];
      if (!s) return;
      const mtId = `mt-${d.id}`;
      const prev = existingMap[mtId];
      const di = deptIndexMap[d.departmentId] ?? 0;
      newAgents.push({
        id: mtId, name: d.name, emoji: d.emoji || '🏛️',
        dep: departments.length, isLd: false, ap: prev?.ap || mkApp(42 + di * 13),
        st: 'working', x: s.x, y: s.y, fr: prev?.fr || (Math.random() * 100 | 0),
        departmentId: d.departmentId, role: d.role, status: d.status,
      });
    });

    // CEO in meeting room
    const ceoId = 'ceo';
    const prevCeo = existingMap[ceoId];
    newAgents.push({
      id: ceoId, name: 'CEO', emoji: '👑',
      dep: departments.length, isLd: true, ap: prevCeo?.ap || mkApp(999),
      st: 'working', x: meetLay.ld.x, y: meetLay.ld.y, fr: prevCeo?.fr || 0,
      departmentId: 'meeting', role: 'director', status: 'busy',
    });

    pixelAgentsRef.current = newAgents;
  }, [departments, agents, layouts, meetLay, deptIndexMap]);

  // Canvas sizing — adapts to dynamic floor height
  const resizeCanvas = useCallback(() => {
    const cvs = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const isM = floor === departments.length;
    const lay = isM ? meetLay : layouts[floor];
    const fh = lay ? lay.g.length : MH;
    const cw = MW * T, ch = fh * T;
    const dpr = window.devicePixelRatio || 1;
    const ww = wrap.clientWidth, wh = wrap.clientHeight;
    const scaleX = ww / cw;
    const scaleY = wh / ch;
    const sc = Math.min(scaleX, scaleY);
    const displayW = Math.floor(cw * sc);
    const displayH = Math.floor(ch * sc);
    cvs.width = Math.floor(cw * sc * dpr);
    cvs.height = Math.floor(ch * sc * dpr);
    cvs.style.width = displayW + 'px';
    cvs.style.height = displayH + 'px';
    const ctx = cvs.getContext('2d');
    if (ctx) {
      ctx.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
  }, [floor, layouts, meetLay]);

  // Render loop
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const cx = cvs.getContext('2d');
    if (!cx) return;

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let raf: number;
    const loop = () => {
      frameRef.current++;
      const fr = frameRef.current;

      // Update animation frame counters
      pixelAgentsRef.current.forEach(a => { a.fr++; });

      const floorAgents = pixelAgentsRef.current.filter(a => a.dep === floor);
      renderScene(cx, floor, layouts, meetLay, floorAgents, selAgent, fr, DEPT_COLORS, departments.length);

      // Force re-render UI every ~25 frames
      if (fr % 25 === 0) forceUpdate(v => v + 1);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [floor, selAgent, layouts, meetLay, resizeCanvas]);

  // Canvas click handler
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const r = cvs.getBoundingClientRect();
    const isM = floor === departments.length;
    const lay = isM ? meetLay : layouts[floor];
    const fh = lay ? lay.g.length : MH;
    const cw = MW * T, ch = fh * T;
    const mx = (e.clientX - r.left) * cw / r.width, my = (e.clientY - r.top) * ch / r.height;
    const fa = pixelAgentsRef.current.filter(a => a.dep === floor);
    let best: PixelAgent | null = null, bd = 25;
    fa.forEach(a => { const d = Math.hypot(a.x - mx, a.y - my); if (d < bd) { bd = d; best = a; } });
    setSelAgent(best);
  }, [floor]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') setFloor(f => Math.max(0, f - 1));
      if (e.key === 'ArrowDown') setFloor(f => Math.min(departments.length, f + 1));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const go = (f: number) => { setFloor(f); setSelAgent(null); };

  // Current floor agents for right panel
  const floorAgents = pixelAgentsRef.current.filter(a => a.dep === floor);
  const cntW = floorAgents.filter(a => a.st === 'working').length;
  const cntRest = floorAgents.filter(a => a.st === 'resting').length;
  const cntI = floorAgents.filter(a => a.st === 'idle').length;
  const cntR = floorAgents.filter(a => a.st === 'waiting').length;

  const isM = floor === departments.length;
  const curDept = !isM && departments[floor] ? departments[floor] : null;

  return (
    <>
      <style>{CSS}</style>
      <div className="po-root" style={{ height: 'calc(100vh - 5rem)' }}>
        {/* Header */}
        <div className="po-header">
          <div>
            <h1>🏢 AI AGENT HQ</h1>
            <p>Terminal Agent Monitor v2.0</p>
          </div>
          {/* Mini building */}
          <div className="po-mini" style={{ marginLeft: 12 }}>
            {Array.from({ length: departments.length + 1 }, (_, i) => departments.length - i).map(i => {
              const isMeet = i === departments.length;
              const cl = isMeet ? '#d9a04a' : (i === floor ? '#4a90d9' : (DEPT_COLORS[i]?.cl || '#555'));
              const active = i === floor;
              const w = isMeet ? '40px' : '55px';
              return (
                <div
                  key={i}
                  onClick={() => go(i)}
                  title={`F${i + 1} ${isMeet ? 'Meeting Room' : deptName(departments[i]?.id || '')}`}
                  style={{ width: w, height: active ? 5 : 3, background: cl, borderRadius: 1, opacity: active ? 1 : 0.4, transition: 'all .2s', cursor: 'pointer' }}
                />
              );
            })}
            <div style={{ width: '60px', height: 2, background: '#555568', marginTop: 2 }} />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#555568' }}>
            {agents.filter((a: any) => a.status === 'busy').length} {lang === 'en' ? 'busy' : '工作中'} / {agents.length} {lang === 'en' ? 'total' : '总计'}
          </div>
        </div>

        {/* Body */}
        <div className="po-body">
          {/* Sidebar */}
          <div className="po-sidebar">
            <div className="po-sidebar-inner">
              {departments.map((dept: any, i: number) => {
                const count = agents.filter((a: any) => a.departmentId === dept.id).length;
                return (
                  <button key={dept.id} className={`po-fbtn${floor === i ? ' act' : ''}`} onClick={() => go(i)}>
                    <span className="fn">F{i + 1}</span>
                    <span className="fi">{dept.emoji}</span>
                    <span className="fm">{deptName(dept.id)}</span>
                    <span className="fc">{count}</span>
                  </button>
                );
              })}
              <button className={`po-fbtn meeting${floor === departments.length ? ' act' : ''}`} onClick={() => go(departments.length)}>
                <span className="fn">F{departments.length + 1}</span>
                <span className="fi">🏛️</span>
                <span className="fm">{lang === 'en' ? 'Executive Room' : '总裁会议室'}</span>
                <span className="fc">{agents.filter((a: any) => a.role === 'director').length + 1}</span>
              </button>
            </div>
          </div>

          {/* Center */}
          <div className="po-center">
            {/* Topbar */}
            <div className="po-topbar">
              <span className="fl">F{floor + 1}</span>
              <span className="sep">│</span>
              <span className="dn">{isM ? '🏛️ Executive Meeting Room' : curDept ? `${curDept.emoji} ${deptName(curDept.id)}` : ''}</span>
              <div className="stats">
                <span className="po-st"><span className="po-dot w" /><span>{cntW} {lang === 'en' ? 'Working' : '工作'}</span></span>
                {cntRest > 0 && <span className="po-st"><span className="po-dot" style={{background:'#60a0e0',boxShadow:'0 0 4px #60a0e0'}} /><span>{cntRest} {lang === 'en' ? 'Idle' : '空闲'}</span></span>}
                <span className="po-st"><span className="po-dot i" /><span>{cntI} {lang === 'en' ? 'Standby' : '待命'}</span></span>
                <span className="po-st"><span className="po-dot r" /><span>{cntR} {lang === 'en' ? 'Offline' : '离线'}</span></span>
              </div>
            </div>

            {/* Canvas */}
            <div className="po-cvs-wrap" ref={wrapRef}>
              <canvas ref={canvasRef} onClick={handleCanvasClick} />
            </div>

            {/* Activity feed */}
            <div className="po-actbar">
              <div className="ah"><div className="ld" />{lang === 'en' ? 'LIVE FEED' : '实时动态 LIVE'}</div>
              <div className="po-actfeed">
                {actsRef.current.slice(0, 12).map((a, i) => (
                  <div key={i} className="po-ai">
                    <span className="t">{a.t}</span>{' '}
                    <span className="n">{a.n}</span>{' '}
                    <span className="a">{a.a}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — Meeting Room or Team Members */}
          {isM ? (
            <MeetingRoomPanel departments={departments} />
          ) : (
            <div className="po-rpanel">
              <div className="rh">👥 {lang === 'en' ? 'Team Members' : '部门成员'}</div>
              <div className="po-alist">
                {floorAgents.map(a => (
                  <div key={a.id} className={`po-ac${selAgent?.id === a.id ? ' sel' : ''}`} onClick={() => setSelAgent(a)}>
                    <div className="at">
                      <span className="ai2">{a.emoji}</span>
                      <span className="an">
                        {agentName(a.name)}
                        {a.isLd && <span className="po-ltag">LEAD</span>}
                      </span>
                      <span className={`as po-as-${a.st}`}>{statLabels[a.st as keyof typeof statLabels] || a.st}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agent interaction panel */}
        {selAgent && selAgent.id !== 'ceo' && !selAgent.id.startsWith('mt-') && (
          <AgentInteractionPanel
            agent={selAgent}
            onClose={() => setSelAgent(null)}
          />
        )}
      </div>
    </>
  );
}
