import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useState } from 'react';
import { FolderOpen, ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2, Clock, Users, RefreshCw, Send, FileText, Copy } from 'lucide-react';
import { useI18n } from '@/i18n/context';

export default function Projects() {
  const { lang, agentName, deptName } = useI18n();
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => api.getTasks(), refetchInterval: 5000 });

  // Build projects from parent-child task structure
  const parentTasks = tasks.filter((t: any) => tasks.some((s: any) => s.parentTaskId === t.id));
  const projectGroups: Record<string, any[]> = {};
  parentTasks.forEach((t: any) => {
    const titleMatch = t.title?.match(/\]\s*(.+)$/);
    const projectName = titleMatch ? titleMatch[1].trim() : (t.title || 'Project');
    if (!projectGroups[projectName]) projectGroups[projectName] = [];
    projectGroups[projectName].push(t);
  });

  const projects = Object.entries(projectGroups).map(([name, pTasks], idx) => {
    const phases = pTasks.sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt)).map((t: any) => {
      const subs = tasks.filter((s: any) => s.parentTaskId === t.id);
      const phaseMatch = t.title?.match(/^\[([^\]]+)\]/);
      return { name: phaseMatch ? phaseMatch[1] : t.title, deptId: t.departmentId, parentTask: t, subtasks: subs, status: t.status };
    });
    const allPhaseTasks = phases.flatMap((p: any) => [p.parentTask, ...p.subtasks]);
    return {
      id: `project-${idx}`, name, phases,
      stats: {
        total: allPhaseTasks.length,
        completed: allPhaseTasks.filter((t: any) => t.status === 'completed').length,
        failed: allPhaseTasks.filter((t: any) => t.status === 'failed').length,
        running: allPhaseTasks.filter((t: any) => ['running', 'reviewing', 'queued'].includes(t.status)).length,
      },
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2"><FolderOpen size={20} /> {lang === 'en' ? 'Projects' : '项目管理'}</h2>
        <p className="text-xs text-gray-500 mt-1">{lang === 'en' ? 'Cross-department project tracking with phased execution.' : '跨部门项目追踪，分阶段执行。'}</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FolderOpen size={32} className="mx-auto mb-3 text-gray-600" />
          <p>{lang === 'en' ? 'No projects yet.' : '暂无项目。'}</p>
          <p className="text-xs mt-1">{lang === 'en' ? 'Start a meeting → dispatch tasks → projects appear here.' : '发起会议 → 派发任务 → 项目将出现在这里。'}</p>
        </div>
      ) : projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: any }) {
  const { lang, deptName } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);

  const pct = project.stats.total > 0 ? Math.round(project.stats.completed / project.stats.total * 100) : 0;
  const isComplete = project.stats.running === 0 && project.stats.total > 0;
  const hasFailed = project.stats.failed > 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-800/50 transition-colors text-left">
        {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
        <FolderOpen size={18} className="text-blue-400" />
        <div className="flex-1">
          <h3 className="font-medium">{project.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{project.phases.length} {lang === 'en' ? 'phases' : '阶段'}</span>
            <span>{project.stats.total} {lang === 'en' ? 'tasks' : '任务'}</span>
            <span className="text-green-400">{project.stats.completed} {lang === 'en' ? 'done' : '完成'}</span>
            {project.stats.running > 0 && <span className="text-yellow-400">{project.stats.running} {lang === 'en' ? 'running' : '执行中'}</span>}
            {project.stats.failed > 0 && <span className="text-red-400">{project.stats.failed} {lang === 'en' ? 'failed' : '失败'}</span>}
          </div>
        </div>
        <div className="w-24 flex-shrink-0">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: hasFailed ? '#ef4444' : pct === 100 ? '#22c55e' : '#eab308' }} />
          </div>
          <p className="text-[10px] text-gray-500 text-right mt-0.5">{pct}%</p>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {isComplete && (
              <button onClick={() => setShowReport(!showReport)}
                className="px-3 py-1.5 bg-blue-900/30 text-blue-400 rounded-lg text-xs hover:bg-blue-900/50 flex items-center gap-1">
                <FileText size={12} /> {showReport ? (lang === 'en' ? 'Hide Full Report' : '收起报告') : (lang === 'en' ? 'View Full Report' : '查看完整报告')}
              </button>
            )}
            <button onClick={() => setShowFollowup(!showFollowup)}
              className="px-3 py-1.5 bg-purple-900/30 text-purple-400 rounded-lg text-xs hover:bg-purple-900/50 flex items-center gap-1">
              <Send size={12} /> {lang === 'en' ? 'Follow-up Task' : '追加任务'}
            </button>
          </div>

          {/* Full report */}
          {showReport && <FullReport project={project} />}

          {/* Follow-up task form */}
          {showFollowup && <FollowupForm project={project} onDone={() => setShowFollowup(false)} />}

          {/* Phases */}
          {project.phases.map((phase: any, pi: number) => (
            <PhaseCard key={pi} phase={phase} index={pi} total={project.phases.length} />
          ))}
        </div>
      )}
    </div>
  );
}

