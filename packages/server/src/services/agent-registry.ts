import type Database from 'better-sqlite3';
import { glob } from 'glob';
import matter from 'gray-matter';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import type { AgentDefinition } from '@ai-company/shared';
import { upsertDepartment } from '../db/queries/departments.js';
import { upsertAgent } from '../db/queries/agents.js';

// Inline department seed data (avoids import path issues with the generate-agents script)
const DEPARTMENT_SEED = [
  { id: 'engineering', name: '工程部', nameEn: 'Engineering', emoji: '⚙️', color: '#1565C0', sortOrder: 0 },
  { id: 'design', name: '设计部', nameEn: 'Design', emoji: '🎨', color: '#7B1FA2', sortOrder: 1 },
  { id: 'product', name: '产品部', nameEn: 'Product', emoji: '📦', color: '#00897B', sortOrder: 2 },
  { id: 'marketing', name: '市场营销部', nameEn: 'Marketing', emoji: '📢', color: '#E65100', sortOrder: 3 },
  { id: 'sales', name: '销售部', nameEn: 'Sales', emoji: '💰', color: '#2E7D32', sortOrder: 4 },
  { id: 'paid-media', name: '付费媒体部', nameEn: 'Paid Media', emoji: '📊', color: '#AD1457', sortOrder: 5 },
  { id: 'project-mgmt', name: '项目管理部', nameEn: 'Project Management', emoji: '📋', color: '#4527A0', sortOrder: 6 },
  { id: 'qa', name: '质量保障部', nameEn: 'QA & Testing', emoji: '🔍', color: '#C62828', sortOrder: 7 },
  { id: 'data-ai', name: '数据与AI部', nameEn: 'Data & AI', emoji: '🤖', color: '#0277BD', sortOrder: 8 },
  { id: 'infrastructure', name: '基础设施部', nameEn: 'Infrastructure & Ops', emoji: '🏗️', color: '#455A64', sortOrder: 9 },
  { id: 'game-dev', name: '游戏开发部', nameEn: 'Game Development', emoji: '🎮', color: '#6A1B9A', sortOrder: 10 },
  { id: 'finance', name: '财务部', nameEn: 'Finance', emoji: '💵', color: '#2E7D32', sortOrder: 11 },
  { id: 'legal', name: '法务合规部', nameEn: 'Legal & Compliance', emoji: '⚖️', color: '#5D4037', sortOrder: 12 },
  { id: 'customer-service', name: '客户服务部', nameEn: 'Customer Service', emoji: '🎧', color: '#00838F', sortOrder: 13 },
  { id: 'support', name: '综合支持部', nameEn: 'Support', emoji: '🤝', color: '#F57F17', sortOrder: 14 },
];

