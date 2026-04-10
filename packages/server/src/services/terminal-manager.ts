/**
 * Terminal Manager — spawns and manages agent CLI processes.
 * Adapted from Multica's daemon.go handleTask + executeAndDrain pattern:
 * - Session persistence (session_id + work_dir for --resume)
 * - Task message streaming (structured execution log)
 * - Token usage tracking
 * - Department message board integration
 * - Auto skill creation
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import type Database from 'better-sqlite3';
import type { AgentDefinition } from '@ai-company/shared';
import { nanoid } from 'nanoid';
import { eventBus } from './event-bus.js';
import { updateTaskStatus, getTaskById } from '../db/queries/tasks.js';
import { updateAgentStatus } from '../db/queries/agents.js';
import { addMemory } from '../db/queries/memories.js';
import { insertDeptMessage } from '../db/queries/dept-messages.js';
// Skills are now curated entities, not auto-created from task output
import { addTaskMessage } from '../db/queries/task-messages.js';
import { upsertTaskUsage } from '../db/queries/task-usage.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

interface ActiveSession {
  id: string;
  taskId: string;
  agentId: string;
  runtime: string;
  process: ChildProcess;
  output: string;
  tempFiles: string[];
}

export class TerminalManager {
  private sessions = new Map<string, ActiveSession>();

  constructor(private db: Database.Database, private logsDir: string) {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Look up prior session for same (agent, issue/parent) pair.
   * Adapted from Multica's GetLastTaskSession — enables --resume for session continuity.
   */
  private getPriorSession(agentId: string, parentTaskId?: string): { sessionId: string; workDir: string } | null {
    if (!parentTaskId) return null;
    try {
      const row = this.db.prepare(
        `SELECT session_id, working_dir FROM tasks
         WHERE assigned_to = ? AND parent_task_id = ? AND status = 'completed' AND session_id IS NOT NULL
         ORDER BY completed_at DESC LIMIT 1`
      ).get(agentId, parentTaskId) as { session_id: string; working_dir: string } | undefined;
      if (row?.session_id) return { sessionId: row.session_id, workDir: row.working_dir };
    } catch { /* ignore */ }
    return null;
  }

  /** Save session_id and work_dir back to task (like Multica's CompleteTask) */
  private saveSessionInfo(taskId: string, sessionId: string, workDir: string): void {
    try {
      this.db.prepare('UPDATE tasks SET session_id = ?, working_dir = ? WHERE id = ?').run(sessionId, workDir, taskId);
    } catch { /* ignore */ }
  }

  /**
   * Resolve full path to a CLI command.
   * Cached per command name for performance.
   */
  private cmdPathCache = new Map<string, string>();
  private resolveCmdPath(cmd: string): string {
    if (this.cmdPathCache.has(cmd)) return this.cmdPathCache.get(cmd)!;
    let fullPath = cmd;
    try {
      const result = execSync(`/bin/zsh -l -c "which ${cmd}"`, { encoding: 'utf-8' }).trim();
      if (result) fullPath = result;
    } catch { /* fallback */ }
    this.cmdPathCache.set(cmd, fullPath);
    return fullPath;
  }

  /**
   * Start a task — spawn agent CLI process.
   * Adapted from Multica daemon.go:runTask + handleTask.
   */
  startTask(params: {
    taskId: string; agentId: string; agentDef: AgentDefinition;
    runtime: string; input: string; workingDir?: string; systemPrompt: string;
    resumeSessionId?: string;
  }): string {
    const sessionId = nanoid(12);
    const cwd = params.workingDir || process.cwd();
    const logPath = path.join(this.logsDir, `${sessionId}.log`);
    const tempFiles: string[] = [];

    // Record task start as a structured message (like Multica's task_message)
    addTaskMessage(this.db, params.taskId, 'progress', { content: `启动 ${params.runtime}` });

    // Build command args — adapted from Multica daemon.go:runTask
    const cmd = 'claude';
    const fullCmdPath = this.resolveCmdPath(cmd);

    let args: string[];
    switch (params.runtime) {
      case 'claude-code':
        // Adapted from Multica's buildClaudeArgs (pkg/agent/claude.go:345-367)
        args = ['-p', '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--system-prompt', params.systemPrompt];
        // Session resume — key Multica pattern from daemon.go:1049-1059
        if (params.resumeSessionId) {
          args.push('--resume', params.resumeSessionId);
        }
        args.push(params.input);
        break;
      default:
        throw new Error(`Unknown runtime: ${params.runtime}`);
    }

    // Spawn directly — like Multica's agent.New + backend.Run
    const proc = spawn(fullCmdPath, args, {
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stdin?.end();

    const session: ActiveSession = {
      id: sessionId, taskId: params.taskId, agentId: params.agentId,
      runtime: params.runtime, process: proc, output: '', tempFiles,
    };
    this.sessions.set(sessionId, session);

    this.db.prepare(
      "INSERT INTO terminal_sessions (id, task_id, agent_id, runtime, pid, status, log_path) VALUES (?, ?, ?, ?, ?, 'active', ?)"
    ).run(sessionId, params.taskId, params.agentId, params.runtime, proc.pid, logPath);

    updateTaskStatus(this.db, params.taskId, 'running');
    updateAgentStatus(this.db, params.agentId, 'busy');
    eventBus.emitServerEvent({ type: 'agent:status', data: { agentId: params.agentId, status: 'busy' } });

    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    let msgSeqCounter = 0;

    // Accumulate stdout for JSON parsing (claude -p outputs one big JSON at end)
    let jsonBuffer = '';

    const handleData = (data: Buffer) => {
      const text = data.toString();
      session.output += text;
      jsonBuffer += text;
      logStream.write(text);
      eventBus.emitServerEvent({ type: 'terminal:output', data: { sessionId, chunk: text } });
      eventBus.emitServerEvent({ type: 'task:output', data: { taskId: params.taskId, chunk: text } });

      // Try to parse accumulated JSON (claude --output-format json outputs a single JSON object)
      try {
        const parsed = JSON.parse(jsonBuffer);
        jsonBuffer = ''; // Successfully parsed, clear buffer

        // Extract session_id for resume — key Multica pattern (daemon.go:916)
        if (parsed.session_id) {
          this.saveSessionInfo(params.taskId, parsed.session_id, cwd);
        }

        // Extract token usage — adapted from Multica's ReportTaskUsage (daemon.go:903)
        if (parsed.modelUsage) {
          for (const [model, u] of Object.entries(parsed.modelUsage as Record<string, any>)) {
            upsertTaskUsage(this.db, params.taskId, {
              provider: params.runtime,
              model,
              inputTokens: u.inputTokens || 0,
              outputTokens: u.outputTokens || 0,
              cacheReadTokens: u.cacheReadInputTokens || 0,
              cacheWriteTokens: u.cacheCreationInputTokens || 0,
            });
          }
        } else if (parsed.usage) {
          upsertTaskUsage(this.db, params.taskId, {
            provider: params.runtime,
            model: 'unknown',
            inputTokens: parsed.usage.input_tokens || 0,
            outputTokens: parsed.usage.output_tokens || 0,
            cacheReadTokens: parsed.usage.cache_read_input_tokens || 0,
            cacheWriteTokens: parsed.usage.cache_creation_input_tokens || 0,
          });
        }

        // Record result as structured message
        if (parsed.result) {
          addTaskMessage(this.db, params.taskId, 'tool_result', {
            content: (typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result)).substring(0, 1000),
          });
        }

        // Log cost if available
        if (parsed.total_cost_usd) {
          addTaskMessage(this.db, params.taskId, 'progress', {
            content: `Cost: $${parsed.total_cost_usd.toFixed(4)}, Model: ${Object.keys(parsed.modelUsage || {}).join(', ')}`,
          });
        }
      } catch {
        // Not valid JSON yet — still accumulating or raw text output
      }
    };

    proc.stdout?.on('data', handleData);
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      session.output += text;
      logStream.write(text);
      // Record errors as structured messages
      addTaskMessage(this.db, params.taskId, 'error', { content: text.substring(0, 500) });
    });

    proc.on('close', (exitCode) => {
      logStream.end();
      this.cleanupTempFiles(tempFiles);

      const status = (exitCode ?? 1) === 0 ? 'completed' : 'failed';

      // Record completion message
      addTaskMessage(this.db, params.taskId, 'progress', {
        content: `${status === 'completed' ? '完成' : '失败'} (exit ${exitCode})`,
      });

      updateTaskStatus(this.db, params.taskId, status, session.output);

      if (status === 'completed' && session.output.trim()) {
        addMemory(this.db, params.agentId,
          `完成任务: ${params.input.substring(0, 100)}\n结果: ${session.output.substring(0, 500)}`,
          ['task-result', params.runtime], 'task-result'
        );
      }

      // Post to department board + auto-create skill
      try {
        const task = getTaskById(this.db, params.taskId);
        if (task?.departmentId) {
          insertDeptMessage(this.db, task.departmentId, params.agentId, params.taskId,
            'result', `[${status}] ${params.input.substring(0, 100)}: ${session.output.substring(0, 300)}`);
          eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId: task.departmentId } });
        }
        // Skills are curated via the Skills page, not auto-created
      } catch { /* non-critical */ }

      updateAgentStatus(this.db, params.agentId, 'idle');
      this.db.prepare("UPDATE terminal_sessions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(sessionId);
      eventBus.emitServerEvent({ type: 'agent:status', data: { agentId: params.agentId, status: 'idle' } });
      this.sessions.delete(sessionId);
    });

    proc.on('error', (err) => {
      logStream.end();
      this.cleanupTempFiles(tempFiles);
      addTaskMessage(this.db, params.taskId, 'error', { content: `Process error: ${err.message}` });
      updateTaskStatus(this.db, params.taskId, 'failed', `Process error: ${err.message}`);
      updateAgentStatus(this.db, params.agentId, 'idle');
      this.db.prepare("UPDATE terminal_sessions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(sessionId);
      eventBus.emitServerEvent({ type: 'agent:status', data: { agentId: params.agentId, status: 'idle' } });
      this.sessions.delete(sessionId);
    });

    return sessionId;
  }

  sendInput(sessionId: string, input: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process.stdin) return false;
    session.process.stdin.write(input);
    return true;
  }

  killSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.process.kill('SIGTERM');
    return true;
  }

  getSession(sessionId: string) {
    const s = this.sessions.get(sessionId);
    return s ? { id: s.id, taskId: s.taskId, agentId: s.agentId, runtime: s.runtime } : undefined;
  }

  getActiveSessions() {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id, taskId: s.taskId, agentId: s.agentId, runtime: s.runtime,
    }));
  }

  killAll(): void {
    for (const session of this.sessions.values()) {
      session.process.kill('SIGTERM');
      this.cleanupTempFiles(session.tempFiles);
    }
    this.sessions.clear();
  }

  private cleanupTempFiles(files: string[]): void {
    for (const f of files) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}