function FullReport({ project }: { project: any }) {
  const { lang, agentName, deptName } = useI18n();
  const [copied, setCopied] = useState(false);

  // Build full text report
  let report = `# ${project.name}\n\n`;
  project.phases.forEach((phase: any, pi: number) => {
    report += `## Phase ${pi + 1}: ${phase.name} (${deptName(phase.deptId)})\n`;
    report += `Status: ${phase.status}\n\n`;

    // Director output
    let dirOut = phase.parentTask.output || '';
    try { const p = JSON.parse(dirOut); dirOut = p.result || dirOut; } catch {}
    if (dirOut) report += `### Director Summary\n${dirOut.substring(0, 500)}\n\n`;

    // Subtask outputs
    phase.subtasks.forEach((sub: any) => {
      let subOut = sub.output || '';
      try { const p = JSON.parse(subOut); subOut = p.result || subOut; } catch {}
      report += `### ${sub.assignedTo}: ${sub.title}\n`;
      report += `Status: ${sub.status}\n`;
      if (subOut) report += `${subOut.substring(0, 600)}\n`;
      report += '\n';
    });
    report += '---\n\n';
  });

  const copyReport = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">{lang === 'en' ? 'Full Project Report' : '完整项目报告'}</h4>
        <button onClick={copyReport} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs flex items-center gap-1 hover:bg-gray-600">
          <Copy size={10} /> {copied ? (lang === 'en' ? 'Copied!' : '已复制!') : (lang === 'en' ? 'Copy' : '复制')}
        </button>
      </div>
      <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto font-mono bg-gray-950 rounded p-3 border border-gray-800">
        {report}
      </pre>
    </div>
  );
}

