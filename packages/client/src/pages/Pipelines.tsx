import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useState } from 'react';
import { Play, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, Loader2, GitBranch, Plus, X, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/context';

const DEPT_IDS = [
  'engineering', 'design', 'product', 'marketing', 'sales', 'paid-media',
  'project-mgmt', 'qa', 'data-ai', 'infrastructure', 'game-dev',
  'finance', 'legal', 'customer-service', 'support',
];

export default function Pipelines() {
  const { t, deptName, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: pipelines = [] } = useQuery({ queryKey: ['pipelines'], queryFn: api.getPipelines });
  const { data: runs = [] } = useQuery({ queryKey: ['pipeline-runs'], queryFn: api.getPipelineRuns, refetchInterval: 5000 });

  const startPipeline = useMutation({
    mutationFn: (id: string) => api.startPipeline(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2"><GitBranch size={20} /> {t('nav.pipelines')}</h2>

      <QuickPipelineForm onCreated={() => queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] })} />

      <div>
        <h3 className="text-lg font-medium mb-3">{lang === 'en' ? 'Available Pipelines' : '可用流水线'}</h3>
        <div className="grid grid-cols-3 gap-4">
          {pipelines.map((p: any) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div>
                <h4 className="font-medium">{p.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
              </div>
              <div className="text-xs text-gray-400">
                {p.stages.length} {lang === 'en' ? 'stages' : '个阶段'}:
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.stages.map((s: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">{s.displayName}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => startPipeline.mutate(p.id)} disabled={startPipeline.isPending}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                <Play size={14} /> {startPipeline.isPending ? (lang === 'en' ? 'Starting...' : '启动中...') : (lang === 'en' ? 'Run Pipeline' : '启动流水线')}
              </button>
            </div>
          ))}
          {pipelines.length === 0 && <p className="text-gray-500 text-sm col-span-3">{lang === 'en' ? 'No pipeline definitions available' : '无可用流水线定义'}</p>}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">{lang === 'en' ? 'Run History' : '执行历史'}</h3>
        <div className="space-y-3">
          {runs.length === 0 ? (
            <p className="text-gray-500 text-sm">{lang === 'en' ? 'No runs yet' : '暂无执行记录'}</p>
          ) : runs.map((run: any) => (
            <PipelineRunCard key={run.id} run={run} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickPipelineForm({ onCreated }: { onCreated: () => void }) {
  const { deptName, lang } = useI18n();
  const queryClient = useQueryClient();
  const [deptOrder, setDeptOrder] = useState<string[]>([]);
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);

  const addDept = (id: string) => { if (!deptOrder.includes(id)) setDeptOrder(prev => [...prev, id]); };
  const removeDept = (id: string) => setDeptOrder(prev => prev.filter(d => d !== id));

  const run = useMutation({
    mutationFn: async () => {
      setStatus(lang === 'en' ? 'Dispatching sequentially...' : '正在串行派发任务...');
      for (let i = 0; i < deptOrder.length; i++) {
        const deptId = deptOrder[i];
        await api.submitDeptTask(deptId, instruction, `Pipeline Stage ${i + 1}: ${deptName(deptId)}`);
        setStatus(lang === 'en' ? `Dispatched ${i + 1}/${deptOrder.length} stages...` : `已派发 ${i + 1}/${deptOrder.length} 个阶段...`);
      }
    },
    onSuccess: () => { setStatus(''); setDeptOrder([]); setInstruction(''); setOpen(false); onCreated(); queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
    onError: (err: any) => setStatus(`Error: ${err.message}`),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
        <Plus size={14} /> {lang === 'en' ? 'Quick Pipeline' : '创建快速流水线'}
      </button>
    );
  }

  return (
    <div className="bg-gray-900 border border-blue-900/50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2"><GitBranch size={16} /> {lang === 'en' ? 'Quick Pipeline' : '快速流水线'}</h3>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
      </div>

      <p className="text-xs text-gray-500">{lang === 'en'
        ? 'Select departments in order. The instruction will be dispatched sequentially to each department director.'
        : '按顺序选择部门，系统将串行地将指令派发给每个部门的领导。'}</p>

      <div>
        <label className="text-xs text-gray-400 mb-2 block">{lang === 'en' ? 'Select department order (click to add)' : '选择部门顺序（点击添加）'}</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {DEPT_IDS.map(id => (
            <button key={id} onClick={() => addDept(id)} disabled={deptOrder.includes(id)}
              className={`px-2 py-1 rounded text-xs border transition-colors ${deptOrder.includes(id) ? 'border-blue-600 bg-blue-600/20 text-blue-400 opacity-50 cursor-not-allowed' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {deptName(id)}
            </button>
          ))}
        </div>

        {deptOrder.length > 0 && (
          <div className="flex items-center flex-wrap gap-1">
            {deptOrder.map((id, i) => (
              <span key={id} className="flex items-center gap-1">
                {i > 0 && <ArrowRight size={12} className="text-gray-600" />}
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 border border-blue-800 rounded text-xs text-blue-300">
                  {deptName(id)}
                  <button onClick={() => removeDept(id)} className="ml-1 text-gray-500 hover:text-red-400"><X size={10} /></button>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <textarea placeholder={lang === 'en' ? 'Task instruction (sent to each department)...' : '输入任务指令（每个部门将收到相同的指令）...'}
        value={instruction} onChange={e => setInstruction(e.target.value)} rows={3}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-600 resize-none" />

      {status && <p className="text-xs text-yellow-400">{status}</p>}

      <button onClick={() => run.mutate()} disabled={deptOrder.length === 0 || !instruction.trim() || run.isPending}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        <Play size={14} /> {run.isPending ? (lang === 'en' ? 'Dispatching...' : '派发中...') : (lang === 'en' ? `Run ${deptOrder.length} stages sequentially` : `串行执行 ${deptOrder.length} 个阶段`)}
      </button>
    </div>
  );
}

function PipelineRunCard({ run }: { run: any }) {
  const { lang } = useI18n();
  const [expanded, setExpanded] = useState(run.status === 'running');

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: 'text-gray-400', label: lang === 'en' ? 'Pending' : '等待中' },
    running: { icon: Loader2, color: 'text-yellow-400', label: lang === 'en' ? 'Running' : '执行中' },
    completed: { icon: CheckCircle, color: 'text-green-400', label: lang === 'en' ? 'Completed' : '已完成' },
    failed: { icon: XCircle, color: 'text-red-400', label: lang === 'en' ? 'Failed' : '失败' },
    cancelled: { icon: XCircle, color: 'text-gray-500', label: lang === 'en' ? 'Cancelled' : '已取消' },
  };

  const stageStatusColors: Record<string, string> = {
    pending: 'bg-gray-700', running: 'bg-yellow-600 animate-pulse', completed: 'bg-green-600', failed: 'bg-red-600', skipped: 'bg-gray-800',
  };

  const cfg = statusConfig[run.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
          <StatusIcon size={16} className={`${cfg.color} ${run.status === 'running' ? 'animate-spin' : ''}`} />
          <div className="text-left">
            <p className="text-sm font-medium">{run.pipelineName}</p>
            <p className="text-xs text-gray-500">{run.id} · {new Date(run.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3">
          <div className="flex gap-1 mb-3">
            {(run.stages || []).map((stage: any, i: number) => (
              <div key={i} className="flex-1">
                <div className={`h-2 rounded-full ${stageStatusColors[stage.status] || 'bg-gray-700'}`} />
                <p className="text-xs text-gray-500 mt-1 text-center truncate">{stage.displayName}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {(run.stages || []).map((stage: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stageStatusColors[stage.status]}`} />
                  <span>{stage.displayName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{stage.taskIds?.length ?? 0} {lang === 'en' ? 'tasks' : '任务'}</span>
                  <span className={`${statusConfig[stage.status]?.color || 'text-gray-500'}`}>
                    {statusConfig[stage.status]?.label || stage.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
