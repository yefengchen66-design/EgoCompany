import { useStatsStore } from '@/stores/use-stats';

export default function StatusBar() {
  const stats = useStatsStore(s => s.stats);
  if (!stats) return null;

  return (
    <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-5 text-xs text-gray-500 gap-6">
      <span>🟢 运行中任务: <span className="text-green-400">{stats.tasks.running ?? 0}</span></span>
      <span>👥 在线Agent: <span className="text-blue-400">{stats.agents.active}</span></span>
      <span>🔧 可用Runtime: <span className="text-yellow-400">{stats.runtimes.available}</span></span>
    </div>
  );
}
