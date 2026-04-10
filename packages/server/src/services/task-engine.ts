import type Database from 'better-sqlite3';
import type { CreateTaskInput, Task } from '@ai-company/shared';
import { createTask, getTaskById, getAllTasks, updateTaskStatus } from '../db/queries/tasks.js';
import { getAgentById, setAgentActive, getAllAgents } from '../db/queries/agents.js';
import { getAllRuntimes } from '../db/queries/runtimes.js';
import { getMemories } from '../db/queries/memories.js';
import { insertDeptMessage, getRecentDeptMessages } from '../db/queries/dept-messages.js';
import { insertTaskReview } from '../db/queries/task-reviews.js';
import { getAllDeptContext } from '../db/queries/dept-context.js';
import { getAgentSkills, searchSkills, incrementSkillUse } from '../db/queries/skills.js';
import { searchDeptMemories } from '../db/queries/memories.js';
import type { AgentRegistry } from './agent-registry.js';
import type { TerminalManager } from './terminal-manager.js';
import { eventBus } from './event-bus.js';
import { execSync } from 'node:child_process';
import { spawn } from 'node:child_process';

const MAX_REVIEW_ROUNDS = 3;

export class TaskEngine {
  constructor(
    private db: Database.Database,
    private registry: AgentRegistry,
    private terminalManager: TerminalManager,
  ) {}

  /** Submit a task — direct execution to a specific agent */
  async submitTask(input: CreateTaskInput & { autoStart?: boolean }): Promise<Task> {
    if (input.assignedTo) {
      const agent = getAgentById(this.db, input.assignedTo);
      if (!agent) throw new Error(`Agent not found: ${input.assignedTo}`);
      if (!agent.isActive) {
        setAgentActive(this.db, input.assignedTo, true);
      }
    }
    const task = createTask(this.db, input);
    if (input.autoStart && input.assignedTo) {
      await this.executeTask(task.id);
    }
    return getTaskById(this.db, task.id)!;
  }

