import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { api } from '@/api/client';
import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Save, Edit3, X } from 'lucide-react';
import { useI18n } from '@/i18n/context';

function MemorySection({ agentId }: { agentId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: memories = [] } = useQuery({
    queryKey: ['memories', agentId],
    queryFn: () => api.getAgentMemories(agentId),
  });
  const [newMemory, setNewMemory] = useState('');

  const addMem = useMutation({
    mutationFn: () => api.addAgentMemory(agentId, newMemory, [], 'manual'),
    onSuccess: () => { setNewMemory(''); queryClient.invalidateQueries({ queryKey: ['memories', agentId] }); },
  });

  const delMem = useMutation({
    mutationFn: (id: string) => api.deleteMemory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memories', agentId] }),
  });

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{t('agent.memory')} ({memories.length})</h3>

      {/* Add memory */}
      <div className="flex gap-2 mb-3">
        <input type="text" value={newMemory} onChange={e => setNewMemory(e.target.value)}
          placeholder={t('agent.addMemory')} onKeyDown={e => e.key === 'Enter' && newMemory.trim() && addMem.mutate()}
          className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-blue-600" />
        <button onClick={() => addMem.mutate()} disabled={!newMemory.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs disabled:opacity-50">{t('agent.save')}</button>
      </div>

      {/* Memory list */}
      <div className="space-y-1">
        {memories.length === 0 ? (
          <p className="text-gray-600 text-xs">{t('agent.noMemory')}</p>
        ) : memories.map((m: any) => (
          <div key={m.id} className="flex items-start gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 flex-shrink-0">{m.type === 'task-result' ? '[bot]' : '[pin]'}</span>
            <p className="text-xs text-gray-300 flex-1 whitespace-pre-wrap">{m.content}</p>
            <button onClick={() => delMem.mutate(m.id)} className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0">x</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, agentName, deptName } = useI18n();
  const queryClient = useQueryClient();
  const [taskInput, setTaskInput] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [configForm, setConfigForm] = useState<any>({});

  const { data: tasks = [] } = useQuery({
    queryKey: ['agent-tasks', id],
    queryFn: () => api.getTasks({ assigned_to: id! }),
    enabled: !!id,
  });

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id], queryFn: () => api.getAgent(id!), enabled: !!id,
  });

  useEffect(() => {
    if (agent) {
      setConfigForm({
        preferredRuntime: agent.preferredRuntime || '',
        customIdentity: agent.identity || '',
        customMission: agent.coreMission || '',
        customWorkflow: agent.workflow || '',
        customMetrics: agent.successMetrics || '',
        notes: agent.notes || '',
      });
    }
  }, [agent]);

  const saveConfig = useMutation({
    mutationFn: () => api.saveAgentConfig(id!, {
      preferredRuntime: configForm.preferredRuntime || null,
      customIdentity: configForm.customIdentity || null,
      customMission: configForm.customMission || null,
      customWorkflow: configForm.customWorkflow || null,
      customMetrics: configForm.customMetrics || null,
      notes: configForm.notes || null,
    }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
  });

  const createAndExecute = useMutation({
    mutationFn: async () => {
      const task = await api.createTask({
        title: taskTitle || t('tasks.newTask'),
        input: taskInput,
        assignedTo: id,
        departmentId: agent?.departmentId,
        autoStart: true,
      });
      return task;
    },
    onSuccess: () => {
      setTaskInput('');
      setTaskTitle('');
      queryClient.invalidateQueries({ queryKey: ['agent-tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
  });

  if (isLoading) return <p className="text-gray-500">{t('common.loading')}</p>;
  if (!agent) return <p className="text-red-400">{t('agent.notFound')}</p>;

  const statusColors: Record<string, string> = {
    online: 'text-green-400', busy: 'text-yellow-400', idle: 'text-blue-400', offline: 'text-gray-500',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/agents" className="text-gray-400 hover:text-gray-200"><ArrowLeft size={20} /></Link>
        <span className="text-3xl">{agent.emoji}</span>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{agentName(agent.name)}</h2>
          <p className="text-sm text-gray-500">{agent.id} · {deptName(agent.departmentId)} · {agent.role === 'director' ? t('agents.director') : t('agents.member')}</p>
          {agent.vibe && <p className="text-sm text-gray-400 italic mt-1">{agent.vibe}</p>}
          {agent.description && <p className="text-xs text-gray-500 mt-1">{agent.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs ${
            agent.status === 'busy' ? 'bg-yellow-900/30 text-yellow-400' :
            agent.status === 'idle' ? 'bg-blue-900/30 text-blue-400' :
            'bg-gray-800 text-gray-400'
          }`}>
            {agent.status === 'busy' ? `🔄 ${t('status.busy')}` : agent.status === 'idle' ? `✅ ${t('status.idle')}` : `⏸ ${t('status.standby')}`}
          </span>
        </div>
      </div>

      {/* Profile */}
      {agent.identity && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-blue-400 mb-2">📋 {t('agent.identity')}</h3>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{agent.identity}</p>
          </div>
          {agent.coreMission && (
            <div>
              <h3 className="text-sm font-medium text-green-400 mb-2">🎯 {t('agent.coreMission')}</h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{agent.coreMission}</p>
            </div>
          )}
          {agent.workflow && (
            <div>
              <h3 className="text-sm font-medium text-yellow-400 mb-2">🔄 {t('agent.workflow')}</h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{agent.workflow}</p>
            </div>
          )}
          {agent.successMetrics && (
            <div>
              <h3 className="text-sm font-medium text-purple-400 mb-2">📊 {t('agent.metrics')}</h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{agent.successMetrics}</p>
            </div>
          )}
          {agent.leadershipCapabilities && (
            <div>
              <h3 className="text-sm font-medium text-orange-400 mb-2">👑 {t('agent.leadership')}</h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{agent.leadershipCapabilities}</p>
            </div>
          )}
          {agent.delegationRules && (
            <div>
              <h3 className="text-sm font-medium text-cyan-400 mb-2">📌 {t('agent.delegation')}</h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{agent.delegationRules}</p>
            </div>
          )}
          {agent.subordinates && agent.subordinates.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-pink-400 mb-2">👥 Subordinates ({agent.subordinates.length})</h3>
              <div className="flex flex-wrap gap-1">
                {agent.subordinates.map((subId: string) => (
                  <Link key={subId} to={`/agents/${subId}`} className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 text-blue-400">{subId}</Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Config Editor */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Agent Config</h3>
          <button onClick={() => setEditing(!editing)}
            className="px-3 py-1 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center gap-1">
            {editing ? <><X size={12} /> {t('common.cancel')}</> : <><Edit3 size={12} /> Edit Config</>}
          </button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Preferred Runtime</label>
              <select value={configForm.preferredRuntime} onChange={e => setConfigForm({...configForm, preferredRuntime: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                <option value="">Auto</option>
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
                <option value="openclaw">OpenClaw</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('agent.identity')} <span className="text-gray-600">(leave empty for default)</span></label>
              <textarea value={configForm.customIdentity} onChange={e => setConfigForm({...configForm, customIdentity: e.target.value})}
                placeholder={agent.defaultIdentity || ''} rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('agent.coreMission')}</label>
              <textarea value={configForm.customMission} onChange={e => setConfigForm({...configForm, customMission: e.target.value})}
                placeholder={agent.defaultMission || ''} rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('agent.workflow')}</label>
              <textarea value={configForm.customWorkflow} onChange={e => setConfigForm({...configForm, customWorkflow: e.target.value})}
                placeholder={agent.defaultWorkflow || ''} rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('agent.metrics')}</label>
              <textarea value={configForm.customMetrics} onChange={e => setConfigForm({...configForm, customMetrics: e.target.value})}
                placeholder={agent.defaultMetrics || ''} rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <textarea value={configForm.notes} onChange={e => setConfigForm({...configForm, notes: e.target.value})}
                placeholder="Add notes..." rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm resize-none" />
            </div>
            <button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              <Save size={14} /> {saveConfig.isPending ? `${t('common.save')}...` : t('common.save')}
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Preferred Runtime:</span>
              <span className="text-gray-300">{agent.preferredRuntime || 'Auto'}</span>
            </div>
            {agent.notes && (
              <div>
                <span className="text-gray-500">Notes:</span>
                <p className="text-gray-300 mt-1">{agent.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meta Info */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Runtimes</p>
          <p>{(agent.runtimes || []).join(', ') || 'None'}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Max Concurrent</p>
          <p>{agent.maxConcurrentTasks}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Definition File</p>
          <p className="text-xs truncate">{agent.definitionPath}</p>
        </div>
      </div>

      {/* Task Input — always available, agent auto-activates when task is assigned */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">{t('agents.assign')}</h3>
          <input
            type="text" placeholder={t('create.titlePlaceholder')} value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-600"
          />
          <textarea
            placeholder={t('create.inputPlaceholder')} value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-600 resize-none"
          />
          <button
            onClick={() => createAndExecute.mutate()}
            disabled={!taskInput.trim() || createAndExecute.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Play size={14} /> {createAndExecute.isPending ? t('tasks.executing') : t('create.submitExecute')}
          </button>
        </div>

      {/* Task History */}
      <div>
        <h3 className="text-sm font-medium mb-2">Task History ({tasks.length})</h3>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-gray-600 text-sm">{t('tasks.noTasks')}</p>
          ) : tasks.map((task: any) => (
            <div key={task.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm">{task.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">{task.input}</p>
              </div>
              <TaskBadge status={task.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Memories */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <MemorySection agentId={id!} />
      </div>
    </div>
  );
}

function TaskBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-gray-700 text-gray-300', running: 'bg-yellow-900 text-yellow-300',
    completed: 'bg-green-900 text-green-300', failed: 'bg-red-900 text-red-300',
    cancelled: 'bg-gray-800 text-gray-500',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${colors[status] || 'bg-gray-700'}`}>{status}</span>;
}
