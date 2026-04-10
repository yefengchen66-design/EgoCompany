import type Database from 'better-sqlite3';
import { createMeeting, getMeetingById, updateMeeting, type Meeting, type MeetingMessage } from '../db/queries/meetings.js';
import { getAgentById, setAgentActive } from '../db/queries/agents.js';
import { createTask, getTaskById, getAllTasks } from '../db/queries/tasks.js';
import { insertDeptMessage } from '../db/queries/dept-messages.js';
import type { AgentRegistry } from './agent-registry.js';
import type { TerminalManager } from './terminal-manager.js';
import type { TaskEngine } from './task-engine.js';
import { eventBus } from './event-bus.js';
import { spawn, execSync } from 'node:child_process';

export class MeetingExecutor {
  private taskEngine: TaskEngine | null = null;

  constructor(
    private db: Database.Database,
    private registry: AgentRegistry,
    private terminalManager: TerminalManager,
  ) {}

  setTaskEngine(engine: TaskEngine) {
    this.taskEngine = engine;
  }

  async startMeeting(title: string, topic: string, participantIds: string[]): Promise<Meeting> {
    const meeting = createMeeting(this.db, title, topic, participantIds);
    updateMeeting(this.db, meeting.id, { status: 'in_progress' });

    // Execute in background
    this.runMeeting(meeting.id, topic, participantIds).catch(err => {
      console.error(`Meeting ${meeting.id} failed:`, err);
      updateMeeting(this.db, meeting.id, { status: 'failed', completedAt: new Date().toISOString() });
    });

    return getMeetingById(this.db, meeting.id)!;
  }

  private async runMeeting(meetingId: string, topic: string, participantIds: string[]): Promise<void> {
    const messages: MeetingMessage[] = [];
    let context = '';

    for (const agentId of participantIds) {
      const agent = getAgentById(this.db, agentId);
      if (!agent) continue;

      // Auto-activate if needed
      if (!agent.isActive) {
        setAgentActive(this.db, agentId, true);
      }

      const agentDef = this.registry.getDefinition(agentId);
      if (!agentDef) continue;

      const systemPrompt = this.registry.buildSystemPrompt(agentId);

      // Build prompt with meeting context
      let prompt = `你正在参加一个跨部门会议。\n\n会议主题: ${topic}\n\n`;
      if (context) {
        prompt += `前面的发言:\n${context}\n\n`;
      }
      prompt += `请从你的专业角度(${agentDef.name} - ${agentDef.coreMission})发表意见，200字以内。直接给出你的观点，不要重复别人说过的内容。`;

      try {
        // Execute via terminal manager and collect output
        const output = await this.executeAndCollect(agentId, systemPrompt, prompt);

        const message: MeetingMessage = {
          agentId,
          agentName: agent.name,
          content: output,
          timestamp: new Date().toISOString(),
        };
        messages.push(message);
        context += `\n[${agent.name}]: ${output}\n`;

        // Update meeting with new message
        updateMeeting(this.db, meetingId, { messages });

        // Broadcast progress
        eventBus.emitServerEvent({
          type: 'pipeline:progress',
          data: { pipelineId: meetingId, stage: agentId, status: 'completed' },
        });
      } catch (err) {
        messages.push({
          agentId,
          agentName: agent.name,
          content: `[发言失败: ${(err as Error).message}]`,
          timestamp: new Date().toISOString(),
        });
        updateMeeting(this.db, meetingId, { messages });
      }
    }

    // Generate summary (use the last participant or a simple concat)
    const summary = messages.map(m => `**${m.agentName}**: ${m.content}`).join('\n\n');

    updateMeeting(this.db, meetingId, {
      status: 'completed',
      messages,
      summary,
      completedAt: new Date().toISOString(),
    });
  }

  async addFollowup(meetingId: string, message: string): Promise<void> {
    const meeting = getMeetingById(this.db, meetingId);
    if (!meeting) throw new Error('Meeting not found');

    // Add user message
    const messages = [...meeting.messages];
    messages.push({
      agentId: 'user',
      agentName: '你 (主持人)',
      content: message,
      timestamp: new Date().toISOString(),
    });
    updateMeeting(this.db, meetingId, { status: 'in_progress', messages });

    // Each participant responds in background
    this.runFollowup(meetingId, message, meeting.participantIds).catch(err => {
      console.error(`Followup failed:`, err);
    });
  }

