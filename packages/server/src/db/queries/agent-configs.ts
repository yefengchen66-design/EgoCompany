import type Database from 'better-sqlite3';

export interface AgentConfig {
  agentId: string;
  preferredRuntime: string | null;
  customIdentity: string | null;
  customMission: string | null;
  customWorkflow: string | null;
  customMetrics: string | null;
  notes: string | null;
  updatedAt: string;
}

export function getAgentConfig(db: Database.Database, agentId: string): AgentConfig | null {
  const row = db.prepare('SELECT agent_id, preferred_runtime, custom_identity, custom_mission, custom_workflow, custom_metrics, notes, updated_at FROM agent_configs WHERE agent_id = ?').get(agentId) as any;
  if (!row) return null;
  return {
    agentId: row.agent_id,
    preferredRuntime: row.preferred_runtime,
    customIdentity: row.custom_identity,
    customMission: row.custom_mission,
    customWorkflow: row.custom_workflow,
    customMetrics: row.custom_metrics,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

export function saveAgentConfig(db: Database.Database, config: {
  agentId: string;
  preferredRuntime?: string | null;
  customIdentity?: string | null;
  customMission?: string | null;
  customWorkflow?: string | null;
  customMetrics?: string | null;
  notes?: string | null;
}): void {
  db.prepare(`
    INSERT INTO agent_configs (agent_id, preferred_runtime, custom_identity, custom_mission, custom_workflow, custom_metrics, notes, updated_at)
    VALUES (@agentId, @preferredRuntime, @customIdentity, @customMission, @customWorkflow, @customMetrics, @notes, CURRENT_TIMESTAMP)
    ON CONFLICT(agent_id) DO UPDATE SET
      preferred_runtime = @preferredRuntime,
      custom_identity = @customIdentity,
      custom_mission = @customMission,
      custom_workflow = @customWorkflow,
      custom_metrics = @customMetrics,
      notes = @notes,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    agentId: config.agentId,
    preferredRuntime: config.preferredRuntime ?? null,
    customIdentity: config.customIdentity ?? null,
    customMission: config.customMission ?? null,
    customWorkflow: config.customWorkflow ?? null,
    customMetrics: config.customMetrics ?? null,
    notes: config.notes ?? null,
  });
}
