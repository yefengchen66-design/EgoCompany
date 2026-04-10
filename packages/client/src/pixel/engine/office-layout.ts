import type { DepartmentZone, DeskSlot, Tile } from '../types.js';

const ZONE_W = 13;
const ZONE_H = 9;
const GAP = 1;

function makeDesks(origin: Tile, count: number, isDirector: boolean): DeskSlot[] {
  const desks: DeskSlot[] = [];
  // Director desk at top-center
  if (isDirector) {
    desks.push({ tile: { x: origin.x + Math.floor(ZONE_W / 2), y: origin.y + 1 }, facing: 'down', occupantId: null });
  }
  // Member desks in 2-column rows starting from row 3
  const startRow = 3;
  const cols = 2;
  const spacing = 3;
  let placed = 0;
  for (let row = 0; placed < count; row++) {
    for (let col = 0; col < cols && placed < count; col++) {
      desks.push({
        tile: {
          x: origin.x + 2 + col * (spacing + 2),
          y: origin.y + startRow + row * 2,
        },
        facing: col === 0 ? 'right' : 'left',
        occupantId: null,
      });
      placed++;
    }
  }
  return desks;
}

const DEPT_META: { id: string; name: string; emoji: string; color: string; memberCount: number }[] = [
  { id: 'engineering', name: '工程部', emoji: '⚙️', color: '#1565C0', memberCount: 15 },
  { id: 'design', name: '设计部', emoji: '🎨', color: '#7B1FA2', memberCount: 8 },
  { id: 'product', name: '产品部', emoji: '📦', color: '#00897B', memberCount: 8 },
  { id: 'marketing', name: '营销部', emoji: '📢', color: '#E65100', memberCount: 14 },
  { id: 'sales', name: '销售部', emoji: '💰', color: '#2E7D32', memberCount: 8 },
  { id: 'paid-media', name: '付费媒体', emoji: '📊', color: '#AD1457', memberCount: 7 },
  { id: 'project-mgmt', name: '项目管理', emoji: '📋', color: '#4527A0', memberCount: 8 },
  { id: 'qa', name: 'QA', emoji: '🔍', color: '#C62828', memberCount: 8 },
  { id: 'data-ai', name: '数据AI', emoji: '🤖', color: '#0277BD', memberCount: 10 },
  { id: 'infrastructure', name: '基础设施', emoji: '🏗️', color: '#455A64', memberCount: 8 },
  { id: 'game-dev', name: '游戏开发', emoji: '🎮', color: '#6A1B9A', memberCount: 12 },
  { id: 'support', name: '综合支持', emoji: '🤝', color: '#F57F17', memberCount: 12 },
];

export function createOfficeLayout(): { departments: DepartmentZone[]; cols: number; rows: number } {
  const gridCols = 4;
  const gridRows = 3;
  const departments: DepartmentZone[] = [];

  for (let i = 0; i < DEPT_META.length; i++) {
    const meta = DEPT_META[i];
    const gridX = i % gridCols;
    const gridY = Math.floor(i / gridCols);
    const origin: Tile = {
      x: gridX * (ZONE_W + GAP),
      y: gridY * (ZONE_H + GAP),
    };

    departments.push({
      id: meta.id,
      name: meta.name,
      emoji: meta.emoji,
      color: meta.color,
      origin,
      width: ZONE_W,
      height: ZONE_H,
      desks: makeDesks(origin, meta.memberCount, true),
    });
  }

  const totalCols = gridCols * (ZONE_W + GAP) - GAP;
  const totalRows = gridRows * (ZONE_H + GAP) - GAP;

  return { departments, cols: totalCols, rows: totalRows };
}
