import type Database from 'better-sqlite3';

export function initializeSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      name_en     TEXT NOT NULL,
      director_id TEXT,
      color       TEXT,
      emoji       TEXT,
      sort_order  INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agents (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL,
      department_id        TEXT NOT NULL REFERENCES departments(id),
      role                 TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('director','member')),
      emoji                TEXT,
      color                TEXT,
      status               TEXT NOT NULL DEFAULT 'standby' CHECK(status IN ('standby','busy','idle','offline')),
      runtimes             TEXT NOT NULL DEFAULT '[]',
      max_concurrent_tasks INTEGER NOT NULL DEFAULT 1,
      definition_path      TEXT,
      definition_hash      TEXT,
      is_active            INTEGER NOT NULL DEFAULT 0,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT,
      department_id   TEXT REFERENCES departments(id),
      assigned_to     TEXT REFERENCES agents(id),
      assigned_by     TEXT,
      parent_task_id  TEXT REFERENCES tasks(id),
      pipeline_id     TEXT,
      stage_name      TEXT,
      runtime         TEXT,
      status          TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','assigned','running','reviewing','completed','failed','cancelled')),
      priority        INTEGER NOT NULL DEFAULT 0,
      input           TEXT NOT NULL,
      output          TEXT,
      working_dir     TEXT,
      session_id      TEXT,
      trigger_comment TEXT,
      started_at      DATETIME,
      completed_at    DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id          TEXT PRIMARY KEY,
      task_id     TEXT NOT NULL REFERENCES tasks(id),
      agent_id    TEXT NOT NULL REFERENCES agents(id),
      runtime     TEXT NOT NULL,
      pid         INTEGER,
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
      log_path    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at   DATETIME
    );

    CREATE TABLE IF NOT EXISTS runtimes (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      command      TEXT NOT NULL,
      version      TEXT,
      path         TEXT,
      is_available INTEGER NOT NULL DEFAULT 0,
      detected_at  DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_agents_department ON agents(department_id);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_terminal_task ON terminal_sessions(task_id);

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id              TEXT PRIMARY KEY,
      pipeline_id     TEXT NOT NULL,
      pipeline_name   TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','cancelled')),
      stages          TEXT NOT NULL DEFAULT '[]',
      context         TEXT NOT NULL DEFAULT '{}',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at    DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);

    CREATE TABLE IF NOT EXISTS meetings (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      topic           TEXT NOT NULL,
      participant_ids TEXT NOT NULL DEFAULT '[]',
      status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','failed')),
      messages        TEXT NOT NULL DEFAULT '[]',
      summary         TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at    DATETIME
    );

    CREATE TABLE IF NOT EXISTS agent_configs (
      agent_id         TEXT PRIMARY KEY REFERENCES agents(id),
      preferred_runtime TEXT,
      custom_identity  TEXT,
      custom_mission   TEXT,
      custom_workflow  TEXT,
      custom_metrics   TEXT,
      notes            TEXT,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_memories (
      id          TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL,
      content     TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '[]',
      type        TEXT NOT NULL DEFAULT 'note',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_memories_agent ON agent_memories(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memories_type ON agent_memories(type);

    -- Task execution messages (adapted from Multica task_message)
    -- Records each tool call / output during agent execution
    CREATE TABLE IF NOT EXISTS task_messages (
      id          TEXT PRIMARY KEY,
      task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      seq         INTEGER NOT NULL,
      type        TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text','tool_call','tool_result','progress','error')),
      tool        TEXT,
      content     TEXT,
      input       TEXT,
      output      TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_task_msg_task_seq ON task_messages(task_id, seq);

    -- Token usage tracking per task (adapted from Multica task_usage)
    CREATE TABLE IF NOT EXISTS task_usage (
      id                  TEXT PRIMARY KEY,
      task_id             TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      provider            TEXT NOT NULL DEFAULT '',
      model               TEXT NOT NULL DEFAULT '',
      input_tokens        INTEGER NOT NULL DEFAULT 0,
      output_tokens       INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens   INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens  INTEGER NOT NULL DEFAULT 0,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_id, provider, model)
    );
    CREATE INDEX IF NOT EXISTS idx_task_usage_task ON task_usage(task_id);

    -- Prevent duplicate pending tasks per agent+parent (adapted from Multica migration 037)
    -- In Multica this is per (issue_id, agent_id); we use (assigned_to, parent_task_id)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_task_per_agent_parent
      ON tasks(assigned_to, parent_task_id) WHERE status IN ('queued', 'running');

    -- Agent communication: department message board
    CREATE TABLE IF NOT EXISTS dept_messages (
      id            TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id),
      author_id     TEXT NOT NULL REFERENCES agents(id),
      task_id       TEXT REFERENCES tasks(id),
      type          TEXT NOT NULL DEFAULT 'message' CHECK(type IN ('message','result','request','mention','directive')),
      content       TEXT NOT NULL,
      mentions      TEXT NOT NULL DEFAULT '[]',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dept_msg_dept ON dept_messages(department_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_dept_msg_task ON dept_messages(task_id);

    -- Director feedback loop: task review records
    CREATE TABLE IF NOT EXISTS task_reviews (
      id              TEXT PRIMARY KEY,
      parent_task_id  TEXT NOT NULL REFERENCES tasks(id),
      reviewer_id     TEXT NOT NULL REFERENCES agents(id),
      round           INTEGER NOT NULL DEFAULT 1,
      verdict         TEXT NOT NULL CHECK(verdict IN ('approved','revision_needed','follow_up')),
      summary         TEXT,
      revisions       TEXT NOT NULL DEFAULT '[]',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_review_parent ON task_reviews(parent_task_id);

    -- Task dependencies for sequential execution
    CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id       TEXT NOT NULL REFERENCES tasks(id),
      depends_on_id TEXT NOT NULL REFERENCES tasks(id),
      PRIMARY KEY (task_id, depends_on_id)
    );

    -- Cross-department requests
    CREATE TABLE IF NOT EXISTS cross_dept_requests (
      id                TEXT PRIMARY KEY,
      from_dept_id      TEXT NOT NULL REFERENCES departments(id),
      to_dept_id        TEXT NOT NULL REFERENCES departments(id),
      from_agent_id     TEXT NOT NULL REFERENCES agents(id),
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      context           TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','completed','rejected')),
      source_task_id    TEXT REFERENCES tasks(id),
      result_task_id    TEXT REFERENCES tasks(id),
      result_summary    TEXT,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cross_dept_from ON cross_dept_requests(from_dept_id);
    CREATE INDEX IF NOT EXISTS idx_cross_dept_to ON cross_dept_requests(to_dept_id);
    CREATE INDEX IF NOT EXISTS idx_cross_dept_status ON cross_dept_requests(status);

    -- Shared department context (persistent knowledge per department)
    CREATE TABLE IF NOT EXISTS dept_context (
      id            TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id),
      key           TEXT NOT NULL,
      value         TEXT NOT NULL,
      updated_by    TEXT REFERENCES agents(id),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(department_id, key)
    );
    CREATE INDEX IF NOT EXISTS idx_dept_ctx_dept ON dept_context(department_id);

    -- Structured skills (adapted from Multica: curated reusable capabilities)
    CREATE TABLE IF NOT EXISTS skills (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      description   TEXT NOT NULL DEFAULT '',
      content       TEXT NOT NULL DEFAULT '',
      category      TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('workflow','template','tool','knowledge','general')),
      config        TEXT NOT NULL DEFAULT '{}',
      created_by    TEXT,
      source        TEXT,
      tags          TEXT NOT NULL DEFAULT '[]',
      use_count     INTEGER NOT NULL DEFAULT 0,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Skill-agent assignment (M2M, like Multica agent_skill)
    CREATE TABLE IF NOT EXISTS agent_skills (
      agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      skill_id      TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (agent_id, skill_id)
    );
    CREATE INDEX IF NOT EXISTS idx_agent_skills_skill ON agent_skills(skill_id);
    CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);
  `);

  // FTS5 virtual tables
  try { db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, tags, agent_id, memory_id UNINDEXED, tokenize='unicode61')`); } catch {}
  try { db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(title, description, template, tags, skill_id UNINDEXED, tokenize='unicode61')`); } catch {}
}

// END OF FILE — everything below was removed (agent-generated user/subscription/payment tables)
