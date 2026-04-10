import type { Character, OfficeConfig, DepartmentZone, DeskSlot, Tile, Vec2, CharacterState } from '../types.js';
import type { Agent, AgentStatus } from '@ai-company/shared';
import { findPath, tileKey } from './pathfinding.js';

const WALK_SPEED = 48; // pixels per second
const ANIM_SPEED = 4;  // frames per second
const BOB_AMOUNT = 1.5;
const IDLE_WANDER_INTERVAL = 5; // seconds between random wanders

export class OfficeState {
  characters: Character[] = [];
  private config: OfficeConfig;
  private blockedTiles = new Set<string>();
  private wanderTimers = new Map<string, number>();

  constructor(config: OfficeConfig) {
    this.config = config;
    // Build blocked tile set from desk positions
    for (const dept of config.departments) {
      for (const desk of dept.desks) {
        this.blockedTiles.add(tileKey(desk.tile));
      }
    }
  }

  /** Sync characters with server agent data */
  syncAgents(agents: Agent[]) {
    const existingMap = new Map(this.characters.map(c => [c.id, c]));
    const newCharacters: Character[] = [];

    for (const agent of agents) {
      const existing = existingMap.get(agent.id);
      if (existing) {
        // Update state from agent status
        existing.state = this.statusToState(agent.status, agent.isActive);
        newCharacters.push(existing);
      } else {
        // Create new character
        const dept = this.config.departments.find(d => d.id === agent.departmentId);
        const desk = this.assignDesk(agent.id, dept);
        const startPos = desk
          ? this.tileToPixel(desk.tile)
          : this.tileToPixel(dept ? { x: dept.origin.x + 2, y: dept.origin.y + 2 } : { x: 1, y: 1 });

        newCharacters.push({
          id: agent.id,
          name: agent.name,
          emoji: agent.emoji,
          color: agent.color,
          departmentId: agent.departmentId,
          role: agent.role,
          state: this.statusToState(agent.status, agent.isActive),
          pos: startPos,
          targetTile: null,
          path: [],
          assignedDesk: desk || null,
          facing: 'down',
          animFrame: 0,
          animTimer: 0,
          bobOffset: 0,
        });
      }
    }

    this.characters = newCharacters;
  }

  /** Update all characters each frame */
  update(dt: number) {
    for (const char of this.characters) {
      char.animTimer += dt;
      if (char.animTimer >= 1 / ANIM_SPEED) {
        char.animFrame++;
        char.animTimer = 0;
      }

      switch (char.state) {
        case 'typing':
          this.updateTyping(char, dt);
          break;
        case 'idle':
          this.updateIdle(char, dt);
          break;
        case 'walking':
          this.updateWalking(char, dt);
          break;
        case 'offline':
          // Slow bob
          char.bobOffset = Math.sin(performance.now() / 2000 + char.id.charCodeAt(0)) * 0.5;
          break;
      }
    }
  }

  private updateTyping(char: Character, dt: number) {
    void dt;
    // Bob while typing
    char.bobOffset = Math.sin(performance.now() / 300 + char.id.charCodeAt(0)) * BOB_AMOUNT;

    // If not at desk, walk to desk
    if (char.assignedDesk && char.path.length === 0) {
      const deskPos = this.tileToPixel(char.assignedDesk.tile);
      const dist = Math.hypot(char.pos.x - deskPos.x, char.pos.y - deskPos.y);
      if (dist > 4) {
        this.navigateTo(char, char.assignedDesk.tile);
        char.state = 'walking';
      } else {
        char.facing = char.assignedDesk.facing;
      }
    }
  }

  private updateIdle(char: Character, dt: number) {
    char.bobOffset = Math.sin(performance.now() / 1000 + char.id.charCodeAt(0)) * BOB_AMOUNT * 0.5;

    // Occasional wander
    const timer = (this.wanderTimers.get(char.id) || 0) + dt;
    this.wanderTimers.set(char.id, timer);

    if (timer > IDLE_WANDER_INTERVAL + Math.random() * 3) {
      this.wanderTimers.set(char.id, 0);
      const dept = this.config.departments.find(d => d.id === char.departmentId);
      if (dept) {
        const randTile: Tile = {
          x: dept.origin.x + 1 + Math.floor(Math.random() * (dept.width - 2)),
          y: dept.origin.y + 1 + Math.floor(Math.random() * (dept.height - 2)),
        };
        if (!this.blockedTiles.has(tileKey(randTile))) {
          this.navigateTo(char, randTile);
          char.state = 'walking';
        }
      }
    }
  }

  private updateWalking(char: Character, dt: number) {
    char.bobOffset = Math.sin(performance.now() / 200) * BOB_AMOUNT;

    if (char.path.length === 0) {
      // Arrived — revert to previous state based on agent
      char.state = char.assignedDesk ? 'typing' : 'idle';
      return;
    }

    const target = char.path[0];
    const targetPos = this.tileToPixel(target);
    const dx = targetPos.x - char.pos.x;
    const dy = targetPos.y - char.pos.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2) {
      char.pos = targetPos;
      char.path.shift();
      return;
    }

    const speed = WALK_SPEED * dt;
    char.pos.x += (dx / dist) * speed;
    char.pos.y += (dy / dist) * speed;

    // Update facing
    if (Math.abs(dx) > Math.abs(dy)) {
      char.facing = dx > 0 ? 'right' : 'left';
    } else {
      char.facing = dy > 0 ? 'down' : 'up';
    }
  }

  private navigateTo(char: Character, target: Tile) {
    const fromTile = this.pixelToTile(char.pos);
    char.path = findPath(fromTile, target, this.config, this.blockedTiles);
    char.targetTile = target;
  }

  private statusToState(status: AgentStatus, isActive: boolean): CharacterState {
    if (!isActive) return 'offline';
    switch (status) {
      case 'busy': return 'typing';
      case 'idle': return 'idle';
      case 'online': return 'idle';
      case 'offline': return 'offline';
      default: return 'offline';
    }
  }

  private assignDesk(agentId: string, dept?: DepartmentZone): DeskSlot | undefined {
    if (!dept) return undefined;
    const free = dept.desks.find(d => !d.occupantId);
    if (free) {
      free.occupantId = agentId;
      return free;
    }
    return undefined;
  }

  tileToPixel(tile: Tile): Vec2 {
    const ts = this.config.tileSize;
    return { x: tile.x * ts + ts / 2, y: tile.y * ts + ts / 2 };
  }

  pixelToTile(pos: Vec2): Tile {
    const ts = this.config.tileSize;
    return { x: Math.floor(pos.x / ts), y: Math.floor(pos.y / ts) };
  }

  /** Find character at pixel position (for click handling) */
  getCharacterAt(worldX: number, worldY: number): Character | null {
    const hitRadius = this.config.tileSize * 0.5;
    for (const char of this.characters) {
      const dist = Math.hypot(char.pos.x - worldX, char.pos.y - worldY);
      if (dist < hitRadius) return char;
    }
    return null;
  }
}
