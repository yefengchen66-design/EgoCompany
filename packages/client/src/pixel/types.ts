export interface Vec2 {
  x: number;
  y: number;
}

export interface Tile {
  x: number;  // grid col
  y: number;  // grid row
}

export interface DeskSlot {
  tile: Tile;
  facing: Direction;
  occupantId: string | null;
}

export interface DepartmentZone {
  id: string;
  name: string;
  emoji: string;
  color: string;
  origin: Tile;    // top-left of zone
  width: number;   // in tiles
  height: number;  // in tiles
  desks: DeskSlot[];
}

export type Direction = 'down' | 'left' | 'right' | 'up';

export type CharacterState = 'typing' | 'idle' | 'walking' | 'offline';

export interface Character {
  id: string;
  name: string;
  emoji: string;
  color: string;
  departmentId: string;
  role: 'director' | 'member';
  state: CharacterState;
  pos: Vec2;         // pixel position (center)
  targetTile: Tile | null;
  path: Tile[];
  assignedDesk: DeskSlot | null;
  facing: Direction;
  animFrame: number;
  animTimer: number;
  bobOffset: number;
}

export interface OfficeConfig {
  tileSize: number;
  cols: number;
  rows: number;
  departments: DepartmentZone[];
}
