import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useStatsStore } from '@/stores/use-stats';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { Users, Cpu, ClipboardList, Wrench, Coins, Zap } from 'lucide-react';
import { useI18n } from '@/i18n/context';

export default function Dashboard() {
  const { t, deptName } = useI18n();
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.getStats, refetchInterval: 5000 });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments });
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: () => api.getTasks() });
  const { data: skills } = useQuery({ queryKey: ['skills'], queryFn: () => api.getSkills() });
  const setStats = useStatsStore(s => s.setStats);

  useEffect(() => { if (stats) setStats(stats); }, [stats, setStats]);

  const totalTokens = (stats?.usage?.totalInputTokens || 0) + (stats?.usage?.totalOutputTokens || 0);

  const statCards = [
    { label: t('dash.totalAgents'), value: stats?.agents.total ?? '-', icon: Users, color: 'text-blue-400' },
    { label: t('dash.busy'), value: stats?.agents.busy ?? 0, icon: Cpu, color: 'text-green-400' },
    { label: t('dash.runningTasks'), value: stats?.tasks.running ?? 0, icon: ClipboardList, color: 'text-yellow-400' },
    { label: t('dash.runtimesAvail'), value: stats?.runtimes.available ?? 0, icon: Wrench, color: 'text-purple-400' },
    { label: t('dash.tokenUsage'), value: totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : '0', icon: Coins, color: 'text-orange-400' },
    { label: t('dash.skillsAccum'), value: skills?.length ?? 0, icon: Zap, color: 'text-cyan-400' },
  ];

  const recentTasks = (tasks || []).slice(0, 8);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('dash.title')}</h2>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {totalTokens > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><Coins size={14} className="text-orange-400" /> {t('dash.tokenUsage')}</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">{t('dash.inputTokens')}</p>
              <p className="text-lg font-mono text-blue-400">{(stats?.usage?.totalInputTokens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('dash.outputTokens')}</p>
              <p className="text-lg font-mono text-green-400">{(stats?.usage?.totalOutputTokens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('dash.trackedTasks')}</p>
              <p className="text-lg font-mono text-gray-300">{stats?.usage?.totalTasks || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium mb-3">{t('dash.deptOverview')}</h3>
        <div className="grid grid-cols-3 gap-4">
          {(departments || []).map((dept: any) => (
            <Link key={dept.id} to={`/departments/${dept.id}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{dept.emoji}</span>
                <span className="font-medium">{deptName(dept.id)}</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>{t('dash.members')}: {dept.stats?.totalAgents ?? 0}</p>
                <p>{t('dash.active')}: <span className="text-green-400">{dept.stats?.activeAgents ?? 0}</span> | {t('dash.busyLabel')}: <span className="text-yellow-400">{dept.stats?.busyAgents ?? 0}</span></p>
                <p>{t('dash.running')}: {dept.stats?.runningTasks ?? 0} | {t('dash.queued')}: {dept.stats?.queuedTasks ?? 0}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">{t('dash.recentTasks')}</h3>
        {recentTasks.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('dash.noTasks')}</p>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {recentTasks.map((task: any) => (
              <div key={task.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-gray-500">{task.assignedTo || t('dash.unassigned')}</p>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-gray-700 text-gray-300', running: 'bg-yellow-900 text-yellow-300',
    reviewing: 'bg-purple-900 text-purple-300', completed: 'bg-green-900 text-green-300',
    failed: 'bg-red-900 text-red-300', cancelled: 'bg-gray-800 text-gray-500',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${colors[status] || 'bg-gray-700'}`}>{status}</span>;
}
