import type { Tile, OfficeConfig } from '../types.js';

export function findPath(
  from: Tile,
  to: Tile,
  config: OfficeConfig,
  blockedTiles: Set<string>,
): Tile[] {
  const key = (t: Tile) => `${t.x},${t.y}`;

  if (key(from) === key(to)) return [];

  const queue: Tile[] = [from];
  const visited = new Set<string>([key(from)]);
  const parent = new Map<string, Tile>();

  const dirs = [
    { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const d of dirs) {
      const next: Tile = { x: current.x + d.x, y: current.y + d.y };
      const nk = key(next);

      if (next.x < 0 || next.y < 0 || next.x >= config.cols || next.y >= config.rows) continue;
      if (visited.has(nk)) continue;
      // Allow target tile even if blocked (it's our desk)
      if (blockedTiles.has(nk) && nk !== key(to)) continue;

      visited.add(nk);
      parent.set(nk, current);

      if (nk === key(to)) {
        // Reconstruct path
        const path: Tile[] = [];
        let cur = to;
        while (key(cur) !== key(from)) {
          path.unshift(cur);
          cur = parent.get(key(cur))!;
        }
        return path;
      }

      queue.push(next);
    }
  }

  return []; // No path found
}

export function tileKey(t: Tile): string {
  return `${t.x},${t.y}`;
}