function FollowupForm({ project, onDone }: { project: any; onDone: () => void }) {
  const { lang, deptName } = useI18n();
  const queryClient = useQueryClient();
  const [deptId, setDeptId] = useState('');
  const [instruction, setInstruction] = useState('');

  const DEPTS = project.phases.map((p: any) => p.deptId).filter(Boolean);

  const submit = useMutation({
    mutationFn: () => api.submitDeptTask(deptId, instruction, `[Follow-up] ${project.name}`),
    onSuccess: () => { onDone(); queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
  });

  return (
    <div className="bg-purple-900/10 border border-purple-800/30 rounded-lg p-3 space-y-2">
      <p className="text-xs text-purple-400 font-medium">{lang === 'en' ? 'Send follow-up task to a department' : '向部门追加任务'}</p>
      <select value={deptId} onChange={e => setDeptId(e.target.value)}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs">
        <option value="">{lang === 'en' ? 'Select department' : '选择部门'}</option>
        {DEPTS.map((d: string) => <option key={d} value={d}>{deptName(d)}</option>)}
      </select>
      <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={3}
        placeholder={lang === 'en' ? 'Follow-up instructions (this department will receive all prior project context)...' : '追加指令（该部门将收到之前项目的完整上下文）...'}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs resize-none" />
      <div className="flex gap-2">
        <button onClick={() => submit.mutate()} disabled={!deptId || !instruction.trim() || submit.isPending}
          className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs disabled:opacity-50 flex items-center gap-1">
          <Send size={10} /> {submit.isPending ? '...' : (lang === 'en' ? 'Send' : '发送')}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs">{lang === 'en' ? 'Cancel' : '取消'}</button>
      </div>
    </div>
  );
}

function PhaseCard({ phase, index, total }: { phase: any; index: number; total: number }) {
  const { lang, agentName, deptName } = useI18n();
  const queryClient = useQueryClient();
  const [showSubs, setShowSubs] = useState(false);

  const retryTask = useMutation({
    mutationFn: (id: string) => api.retryTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const redispatch = useMutation({
    mutationFn: (id: string) => api.redispatchTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const statusColors: Record<string, string> = {
    completed: 'border-green-800/50 bg-green-900/5',
    failed: 'border-red-800/50 bg-red-900/5',
    running: 'border-yellow-800/50 bg-yellow-900/5',
    reviewing: 'border-purple-800/50 bg-purple-900/5',
    cancelled: 'border-gray-700 bg-gray-800/20',
  };
  const statusLabels: Record<string, Record<string, string>> = {
    en: { completed: 'Done', failed: 'Failed', running: 'Running', reviewing: 'Reviewing', cancelled: 'Cancelled', queued: 'Queued' },
    zh: { completed: '完成', failed: '失败', running: '执行中', reviewing: '审核中', cancelled: '已取消', queued: '排队中' },
  };

  const completedSubs = phase.subtasks.filter((s: any) => s.status === 'completed').length;
  const failedSubs = phase.subtasks.filter((s: any) => s.status === 'failed' || s.status === 'cancelled').length;

  return (
    <div className={`border rounded-lg p-3 ${statusColors[phase.status] || 'border-gray-800'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500">P{index + 1}/{total}</span>
          <span className="text-sm font-medium">{phase.name}</span>
          <span className="text-xs text-blue-400">{deptName(phase.deptId)}</span>
        </div>
        <div className="flex items-center gap-2">
          {(phase.status === 'failed' || phase.status === 'cancelled') && (
            <button onClick={() => redispatch.mutate(phase.parentTask.id)}
              className="px-2 py-0.5 bg-orange-900/30 text-orange-400 rounded text-[10px] hover:bg-orange-900/50 flex items-center gap-1">
              <RefreshCw size={10} /> {lang === 'en' ? 'Retry Phase' : '重试阶段'}
            </button>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            phase.status === 'completed' ? 'bg-green-900/30 text-green-400' :
            phase.status === 'failed' ? 'bg-red-900/30 text-red-400' :
            phase.status === 'running' || phase.status === 'reviewing' ? 'bg-yellow-900/30 text-yellow-400' :
            'bg-gray-800 text-gray-400'
          }`}>{statusLabels[lang]?.[phase.status] || phase.status}</span>
        </div>
      </div>

      {/* Director output */}
      {phase.parentTask.output && <DirectorOutput output={phase.parentTask.output} />}

      {/* Subtasks */}
      {phase.subtasks.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowSubs(!showSubs)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <Users size={10} />
            {completedSubs}/{phase.subtasks.length} {lang === 'en' ? 'done' : '完成'}
            {failedSubs > 0 && <span className="text-red-400 ml-1">({failedSubs} {lang === 'en' ? 'failed' : '失败'})</span>}
            {showSubs ? ' ▲' : ' ▼'}
          </button>
          {showSubs && (
            <div className="mt-2 space-y-1">
              {phase.subtasks.map((sub: any) => {
                let preview = sub.output || '';
                try { const p = JSON.parse(preview); preview = p.result || preview; } catch {}
                return (
                  <div key={sub.id} className="bg-gray-800/30 rounded px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{sub.assignedTo}: {sub.title?.substring(0, 40)}</span>
                      <div className="flex items-center gap-1">
                        {(sub.status === 'failed' || sub.status === 'cancelled') && (
                          <button onClick={() => retryTask.mutate(sub.id)}
                            className="text-[10px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5">
                            <RefreshCw size={8} /> Retry
                          </button>
                        )}
                        <span className={`text-[10px] ${sub.status === 'completed' ? 'text-green-400' : sub.status === 'failed' ? 'text-red-400' : 'text-gray-500'}`}>
                          {statusLabels[lang]?.[sub.status] || sub.status}
                        </span>
                      </div>
                    </div>
                    {preview && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-gray-500 cursor-pointer">{lang === 'en' ? 'View output' : '查看输出'}</summary>
                        <pre className="mt-1 text-[10px] text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto bg-gray-950 rounded p-2">{preview.substring(0, 600)}</pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DirectorOutput({ output }: { output: string }) {
  let text = output;
  try { const p = JSON.parse(output); text = p.result || output; } catch {}
  if (!text || text.length < 20) return null;
  return (
    <details>
      <summary className="text-[10px] text-gray-500 cursor-pointer">Director summary</summary>
      <pre className="mt-1 text-[10px] text-gray-400 whitespace-pre-wrap max-h-24 overflow-y-auto bg-gray-800/30 rounded p-2">{text.substring(0, 400)}</pre>
    </details>
  );
}
