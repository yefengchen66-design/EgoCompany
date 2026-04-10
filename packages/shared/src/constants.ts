export const DEPARTMENT_IDS = [
  'engineering', 'design', 'product', 'marketing', 'sales',
  'paid-media', 'project-mgmt', 'qa', 'data-ai',
  'infrastructure', 'game-dev', 'finance', 'legal',
  'customer-service', 'support',
] as const;

export type DepartmentId = typeof DEPARTMENT_IDS[number];

export const KNOWN_RUNTIMES = [
  { id: 'claude-code', name: 'Claude Code', command: 'claude' },
] as const;

export const DEFAULT_SERVER_PORT = 3141;
export const DEFAULT_WS_PATH = '/ws';