  /** Submit a department task — director analyzes, delegates to members, members execute in parallel */
  async submitDepartmentTask(departmentId: string, instruction: string, title?: string): Promise<{ parentTask: Task; subtasks: Task[] }> {
    const directors = getAllAgents(this.db, { departmentId, role: 'director' });
    const director = directors[0];
    if (!director) throw new Error(`No director for department ${departmentId}`);
    if (!director.isActive) setAgentActive(this.db, director.id, true);

    const members = getAllAgents(this.db, { departmentId, role: 'member' });

    const memberList = members.map(m => {
      const def = this.registry.getDefinition(m.id);
      const skills = def ? `\n    专长: ${def.identity}\n    使命: ${def.coreMission}` : '';
      return `- ${m.id}: ${m.name}${skills}`;
    }).join('\n');

    const delegationPrompt = `你是部门领导，收到以下任务：

${instruction}

你的团队成员如下：
${memberList}

请分析这个任务，拆解成子任务分配给合适的成员。严格按以下JSON格式输出，不要输出其他内容：

\`\`\`json
{
  "subtasks": [
    {"assign_to": "成员ID", "title": "子任务标题", "instruction": "具体指令"}
  ],
  "summary": "你的分析总结（一句话）"
}
\`\`\`

注意：
- assign_to 必须是上面列表中的成员ID
- 每个子任务的instruction要具体、可执行
- 根据任务复杂度分配1-5个子任务
- 如果任务简单，分配1个成员即可`;

    const parentTask = createTask(this.db, {
      title: title || `[${departmentId}] 部门任务`,
      input: instruction,
      departmentId,
      assignedTo: director.id,
      assignedBy: 'user',
    } as any);

    updateTaskStatus(this.db, parentTask.id, 'running');

    // Post to department board
    insertDeptMessage(this.db, departmentId, director.id, parentTask.id, 'directive',
      `[部门任务] ${instruction.substring(0, 200)}`);
    eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId } });

    // Run delegation flow in background
    this.runDelegation(parentTask.id, director.id, departmentId, delegationPrompt).catch(err => {
      console.error(`Delegation for ${parentTask.id} failed:`, err.message);
      updateTaskStatus(this.db, parentTask.id, 'failed', `领导拆解失败: ${err.message}`);
    });

    return { parentTask: getTaskById(this.db, parentTask.id)!, subtasks: [] };
  }

  /** Background: director delegates, members execute, director reviews results */
  private async runDelegation(parentTaskId: string, directorId: string, departmentId: string, delegationPrompt: string): Promise<void> {
    // Step 1: Director analyzes and produces delegation plan
    console.log(`[Delegation] Director ${directorId} analyzing task ${parentTaskId}...`);
    const directorOutput = await this.executeAndCollect(directorId, delegationPrompt);
    console.log(`[Delegation] Director output: ${directorOutput.substring(0, 200)}...`);

    // Step 2: Parse delegation plan
    const jsonMatch = directorOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
                       directorOutput.match(/\{[\s\S]*"subtasks"[\s\S]*\}/);

    if (!jsonMatch) {
      updateTaskStatus(this.db, parentTaskId, 'completed', `领导直接回复:\n${directorOutput}`);
      insertDeptMessage(this.db, departmentId, directorId, parentTaskId, 'result', `直接回复: ${directorOutput.substring(0, 500)}`);
      eventBus.emitServerEvent({ type: 'task:update', data: { task: getTaskById(this.db, parentTaskId)! } });
      return;
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const plan = JSON.parse(jsonStr);

    if (!plan.subtasks || !Array.isArray(plan.subtasks) || plan.subtasks.length === 0) {
      updateTaskStatus(this.db, parentTaskId, 'completed', `领导直接回复:\n${directorOutput}`);
      eventBus.emitServerEvent({ type: 'task:update', data: { task: getTaskById(this.db, parentTaskId)! } });
      return;
    }

    // Post delegation plan to board
    insertDeptMessage(this.db, departmentId, directorId, parentTaskId, 'directive',
      `分配 ${plan.subtasks.length} 个子任务:\n${plan.subtasks.map((s: any) => `- ${s.assign_to}: ${s.title}`).join('\n')}`);
    eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId } });

    // Step 3: Create subtasks and execute members in parallel
    const subtaskIds = await this.createAndExecuteSubtasks(plan.subtasks, departmentId, directorId, parentTaskId);
    if (subtaskIds.length === 0) {
      updateTaskStatus(this.db, parentTaskId, 'failed', '无有效子任务可执行');
      return;
    }

    // Step 4: Wait for all subtasks, then run review loop
    await this.waitForSubtasks(subtaskIds);
    await this.runReviewLoop(parentTaskId, directorId, departmentId, subtaskIds, plan.summary || '');
  }

  /** Create subtasks from plan and execute them */
  private async createAndExecuteSubtasks(
    subtasks: Array<{ assign_to: string; title: string; instruction: string }>,
    departmentId: string, directorId: string, parentTaskId: string,
  ): Promise<string[]> {
    const subtaskIds: string[] = [];
    const execPromises: Promise<void>[] = [];

    for (const sub of subtasks) {
      const member = getAgentById(this.db, sub.assign_to);
      if (!member) { console.warn(`[Delegation] Member ${sub.assign_to} not found, skipping`); continue; }
      if (!member.isActive) setAgentActive(this.db, sub.assign_to, true);

      const subtask = createTask(this.db, {
        title: sub.title,
        input: sub.instruction,
        departmentId,
        assignedTo: sub.assign_to,
        assignedBy: directorId,
        parentTaskId,
      } as any);
      subtaskIds.push(subtask.id);

      // Post to department board
      insertDeptMessage(this.db, departmentId, sub.assign_to, subtask.id, 'message',
        `开始执行: ${sub.title}`);

      execPromises.push(
        this.executeTask(subtask.id).then(() => {
          console.log(`[Delegation] Subtask ${subtask.id} started`);
        }).catch(err => {
          console.error(`[Delegation] Subtask ${subtask.id} failed to start:`, err.message);
          updateTaskStatus(this.db, subtask.id, 'failed', err.message);
        })
      );
    }

    await Promise.all(execPromises);
    return subtaskIds;
  }

  /** Wait for all subtasks to reach terminal state */
  private waitForSubtasks(subtaskIds: string[]): Promise<void> {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        const allDone = subtaskIds.every(id => {
          const t = getTaskById(this.db, id);
          return t && (t.status === 'completed' || t.status === 'failed');
        });
        if (allDone) {
          clearInterval(check);
          resolve();
        }
      }, 3000);
      // Safety timeout: 10 minutes
      setTimeout(() => { clearInterval(check); resolve(); }, 600000);
    });
  }

  /** Director reviews subtask results — up to MAX_REVIEW_ROUNDS */
  private async runReviewLoop(
    parentTaskId: string, directorId: string, departmentId: string,
    subtaskIds: string[], planSummary: string,
  ): Promise<void> {
    for (let round = 1; round <= MAX_REVIEW_ROUNDS; round++) {
      // Collect subtask results
      const subtaskResults = subtaskIds.map(id => {
        const t = getTaskById(this.db, id)!;
        return { id: t.id, title: t.title, assignedTo: t.assignedTo, status: t.status, output: (t.output || '').substring(0, 800) };
      });

      // Post results to board
      for (const r of subtaskResults) {
        insertDeptMessage(this.db, departmentId, r.assignedTo!, r.id, 'result',
          `[${r.status}] ${r.title}: ${r.output.substring(0, 300)}`);
      }
      eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId } });

      // Update parent status
      updateTaskStatus(this.db, parentTaskId, 'reviewing');
      eventBus.emitServerEvent({ type: 'task:update', data: { task: getTaskById(this.db, parentTaskId)! } });

      // Build review prompt
      const resultsText = subtaskResults.map(r =>
        `### ${r.title} (${r.assignedTo})\n状态: ${r.status}\n输出:\n${r.output}`
      ).join('\n\n---\n\n');

      const isLastRound = round >= MAX_REVIEW_ROUNDS;
      const reviewPrompt = `你是部门领导，这是第${round}轮审核。以下是子任务执行结果：

${resultsText}

${isLastRound ? '这是最后一轮审核，请直接给出approved。' : ''}

请严格按以下JSON格式回复：
\`\`\`json
{
  "verdict": "approved 或 revision_needed",
  "summary": "整体审核总结",
  "revisions": [
    {"taskId": "需要修订的子任务ID", "instruction": "具体修订要求"}
  ]
}
\`\`\`

规则：
- 如果所有子任务质量合格 → verdict: "approved"，revisions为空数组
- 如果某些子任务需要修改 → verdict: "revision_needed"，列出需修订的任务
- revisions中的taskId必须是上面某个子任务的ID`;

      console.log(`[Review] Round ${round} for ${parentTaskId}`);
      const reviewOutput = await this.executeAndCollect(directorId, reviewPrompt);
      console.log(`[Review] Director verdict: ${reviewOutput.substring(0, 200)}`);

      // Parse review
      const reviewJson = reviewOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
                          reviewOutput.match(/\{[\s\S]*"verdict"[\s\S]*\}/);

      let verdict: 'approved' | 'revision_needed' = 'approved';
      let summary = reviewOutput.substring(0, 500);
      let revisions: Array<{ taskId: string; instruction: string }> = [];

      if (reviewJson) {
        try {
          const parsed = JSON.parse(reviewJson[1] || reviewJson[0]);
          verdict = parsed.verdict === 'revision_needed' ? 'revision_needed' : 'approved';
          summary = parsed.summary || summary;
          revisions = Array.isArray(parsed.revisions) ? parsed.revisions : [];
        } catch { /* use defaults */ }
      }

      // Store review
      insertTaskReview(this.db, {
        parentTaskId, reviewerId: directorId, round, verdict, summary, revisions,
      });

      // Post review to board
      insertDeptMessage(this.db, departmentId, directorId, parentTaskId, 'directive',
        `[审核第${round}轮] ${verdict === 'approved' ? '✅ 通过' : '🔄 需修订'}: ${summary.substring(0, 200)}`);
      eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId } });

      if (verdict === 'approved' || revisions.length === 0) {
        // Approved — finalize
        const allResults = subtaskIds.map(id => {
          const t = getTaskById(this.db, id)!;
          return `[${t.assignedTo}] ${t.title}: ${t.status}\n${(t.output || '').substring(0, 500)}`;
        }).join('\n\n---\n\n');

        updateTaskStatus(this.db, parentTaskId, 'completed',
          `领导分析: ${planSummary}\n审核: ${summary}\n审核轮数: ${round}\n\n=== 子任务结果 ===\n\n${allResults}`
        );
        eventBus.emitServerEvent({ type: 'task:update', data: { task: getTaskById(this.db, parentTaskId)! } });
        console.log(`[Review] Task ${parentTaskId} approved at round ${round}`);
        return;
      }

      // Revision needed — create revision subtasks
      console.log(`[Review] ${revisions.length} revisions needed, round ${round}`);
      const revisionTaskIds: string[] = [];

      for (const rev of revisions) {
        const origTask = getTaskById(this.db, rev.taskId);
        if (!origTask || !origTask.assignedTo) continue;

        const revTask = createTask(this.db, {
          title: `[修订R${round}] ${origTask.title}`,
          input: `前次输出:\n${(origTask.output || '').substring(0, 1000)}\n\n修订要求:\n${rev.instruction}`,
          departmentId,
          assignedTo: origTask.assignedTo,
          assignedBy: directorId,
          parentTaskId,
        } as any);
        revisionTaskIds.push(revTask.id);

        insertDeptMessage(this.db, departmentId, origTask.assignedTo, revTask.id, 'request',
          `[修订] ${rev.instruction.substring(0, 200)}`);

        this.executeTask(revTask.id).catch(err => {
          updateTaskStatus(this.db, revTask.id, 'failed', err.message);
        });
      }

      // Update subtask tracking — add revision tasks
      subtaskIds.push(...revisionTaskIds);

      // Wait for revisions to complete
      await this.waitForSubtasks(revisionTaskIds);
    }

    // Fell through max rounds — force approve
    updateTaskStatus(this.db, parentTaskId, 'completed', `最大审核轮数(${MAX_REVIEW_ROUNDS})已达，自动完成`);
    eventBus.emitServerEvent({ type: 'task:update', data: { task: getTaskById(this.db, parentTaskId)! } });
  }

  /** Execute a single task via terminal, with shared context injection */
  async executeTask(taskId: string): Promise<string> {
    const task = getTaskById(this.db, taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!task.assignedTo) throw new Error('Task has no assigned agent');
    const agent = getAgentById(this.db, task.assignedTo);
    if (!agent) throw new Error(`Agent not found: ${task.assignedTo}`);
    if (!agent.isActive) setAgentActive(this.db, task.assignedTo, true);
    const agentDef = this.registry.getDefinition(agent.id);
    if (!agentDef) throw new Error(`Agent definition not found: ${agent.id}`);
    const runtime = task.runtime || this.selectRuntime(agent.runtimes);
    if (!runtime) throw new Error(`No available runtime for agent ${agent.id}`);

    // Build system prompt
    let fullPrompt = this.registry.buildSystemPrompt(agent.id);

    // Inject agent memories
    const memories = getMemories(this.db, agent.id, 10);
    if (memories.length > 0) {
      fullPrompt += '\n\n## Your Memory (from previous sessions)\n';
      memories.forEach(m => {
        fullPrompt += `- [${m.type}] ${m.content}\n`;
      });
    }

    // Inject shared department context
    if (task.departmentId) {
      // Department message board
      const deptMessages = getRecentDeptMessages(this.db, task.departmentId, 10);
      if (deptMessages.length > 0) {
        fullPrompt += '\n\n## 部门动态 (Department Board)\n';
        for (const msg of deptMessages) {
          fullPrompt += `[${msg.authorId}/${msg.type}] ${msg.content.substring(0, 200)}\n`;
        }
      }

      // Shared department knowledge
      const deptCtx = getAllDeptContext(this.db, task.departmentId);
      if (deptCtx.length > 0) {
        fullPrompt += '\n\n## 部门共享知识 (Department Knowledge)\n';
        for (const ctx of deptCtx.slice(0, 10)) {
          fullPrompt += `- **${ctx.key}**: ${ctx.value.substring(0, 200)}\n`;
        }
      }

      // Department colleague memories relevant to this task
      const keywords = task.input.substring(0, 100).split(/\s+/).filter(w => w.length > 2).slice(0, 3).join(' ');
      if (keywords) {
        const deptMemories = searchDeptMemories(this.db, task.departmentId, keywords, 5);
        const otherMemories = deptMemories.filter(m => m.agentId !== agent.id);
        if (otherMemories.length > 0) {
          fullPrompt += '\n\n## 同事相关经验 (Colleague Insights)\n';
          for (const m of otherMemories) {
            fullPrompt += `[${m.agentId}] ${m.content.substring(0, 200)}\n`;
          }
        }
      }
    }

    // Inject sibling task results (for subtasks of same parent)
    if (task.parentTaskId) {
      const siblings = getAllTasks(this.db, { parentTaskId: task.parentTaskId })
        .filter(t => t.id !== task.id && t.status === 'completed');
      if (siblings.length > 0) {
        fullPrompt += '\n\n## 相关子任务结果 (Sibling Results)\n';
        for (const s of siblings.slice(-5)) {
          fullPrompt += `[${s.assignedTo}] ${s.title}: ${(s.output || '').substring(0, 300)}\n---\n`;
        }
      }
    }

    // Inject assigned skills (curated capabilities assigned to this agent)
    const assignedSkills = getAgentSkills(this.db, agent.id);
    // Also search for relevant skills by task keywords
    const taskKeywords = task.input.substring(0, 80).split(/\s+/).filter(w => w.length > 2).slice(0, 3).join(' ');
    const searchedSkills = taskKeywords ? searchSkills(this.db, taskKeywords, 3) : [];
    // Merge, deduplicate
    const allSkills = [...assignedSkills];
    for (const s of searchedSkills) {
      if (!allSkills.some(a => a.id === s.id)) allSkills.push(s);
    }
    if (allSkills.length > 0) {
      fullPrompt += '\n\n## Skills\n';
      fullPrompt += 'You have the following skills available:\n\n';
      for (const skill of allSkills.slice(0, 5)) {
        fullPrompt += `### ${skill.name}\n${skill.description}\n\n${skill.content.substring(0, 800)}\n\n---\n\n`;
        incrementSkillUse(this.db, skill.id);
      }
    }

    return this.terminalManager.startTask({
      taskId: task.id, agentId: agent.id, agentDef, runtime, input: task.input,
      workingDir: task.workingDir || undefined, systemPrompt: fullPrompt,
    });
  }

  /** Execute and wait for output (used by director delegation/review) */
  private executeAndCollect(agentId: string, input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const agentDef = this.registry.getDefinition(agentId);
      if (!agentDef) return reject(new Error(`Agent def not found: ${agentId}`));
      const basePrompt = this.registry.buildSystemPrompt(agentId);
      const memories = getMemories(this.db, agentId, 10);
      let systemPrompt = basePrompt;
      if (memories.length > 0) {
        systemPrompt += '\n\n## Your Memory (from previous sessions)\n';
        memories.forEach(m => {
          systemPrompt += `- [${m.type}] ${m.content}\n`;
        });
      }

      let claudePath = 'claude';
      try { claudePath = execSync('/bin/zsh -l -c "which claude"', { encoding: 'utf-8' }).trim() || 'claude'; } catch {}

      const proc = spawn(claudePath, ['-p', '--output-format', 'text', '--permission-mode', 'bypassPermissions', '--system-prompt', systemPrompt, input], {
        cwd: process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      proc.stdin.end();

      let output = '';
      let error = '';
      proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { error += d.toString(); });
      proc.on('close', (code: number) => {
        if (output.trim()) resolve(output.trim());
        else reject(new Error(error || `Exit code ${code}`));
      });
      proc.on('error', (e: Error) => reject(e));
      setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('Timeout')); }, 120000);
    });
  }

  private selectRuntime(agentRuntimes: string[]): string | null {
    const available = getAllRuntimes(this.db).filter(r => r.isAvailable);
    for (const rt of agentRuntimes) {
      if (available.some(a => a.id === rt)) return rt;
    }
    return null;
  }
}