  private async runFollowup(meetingId: string, question: string, participantIds: string[]): Promise<void> {
    const meeting = getMeetingById(this.db, meetingId)!;
    const messages = [...meeting.messages];

    // Build context from all previous messages
    let context = messages.map(m => `[${m.agentName}]: ${m.content}`).join('\n\n');

    for (const agentId of participantIds) {
      const agent = getAgentById(this.db, agentId);
      if (!agent) continue;
      if (!agent.isActive) setAgentActive(this.db, agentId, true);

      const agentDef = this.registry.getDefinition(agentId);
      if (!agentDef) continue;

      const systemPrompt = this.registry.buildSystemPrompt(agentId);
      const prompt = `你在一个跨部门会议中。\n\n之前的讨论:\n${context}\n\n主持人追问: ${question}\n\n请从你的专业角度回应，100字以内。`;

      try {
        const output = await this.executeAndCollect(agentId, systemPrompt, prompt);
        const msg = { agentId, agentName: agent.name, content: output, timestamp: new Date().toISOString() };
        messages.push(msg);
        context += `\n\n[${agent.name}]: ${output}`;
        updateMeeting(this.db, meetingId, { messages });
      } catch (err) {
        messages.push({ agentId, agentName: agent.name, content: `[回应失败]`, timestamp: new Date().toISOString() });
        updateMeeting(this.db, meetingId, { messages });
      }
    }

    updateMeeting(this.db, meetingId, { status: 'completed', completedAt: new Date().toISOString() });
  }