function extractSection(content: string, sectionName: string): string | undefined {
  // Try exact match first (our old format: "## Identity")
  const regex = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(regex);
  if (match) return match[1].trim();

  // Try fuzzy match for agency-agents format (e.g., "## 🧠 Your Identity & Memory")
  const fuzzy = new RegExp(`## [^\\n]*${sectionName}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const fuzzyMatch = content.match(fuzzy);
  if (fuzzyMatch) return fuzzyMatch[1].trim();

  return undefined;
}

// For agency-agents format: extract the full body as the identity when sections use emoji headers
function extractFullBody(content: string): string {
  // If content starts with "# Agent Name" style header, return everything
  const trimmed = content.trim();
  if (trimmed.length > 100) return trimmed;
  return '';
}

export class AgentRegistry {
  private definitions = new Map<string, AgentDefinition>();

  constructor(private db: Database.Database, private agentsDir: string) {}

  async loadAll(): Promise<{ departments: number; agents: number }> {
    // 1. Seed departments
    for (const dept of DEPARTMENT_SEED) {
      upsertDepartment(this.db, {
        id: dept.id,
        name: dept.name,
        nameEn: dept.nameEn,
        directorId: null,
        color: dept.color,
        emoji: dept.emoji,
        sortOrder: dept.sortOrder,
      });
    }

    // 2. Glob for markdown files
    const files = await glob('**/*.md', { cwd: this.agentsDir, absolute: true });

    // 3. Parse each file and upsert agents
    this.definitions.clear();
    for (const filePath of files) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data: fm, content } = matter(raw);

      const definition: AgentDefinition = {
        id: fm.id as string,
        name: fm.name_cn ? `${fm.name_cn} (${fm.name})` : fm.name as string,
        description: (fm.description as string) || undefined,
        vibe: (fm.vibe as string) || undefined,
        department: fm.department as string,
        role: fm.role as 'director' | 'member',
        emoji: fm.emoji as string,
        color: fm.color as string,
        runtimes: Array.isArray(fm.runtimes) ? (fm.runtimes as string[]) : [],
        maxConcurrentTasks: fm.max_concurrent_tasks as number,
        subordinates: Array.isArray(fm.subordinates) ? (fm.subordinates as string[]) : undefined,
        identity: extractSection(content, 'Identity') || extractSection(content, 'Identity & Memory') || extractFullBody(content),
        coreMission: extractSection(content, 'Core Mission') || extractSection(content, 'Mission') || '',
        workflow: extractSection(content, 'Workflow') || extractSection(content, 'Workflow Process'),
        successMetrics: extractSection(content, 'Success Metrics') || extractSection(content, 'Metrics'),
        leadershipCapabilities: extractSection(content, 'Leadership Capabilities') || extractSection(content, 'Leadership'),
        delegationRules: extractSection(content, 'Delegation Rules') || extractSection(content, 'Delegation'),
        criticalRules: extractSection(content, 'Critical Rules') || extractSection(content, 'Rules'),
        communicationStyle: extractSection(content, 'Communication Style') || extractSection(content, 'Communication'),
      };

      this.definitions.set(definition.id, definition);

      const relPath = path.relative(this.agentsDir, filePath);
      const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);

      upsertAgent(this.db, {
        id: definition.id,
        name: definition.name,
        departmentId: definition.department,
        role: definition.role,
        emoji: definition.emoji,
        color: definition.color,
        runtimes: definition.runtimes,
        maxConcurrentTasks: definition.maxConcurrentTasks,
        definitionPath: relPath,
        definitionHash: hash,
      });
    }

    // 4. Set director_id on departments
    for (const def of this.definitions.values()) {
      if (def.role === 'director') {
        upsertDepartment(this.db, {
          id: def.department,
          name: DEPARTMENT_SEED.find(d => d.id === def.department)?.name ?? def.department,
          nameEn: DEPARTMENT_SEED.find(d => d.id === def.department)?.nameEn ?? def.department,
          directorId: def.id,
          color: DEPARTMENT_SEED.find(d => d.id === def.department)?.color ?? '#000000',
          emoji: DEPARTMENT_SEED.find(d => d.id === def.department)?.emoji ?? '',
          sortOrder: DEPARTMENT_SEED.find(d => d.id === def.department)?.sortOrder ?? 0,
        });
      }
    }

    // Reset all agents to standby on startup
    this.db.prepare("UPDATE agents SET status = 'standby', is_active = 0").run();

    return { departments: DEPARTMENT_SEED.length, agents: this.definitions.size };
  }

  getDefinition(agentId: string): AgentDefinition | undefined {
    return this.definitions.get(agentId);
  }

  getAllDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  buildSystemPrompt(agentId: string): string {
    const def = this.definitions.get(agentId);
    if (!def) throw new Error(`Agent not found: ${agentId}`);

    const parts: string[] = [`# ${def.name}`, ''];

    if (def.identity) parts.push(`## Identity\n${def.identity}\n`);
    if (def.coreMission) parts.push(`## Core Mission\n${def.coreMission}\n`);
    if (def.leadershipCapabilities) parts.push(`## Leadership Capabilities\n${def.leadershipCapabilities}\n`);
    if (def.delegationRules) parts.push(`## Delegation Rules\n${def.delegationRules}\n`);
    if (def.workflow) parts.push(`## Workflow\n${def.workflow}\n`);
    if (def.successMetrics) parts.push(`## Success Metrics\n${def.successMetrics}\n`);
    if (def.criticalRules) parts.push(`## Critical Rules\n${def.criticalRules}\n`);
    if (def.communicationStyle) parts.push(`## Communication Style\n${def.communicationStyle}\n`);

    return parts.join('\n').trim();
  }
}
