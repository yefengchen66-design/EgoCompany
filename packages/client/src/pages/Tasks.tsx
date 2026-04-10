import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useState } from 'react';
import { Plus, Play, X, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, Loader2, MessageSquare, Coins, RotateCw, Cpu, Zap, Layers, Users, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/context';

const DEPARTMENTS = [
  { id: 'engineering', emoji: '⚙️' },
  { id: 'design', emoji: '🎨' },
  { id: 'product', emoji: '📦' },
  { id: 'marketing', emoji: '📢' },
  { id: 'sales', emoji: '💰' },
  { id: 'paid-media', emoji: '📊' },
  { id: 'project-mgmt', emoji: '📋' },
  { id: 'qa', emoji: '🔍' },
  { id: 'data-ai', emoji: '🤖' },
  { id: 'infrastructure', emoji: '🏗️' },
  { id: 'game-dev', emoji: '🎮' },
  { id: 'finance', emoji: '💵' },
  { id: 'legal', emoji: '⚖️' },
  { id: 'customer-service', emoji: '🎧' },
  { id: 'support', emoji: '🤝' },
];

export default function Tasks() {
  const { t, deptName } = useI18n();
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => api.getTasks(), refetchInterval: 3000 });
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState('all');

  const filtered = tab === 'all' ? tasks
    : tab === 'running' ? tasks.filter((t: any) => t.status === 'running' || t.status === 'queued' || t.status === 'reviewing')
    : tab === 'completed' ? tasks.filter((t: any) => t.status === 'completed')
    : tasks.filter((t: any) => t.status === 'failed' || t.status === 'cancelled');

  const runningCount = tasks.filter((t: any) => ['running', 'queued', 'reviewing'].includes(t.status)).length;
  const completedCount = tasks.filter((t: any) => t.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('tasks.title')}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {tasks.length} {t('tasks.total')} · {t('tasks.running')} {runningCount} · {t('tasks.completed')} {completedCount}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">
          <Plus size={14} /> {t('tasks.newTask')}
        </button>
      </div>

      {showCreate && <CreateTaskForm onClose={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['tasks'] }); }} />}

      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
        {[
          { key: 'all', label: t('tasks.all'), count: tasks.length },
          { key: 'running', label: t('tasks.running'), count: runningCount },
          { key: 'completed', label: t('tasks.completed'), count: completedCount },
          { key: 'failed', label: t('tasks.failed'), count: tasks.filter((t: any) => t.status === 'failed').length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
              tab === t.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>{t('tasks.noTasks')}</p>
            <p className="text-xs mt-1">{t('tasks.clickCreate')}</p>
          </div>
        ) : filtered.map((task: any) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: any }) {
  const { t, deptName, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showSaveSkill, setShowSaveSkill] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const queryClient = useQueryClient();

  const executeTask = useMutation({
    mutationFn: () => api.executeTask(task.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const cancelTask = useMutation({
    mutationFn: () => api.cancelTask(task.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const retryTask = useMutation({
    mutationFn: () => api.retryTask(task.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const redispatchTask = useMutation({
    mutationFn: () => api.redispatchTask(task.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // Load messages and usage when expanded
  const { data: messages = [] } = useQuery({
    queryKey: ['task-messages', task.id],
    queryFn: () => api.getTaskMessages(task.id),
    enabled: expanded && showMessages,
    refetchInterval: task.status === 'running' ? 3000 : false,
  });
  const { data: usage = [] } = useQuery({
    queryKey: ['task-usage', task.id],
    queryFn: () => api.getTaskUsage(task.id),
    enabled: expanded,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ['task-reviews', task.id],
    queryFn: () => api.getTaskReviews(task.id),
    enabled: expanded,
  });

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    queued: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-800', label: t('taskStatus.queued') },
    running: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-900/30', label: t('taskStatus.running') },
    reviewing: { icon: RotateCw, color: 'text-purple-400', bg: 'bg-purple-900/30', label: t('taskStatus.reviewing') },
    completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/30', label: t('taskStatus.completed') },
    failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/30', label: t('taskStatus.failed') },
    cancelled: { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-800', label: t('taskStatus.cancelled') },
  };

  const cfg = statusConfig[task.status] || statusConfig.queued;
  const StatusIcon = cfg.icon;
  const deptInfo = DEPARTMENTS.find(d => d.id === task.departmentId);
  const totalTokens = usage.reduce((sum: number, u: any) => sum + (u.inputTokens || 0) + (u.outputTokens || 0), 0);

  // Parse output — try to extract result from JSON
  let displayOutput = task.output || '';
  try {
    const parsed = JSON.parse(displayOutput);
    if (parsed.result) displayOutput = parsed.result;
  } catch { /* not JSON */ }

  const msgTypeIcons: Record<string, string> = {
    progress: '🔄', tool_call: '🔧', tool_result: '📄', text: '💬', error: '❌',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors text-left">
        {expanded ? <ChevronDown size={14} className="text-gray-500 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />}
        <StatusIcon size={16} className={`${cfg.color} flex-shrink-0 ${task.status === 'running' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {deptInfo && <span className="text-xs text-blue-400">{deptInfo.emoji} {deptName(deptInfo.id)}</span>}
            {task.assignedTo && <span className="text-xs text-gray-500">→ {task.assignedTo}</span>}
            {task.sessionId && <span className="text-xs text-cyan-600" title="Session可续接">🔗</span>}
            {totalTokens > 0 && <span className="text-xs text-orange-400">{(totalTokens / 1000).toFixed(1)}k tok</span>}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
          {/* Input */}
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('tasks.instruction')}</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800/50 rounded-lg p-3">{task.input}</p>
          </div>

          {/* Output */}
          {displayOutput && (
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('tasks.result')}</p>
              <div className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-950 rounded-lg p-3 max-h-48 overflow-y-auto border border-gray-800 font-mono text-xs">
                {displayOutput}
              </div>
            </div>
          )}

          {/* Token usage bar */}
          {usage.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Coins size={12} className="text-orange-400" /> {t('tasks.tokenUsage')}</p>
              <div className="space-y-1">
                {usage.map((u: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-mono">{u.model}</span>
                    <div className="flex gap-3">
                      <span className="text-blue-400">In {u.inputTokens.toLocaleString()}</span>
                      <span className="text-green-400">Out {u.outputTokens.toLocaleString()}</span>
                      {u.cacheWriteTokens > 0 && <span className="text-gray-500">Cache {u.cacheWriteTokens.toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews (director feedback loop) */}
          {reviews.length > 0 && (
            <div className="bg-purple-900/10 border border-purple-800/30 rounded-lg p-3">
              <p className="text-xs text-purple-400 mb-2">{t('tasks.directorReview')} ({reviews.length} {t('tasks.rounds')})</p>
              {reviews.map((r: any, i: number) => (
                <div key={i} className="text-xs mb-1">
                  <span className={r.verdict === 'approved' ? 'text-green-400' : 'text-yellow-400'}>
                    R{r.round}: {r.verdict === 'approved' ? `✅ ${t('tasks.approved')}` : `🔄 ${t('tasks.revisionNeeded')}`}
                  </span>
                  {r.summary && <span className="text-gray-400 ml-2">{r.summary.substring(0, 100)}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Execution messages toggle */}
          <button onClick={() => setShowMessages(!showMessages)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300">
            <MessageSquare size={12} />
            {showMessages ? t('tasks.hideLog') : `${t('tasks.viewLog')} (${messages.length})`}
          </button>

          {showMessages && messages.length > 0 && (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              {messages.map((m: any) => (
                <div key={m.id} className="flex items-start gap-2 text-xs">
                  <span>{msgTypeIcons[m.type] || '📌'}</span>
                  <span className="text-gray-500 flex-shrink-0 w-6 text-right">#{m.seq}</span>
                  <span className="text-gray-300 whitespace-pre-wrap flex-1">
                    {m.tool && <span className="text-cyan-400">[{m.tool}] </span>}
                    {m.content || m.output || ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            {task.createdAt && <span>{t('tasks.created')}: {new Date(task.createdAt).toLocaleString()}</span>}
            {task.startedAt && <span>{t('tasks.started')}: {new Date(task.startedAt).toLocaleString()}</span>}
            {task.completedAt && <span>{t('tasks.completedAt')}: {new Date(task.completedAt).toLocaleString()}</span>}
            {task.sessionId && <span className="text-cyan-400">Session: {task.sessionId.substring(0, 8)}...</span>}
            {task.runtime && <span>Runtime: {task.runtime}</span>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {task.status === 'queued' && task.assignedTo && (
              <button onClick={() => executeTask.mutate()} disabled={executeTask.isPending}
                className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs hover:bg-green-600 disabled:opacity-50 flex items-center gap-1">
                <Play size={12} /> {executeTask.isPending ? t('tasks.executing') : t('tasks.execute')}
              </button>
            )}
            {(task.status === 'queued' || task.status === 'running') && (
              <button onClick={() => cancelTask.mutate()} disabled={cancelTask.isPending}
                className="px-3 py-1.5 bg-red-900/30 text-red-400 rounded-lg text-xs hover:bg-red-900/50 disabled:opacity-50 flex items-center gap-1">
                <X size={12} /> {cancelTask.isPending ? t('tasks.cancelling') : t('tasks.cancel')}
              </button>
            )}
            {(task.status === 'failed' || task.status === 'cancelled') && (
              <button onClick={() => retryTask.mutate()} disabled={retryTask.isPending}
                className="px-3 py-1.5 bg-orange-900/30 text-orange-400 rounded-lg text-xs hover:bg-orange-900/50 disabled:opacity-50 flex items-center gap-1">
                <RefreshCw size={12} /> {retryTask.isPending ? '...' : (lang === 'en' ? 'Retry' : '重试')}
              </button>
            )}
            {(task.status === 'failed' || task.status === 'cancelled') && task.departmentId && (
              <button onClick={() => redispatchTask.mutate()} disabled={redispatchTask.isPending}
                className="px-3 py-1.5 bg-blue-900/30 text-blue-400 rounded-lg text-xs hover:bg-blue-900/50 disabled:opacity-50 flex items-center gap-1">
                <Users size={12} /> {redispatchTask.isPending ? '...' : (lang === 'en' ? 'Redispatch to Dept' : '重新委派部门')}
              </button>
            )}
            {task.status === 'completed' && displayOutput && (
              <button onClick={() => setShowSaveSkill(!showSaveSkill)}
                className="px-3 py-1.5 bg-yellow-900/30 text-yellow-400 rounded-lg text-xs hover:bg-yellow-900/50 flex items-center gap-1">
                <Zap size={12} /> {lang === 'en' ? 'Save as Skill' : '保存为技能'}
              </button>
            )}
          </div>

          {/* Save as Skill form */}
          {showSaveSkill && <SaveAsSkillForm task={task} output={displayOutput} onDone={() => { setShowSaveSkill(false); queryClient.invalidateQueries({ queryKey: ['skills'] }); }} />}

          {/* Department task tree — show subtasks and director summary */}
          {task.departmentId && task.status === 'completed' && (
            <button onClick={() => setShowTree(!showTree)}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <Layers size={12} /> {showTree ? (lang === 'en' ? 'Hide delegation results' : '收起委派结果') : (lang === 'en' ? 'View delegation results' : '查看委派结果')}
            </button>
          )}
          {showTree && <TaskTreeView taskId={task.id} />}
        </div>
      )}
    </div>
  );
}

function CreateTaskForm({ onClose }: { onClose: () => void }) {
  const { t, deptName } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'department' | 'multi-dept' | 'agent'>('department');
  const [deptId, setDeptId] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [agentId, setAgentId] = useState('');
  const [runtime, setRuntime] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [status, setStatus] = useState('');

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-all-for-select'],
    queryFn: () => api.getAgents(),
  });

  const director = deptId
    ? agents.find((a: any) => a.departmentId === deptId && a.role === 'director')
    : null;

  const toggleDept = (id: string) => {
    const next = new Set(selectedDepts);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedDepts(next);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (mode === 'multi-dept' && selectedDepts.size > 0) {
        setStatus(t('tasks.dispatching'));
        const promises = Array.from(selectedDepts).map(dId => {
          const dn = deptName(dId);
          return api.submitDeptTask(dId, input, title || `${dn} Task`);
        });
        return Promise.all(promises);
      } else if (mode === 'department' && deptId) {
        return api.submitDeptTask(deptId, input, title || undefined);
      } else if (mode === 'agent' && agentId) {
        const agent = agents.find((a: any) => a.id === agentId);
        return api.createTask({
          title: title || 'Task',
          input,
          assignedTo: agentId,
          departmentId: agent?.departmentId,
          runtime: runtime || undefined,
          autoStart,
        });
      }
    },
    onSuccess: () => {
      setStatus('');
      onClose();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => { setStatus(`${t('common.error')}: ${err.message}`); },
  });

  const canSubmit = input.trim() && (
    (mode === 'department' && deptId) ||
    (mode === 'multi-dept' && selectedDepts.size > 0) ||
    (mode === 'agent' && agentId)
  ) && !create.isPending;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t('create.title')}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">{t('create.mode')}</label>
        <div className="flex gap-2">
          {[
            { key: 'department', label: `🏢 ${t('create.singleDept')}` },
            { key: 'multi-dept', label: `🏢🏢 ${t('create.multiDept')}` },
            { key: 'agent', label: `👤 ${t('create.specifyAgent')}` },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key as any)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${mode === m.key ? 'border-blue-600 bg-blue-600/20 text-blue-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'department' && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{t('create.selectDept')}</label>
          <select value={deptId} onChange={e => setDeptId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
            <option value="">-- {t('create.selectDept')} --</option>
            {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.emoji} {deptName(d.id)}</option>)}
          </select>
          {director && (
            <p className="text-xs text-green-400 mt-1">
              → {t('create.director')}: {director.emoji} {director.name} ({director.id})
            </p>
          )}
        </div>
      )}

      {mode === 'multi-dept' && (
        <div>
          <label className="text-xs text-gray-400 mb-2 block">{t('create.selectMulti')}</label>
          <div className="grid grid-cols-3 gap-2">
            {DEPARTMENTS.map(d => (
              <button key={d.id} onClick={() => toggleDept(d.id)}
                className={`px-2 py-1.5 rounded-lg text-xs border text-left transition-colors ${
                  selectedDepts.has(d.id) ? 'border-blue-600 bg-blue-600/20 text-blue-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>
                {d.emoji} {deptName(d.id)}
                {selectedDepts.has(d.id) && <span className="ml-1 text-blue-400">✓</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('create.selected')} {selectedDepts.size}</p>
        </div>
      )}

      {mode === 'agent' && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{t('create.selectAgent')}</label>
          <select value={agentId} onChange={e => setAgentId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
            <option value="">-- {t('create.selectAgent')} --</option>
            {agents.map((a: any) => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name} ({a.departmentId})</option>
            ))}
          </select>
        </div>
      )}

      <input type="text" placeholder={t('create.titlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm" />

      <textarea placeholder={t('create.inputPlaceholder')} value={input} onChange={e => setInput(e.target.value)} rows={4}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm resize-none" />

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Cpu size={12} /> {t('tasks.runtime')}
      </div>

      {mode !== 'multi-dept' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="autoStart" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} className="rounded" />
          <label htmlFor="autoStart" className="text-sm text-gray-300">{t('create.autoStart')}</label>
        </div>
      )}

      {status && <p className="text-xs text-yellow-400">{status}</p>}

      <button onClick={() => create.mutate()} disabled={!canSubmit}
        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        <Play size={14} />
        {create.isPending ? t('tasks.dispatching') :
         mode === 'multi-dept' ? t('create.submitDept').replace('{n}', String(selectedDepts.size)) :
         autoStart ? t('create.submitExecute') : t('create.submitCreate')}
      </button>
    </div>
  );
}

function TaskTreeView({ taskId }: { taskId: string }) {
  const { lang, agentName } = useI18n();
  const { data: tree, isLoading } = useQuery({
    queryKey: ['task-tree', taskId],
    queryFn: () => api.getTaskTree(taskId),
  });

  if (isLoading) return <p className="text-xs text-gray-500">Loading...</p>;
  if (!tree) return null;

  const statusIcons: Record<string, string> = {
    completed: '✅', failed: '❌', running: '🔄', queued: '⏳', reviewing: '🔍',
  };

  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 space-y-3">
      {/* Director summary */}
      {tree.summary && (
        <div className="bg-blue-900/10 border border-blue-800/20 rounded-lg p-3">
          <p className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
            <Users size={12} /> {lang === 'en' ? 'Director Summary' : '领导总结'}
          </p>
          <p className="text-xs text-gray-300 whitespace-pre-wrap">{tree.summary}</p>
        </div>
      )}

      {/* Reviews */}
      {tree.reviews?.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">{lang === 'en' ? `Review History (${tree.reviews.length} rounds)` : `审核记录 (${tree.reviews.length} 轮)`}</p>
          {tree.reviews.map((r: any, i: number) => (
            <div key={i} className="text-xs mb-1">
              <span className={r.verdict === 'approved' ? 'text-green-400' : 'text-yellow-400'}>
                R{r.round}: {r.verdict === 'approved' ? '✅ Approved' : '🔄 Revision'}
              </span>
              {r.summary && <span className="text-gray-400 ml-2">{r.summary.substring(0, 150)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Subtasks */}
      {tree.subtasks?.length > 0 ? (
        <div>
          <p className="text-xs text-gray-500 mb-2">{lang === 'en' ? `Delegated Subtasks (${tree.subtasks.length})` : `委派子任务 (${tree.subtasks.length})`}</p>
          <div className="space-y-2">
            {tree.subtasks.map((sub: any) => (
              <div key={sub.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{statusIcons[sub.status] || '⏳'}</span>
                    <span className="text-xs font-medium">{agentName(sub.agentName || sub.assignedTo)}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{sub.assignedTo}</span>
                </div>
                <p className="text-xs text-gray-400 mb-1">{sub.title}</p>
                {sub.resultPreview && (
                  <details>
                    <summary className="text-[10px] text-blue-400 cursor-pointer hover:text-blue-300">
                      {lang === 'en' ? 'View output' : '查看输出'} ({sub.resultPreview.length} chars)
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-950 rounded text-[10px] text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {sub.resultPreview}
                    </pre>
                  </details>
                )}
                {sub.usage?.length > 0 && (
                  <div className="text-[10px] text-gray-600 mt-1">
                    {sub.usage.map((u: any) => `${u.model}: ${u.inputTokens + u.outputTokens} tok`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600">{lang === 'en' ? 'No subtasks — director handled directly.' : '无子任务 — 领导直接处理。'}</p>
      )}

      {/* Total usage */}
      {tree.usage?.length > 0 && (
        <div className="text-[10px] text-gray-500 pt-2 border-t border-gray-800">
          {lang === 'en' ? 'Director usage: ' : '领导消耗: '}
          {tree.usage.map((u: any) => `${u.inputTokens + u.outputTokens} tok`).join(', ')}
        </div>
      )}
    </div>
  );
}

const SKILL_CATEGORIES = ['workflow', 'template', 'tool', 'knowledge', 'general'];
const DEPT_IDS = ['engineering','design','product','marketing','sales','paid-media','project-mgmt','qa','data-ai','infrastructure','game-dev','finance','legal','customer-service','support'];

function SaveAsSkillForm({ task, output, onDone }: { task: any; output: string; onDone: () => void }) {
  const { lang, deptName } = useI18n();
  const [name, setName] = useState(task.title || '');
  const [description, setDescription] = useState(task.input?.substring(0, 200) || '');
  const [content, setContent] = useState(output);
  const [category, setCategory] = useState<string>('general');
  const [assignDept, setAssignDept] = useState(task.departmentId || '');

  const createSkill = useMutation({
    mutationFn: async () => {
      const skill = await api.createSkill({ name, description, content, category, tags: [task.runtime || 'claude-code', task.departmentId].filter(Boolean) });
      if (assignDept) {
        await api.assignSkill(skill.id, { departmentId: assignDept });
      }
      return skill;
    },
    onSuccess: onDone,
  });

  return (
    <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-3 space-y-2">
      <p className="text-xs text-yellow-400 font-medium flex items-center gap-1"><Zap size={12} /> {lang === 'en' ? 'Save as Reusable Skill' : '保存为可复用技能'}</p>
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'en' ? 'Skill name' : '技能名称'}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs" />
      <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={lang === 'en' ? 'What does this skill do?' : '这个技能做什么？'}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs" />
      <div className="flex gap-2">
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs flex-1">
          {SKILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={assignDept} onChange={e => setAssignDept(e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs flex-1">
          <option value="">{lang === 'en' ? 'Assign to dept (optional)' : '分配给部门（可选）'}</option>
          {DEPT_IDS.map(d => <option key={d} value={d}>{deptName(d)}</option>)}
        </select>
      </div>
      <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs font-mono resize-y"
        placeholder={lang === 'en' ? 'Edit the skill content (refine the output into a reusable template)...' : '编辑技能内容（将输出精炼为可复用模板）...'} />
      <p className="text-[10px] text-gray-600">{lang === 'en' ? 'Tip: Edit the content above to extract the reusable pattern, not the raw output.' : '提示：编辑上方内容，提取可复用的模式，而不是原始输出。'}</p>
      <div className="flex gap-2">
        <button onClick={() => createSkill.mutate()} disabled={!name.trim() || !content.trim() || createSkill.isPending}
          className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs disabled:opacity-50 flex items-center gap-1">
          <Zap size={10} /> {createSkill.isPending ? '...' : (lang === 'en' ? 'Create Skill' : '创建技能')}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs">{lang === 'en' ? 'Cancel' : '取消'}</button>
      </div>
    </div>
  );
}