  async dispatchWork(meetingId: string): Promise<{ dispatched: number; phases?: any[] }> {
    if (!this.taskEngine) throw new Error('TaskEngine not set');

    const meeting = getMeetingById(this.db, meetingId)!;
    const summary = meeting.messages.map(m => `[${m.agentName}]: ${m.content}`).join('\n\n');

    const departments: string[] = [];
    for (const agentId of meeting.participantIds) {
      const agent = getAgentById(this.db, agentId);
      if (agent && !departments.includes(agent.departmentId)) departments.push(agent.departmentId);
    }

    // Step 1: Ask orchestrator to create a phased execution plan
    console.log(`[Orchestrate] Planning phases for ${departments.length} departments...`);
    const planPrompt = `You are a project orchestrator. Analyze this meeting and create a phased execution plan.

Meeting topic: ${meeting.topic}

Meeting transcript:
${summary}

Departments involved: ${departments.join(', ')}

Create a phased plan where:
- Departments that can work independently go in the same phase (parallel)
- Departments that depend on others' output go in later phases
- Each phase executes only after the previous phase completes

Output STRICTLY as JSON, no other text:
\`\`\`json
{
  "phases": [
    {
      "name": "Phase 1: Research & Planning",
      "departments": ["product", "design"],
      "reason": "Product research and design exploration can happen in parallel"
    },
    {
      "name": "Phase 2: Implementation",
      "departments": ["engineering"],
      "reason": "Engineering needs product specs and design from Phase 1"
    }
  ]
}
\`\`\`

Rules:
- Only use departments from this list: ${departments.join(', ')}
- Every department must appear in exactly one phase
- 2-4 phases is typical
- Phase 1 should include departments that don't need input from others`;

    let phases: Array<{ name: string; departments: string[]; reason: string }> = [];

    try {
      const planOutput = await this.executeAndCollect('pmg-009', this.registry.buildSystemPrompt('pmg-009'), planPrompt);
      const jsonMatch = planOutput.match(/```json\s*([\s\S]*?)\s*```/) || planOutput.match(/\{[\s\S]*"phases"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (parsed.phases && Array.isArray(parsed.phases)) {
          phases = parsed.phases;
        }
      }
    } catch (err: any) {
      console.warn(`[Orchestrate] Planning failed, falling back to parallel: ${err.message}`);
    }

    // Fallback: all departments in one phase
    if (phases.length === 0) {
      phases = [{ name: 'Phase 1: All Departments', departments, reason: 'Parallel execution (planning unavailable)' }];
    }

    // Validate: ensure all departments are covered
    const coveredDepts = new Set(phases.flatMap(p => p.departments));
    for (const d of departments) {
      if (!coveredDepts.has(d)) {
        phases[phases.length - 1].departments.push(d);
      }
    }

    console.log(`[Orchestrate] Plan: ${phases.length} phases`);
    phases.forEach((p, i) => console.log(`  Phase ${i + 1}: ${p.departments.join(', ')} — ${p.reason}`));

    // Post plan to department boards
    // insertDeptMessage already imported at top
    for (const deptId of departments) {
      const phaseIdx = phases.findIndex(p => p.departments.includes(deptId));
      insertDeptMessage(this.db, deptId, 'pmg-009', null, 'directive',
        `[Project Plan] Phase ${phaseIdx + 1}/${phases.length}: ${phases[phaseIdx]?.name || 'TBD'}\nReason: ${phases[phaseIdx]?.reason || ''}`);
    }
    eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId: departments[0] } });

    // Step 2: Execute phases sequentially
    let dispatched = 0;
    let prevPhaseResults = '';

    for (let pi = 0; pi < phases.length; pi++) {
      const phase = phases[pi];
      console.log(`[Orchestrate] Executing Phase ${pi + 1}: ${phase.departments.join(', ')}`);

      const phaseTaskIds: string[] = [];

      // Dispatch all departments in this phase in parallel
      for (const deptId of phase.departments) {
        const instruction = `${prevPhaseResults ? `## Previous Phase Results\n${prevPhaseResults}\n\n---\n\n` : ''}Based on the meeting discussion and ${prevPhaseResults ? 'previous phase results above' : 'project requirements'}, create an action plan and delegate specific tasks to your team members.

Meeting topic: ${meeting.topic}
Current phase: ${phase.name} (Phase ${pi + 1}/${phases.length})
${phase.reason}

Meeting transcript:
${summary}

Analyze what your department needs to do, then assign concrete subtasks to your team members.`;

        try {
          const result = await this.taskEngine.submitDepartmentTask(deptId, instruction, `[${phase.name}] ${meeting.title}`);
          phaseTaskIds.push(result.parentTask.id);
          dispatched++;
        } catch (err: any) {
          console.error(`[Orchestrate] Failed to dispatch to ${deptId}:`, err.message);
        }
      }

      // Wait for all tasks in this phase to complete before moving to next
      if (pi < phases.length - 1 && phaseTaskIds.length > 0) {
        console.log(`[Orchestrate] Waiting for Phase ${pi + 1} to complete...`);
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            const allDone = phaseTaskIds.every(id => {
              // getTaskById already imported at top
              const t = getTaskById(this.db, id);
              return t && (t.status === 'completed' || t.status === 'failed');
            });
            if (allDone) {
              clearInterval(check);
              resolve();
            }
          }, 5000);
          // Safety timeout: 15 minutes per phase
          setTimeout(() => { clearInterval(check); resolve(); }, 900000);
        });

        // Collect results for next phase context
        // getTaskById and getAllTasks already imported at top
        prevPhaseResults = phaseTaskIds.map(id => {
          const t = getTaskById(this.db, id);
          if (!t) return '';
          let output = t.output || '';
          try { const p = JSON.parse(output); output = p.result || output; } catch {}
          // Include subtask results too
          const subs = getAllTasks(this.db, { parentTaskId: id });
          const subResults = subs.map((s: any) => {
            let so = s.output || '';
            try { const p = JSON.parse(so); so = p.result || so; } catch {}
            return `[${s.assignedTo}] ${s.title}: ${so.substring(0, 300)}`;
          }).join('\n');
          return `### ${t.departmentId} (${t.title})\n${output.substring(0, 500)}\n${subResults}`;
        }).filter(Boolean).join('\n\n---\n\n');

        console.log(`[Orchestrate] Phase ${pi + 1} complete. Moving to Phase ${pi + 2}.`);
      }
    }

    return { dispatched, phases };
  }

  /** Synthesize all department results into a unified project deliverable */
  async synthesizeResults(meetingId: string, synthesizerId?: string): Promise<any> {
    if (!this.taskEngine) throw new Error('TaskEngine not set');

    const meeting = getMeetingById(this.db, meetingId)!;

    // Find all tasks dispatched from this meeting
    const allTasks = getAllTasks(this.db, {});
    const meetingTasks = allTasks.filter((t: any) =>
      t.title?.includes(meeting.title) || t.title?.includes('[Meeting Action]')
    );

    // Collect department results
    const deptResults: string[] = [];
    for (const task of meetingTasks) {
      let output = task.output || '';
      try { const p = JSON.parse(output); output = p.result || output; } catch {}

      // Get subtasks
      const subtasks = allTasks.filter((t: any) => t.parentTaskId === task.id);
      let subtaskOutputs = '';
      for (const sub of subtasks) {
        let subOut = sub.output || '';
        try { const p = JSON.parse(subOut); subOut = p.result || subOut; } catch {}
        if (subOut) {
          const agent = sub.assignedTo ? getAgentById(this.db, sub.assignedTo) : null;
          subtaskOutputs += `\n### ${agent?.name || sub.assignedTo}\n${subOut.substring(0, 800)}\n`;
        }
      }

      const agent = task.assignedTo ? getAgentById(this.db, task.assignedTo) : null;
      deptResults.push(`## ${agent?.name || task.assignedTo} (${task.departmentId})\nStatus: ${task.status}\n${output.substring(0, 500)}\n${subtaskOutputs}`);
    }

    if (deptResults.length === 0) {
      throw new Error('No department results to synthesize yet');
    }

    // Default synthesizer: Chief of Staff (pmg-009) or Senior PM (pmg-001)
    const agentId = synthesizerId || 'pmg-009';
    const agent = getAgentById(this.db, agentId);
    if (!agent) throw new Error(`Synthesizer agent not found: ${agentId}`);
    if (!agent.isActive) setAgentActive(this.db, agentId, true);

    const synthesisInput = `You are synthesizing results from a cross-department meeting into a unified project deliverable.

## Meeting Context
Topic: ${meeting.topic}
Departments involved: ${meetingTasks.map((t: any) => t.departmentId).filter(Boolean).join(', ')}

## Department Results

${deptResults.join('\n\n---\n\n')}

## Your Task
Create a unified project report that:
1. Executive Summary — key decisions and outcomes (3-5 bullets)
2. Department Contributions — what each department delivered
3. Integration Points — where departments need to coordinate
4. Action Items — specific next steps with owners
5. Risks & Dependencies — what could block progress
6. Timeline — suggested milestones

Output a well-structured, actionable project report.`;

    const task = await this.taskEngine.submitTask({
      title: `[Project Report] ${meeting.title}`,
      input: synthesisInput,
      assignedTo: agentId,
      departmentId: agent.departmentId,
      autoStart: true,
    });

    return { taskId: task.id, synthesizer: agentId, departmentsIncluded: deptResults.length };
  }

  private executeAndCollect(_agentId: string, systemPrompt: string, input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Resolve claude path
      let claudePath = 'claude';
      try {
        claudePath = execSync('/bin/zsh -l -c "which claude"', { encoding: 'utf-8' }).trim() || 'claude';
      } catch { /* fallback */ }

      // Spawn directly with args array — no shell escaping needed
      const proc = spawn(claudePath, ['-p', '--output-format', 'text', '--permission-mode', 'bypassPermissions', '--system-prompt', systemPrompt, input], {
        cwd: process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Close stdin so claude doesn't wait
      proc.stdin.end();

      let output = '';
      let error = '';
      proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { error += d.toString(); });
      proc.on('close', (code: number) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim());
        } else {
          reject(new Error(error || output || `Process exited with code ${code}`));
        }
      });
      proc.on('error', (e: Error) => reject(e));

      // Timeout: 120 seconds per participant
      setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('Meeting response timeout')); }, 120000);
    });
  }
}
