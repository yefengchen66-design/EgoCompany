import fs from 'node:fs';
import { glob } from 'glob';
import yaml from 'gray-matter';
import type { PipelineDefinition, PipelineStage } from '@ai-company/shared';

export class PipelineLoader {
  private definitions = new Map<string, PipelineDefinition>();

  constructor(private pipelinesDir: string) {}

  async loadAll(): Promise<number> {
    this.definitions.clear();
    const dir = this.pipelinesDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return 0;
    }

    const files = await glob('*.{yaml,yml}', { cwd: dir, absolute: true });
    for (const filePath of files) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      // gray-matter can parse YAML frontmatter, but these are pure YAML files
      // Use a simple YAML parse approach
      const parsed = parseYaml(raw);
      if (parsed && parsed.id) {
        this.definitions.set(parsed.id, parsed);
      }
    }
    return this.definitions.size;
  }

  getDefinition(id: string): PipelineDefinition | undefined {
    return this.definitions.get(id);
  }

  getAllDefinitions(): PipelineDefinition[] {
    return Array.from(this.definitions.values());
  }
}

function parseYaml(raw: string): PipelineDefinition | null {
  try {
    // Simple YAML parsing using gray-matter's data extraction
    // Wrap content in frontmatter delimiters for gray-matter
    const wrapped = `---\n${raw}\n---\n`;
    const { data } = yaml(wrapped);

    if (!data.id || !data.stages) return null;

    const stages: PipelineStage[] = (data.stages as any[]).map((s: any) => ({
      name: s.name,
      displayName: s.display_name || s.name,
      parallel: s.parallel ?? false,
      dependsOn: s.depends_on || [],
      contextFrom: s.context_from || [],
      tasks: (s.tasks || []).map((t: any) => ({
        department: t.department,
        instruction: t.instruction,
        assignTo: t.assign_to,
      })),
    }));

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      stages,
    };
  } catch {
    return null;
  }
}
