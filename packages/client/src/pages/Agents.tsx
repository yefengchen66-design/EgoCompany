import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Link } from 'react-router';
import { useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n/context';

export default function Agents() {
  const { t, agentName, deptName } = useI18n();
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');

  const params: Record<string, string> = {};
  if (deptFilter) params.department = deptFilter;

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', params],
    queryFn: () => api.getAgents(Object.keys(params).length ? params : undefined),
  });

  const filtered = agents.filter((a: any) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search)
  );

  const DEPTS = ['engineering','design','product','marketing','sales','paid-media','project-mgmt','qa','data-ai','infrastructure','game-dev','finance','legal','customer-service','support'];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t('agents.title')}</h2>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder={t('agents.search')} value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-blue-600">
          <option value="">{t('agents.allDepts')}</option>
          {DEPTS.map(d => <option key={d} value={d}>{deptName(d)}</option>)}
        </select>
      </div>

      <p className="text-xs text-gray-500">{filtered.length} {t('agents.count')}</p>

      {isLoading ? <p className="text-gray-500">{t('common.loading')}</p> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr className="text-left text-gray-400 text-xs">
                <th className="px-4 py-2">{t('agents.agent')}</th>
                <th className="px-4 py-2">{t('agents.dept')}</th>
                <th className="px-4 py-2">{t('agents.role')}</th>
                <th className="px-4 py-2">{t('agents.status')}</th>
                <th className="px-4 py-2 text-right">{t('agents.assign')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((agent: any) => (
                <tr key={agent.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-2.5">
                    <Link to={`/agents/${agent.id}`} className="flex items-center gap-2 hover:text-blue-400">
                      <span>{agent.emoji}</span>
                      <div>
                        <span className="font-medium">{agentName(agent.name)}</span>
                        {agent.vibe && <p className="text-xs text-gray-500 mt-0.5 italic">{agent.vibe}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{deptName(agent.departmentId)}</td>
                  <td className="px-4 py-2.5">
                    <span className={agent.role === 'director' ? 'text-yellow-400 text-xs' : 'text-gray-500 text-xs'}>
                      {agent.role === 'director' ? t('agents.director') : t('agents.member')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><StatusDot status={agent.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <Link to={`/agents/${agent.id}`} className="px-2 py-1 rounded bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 text-xs flex items-center gap-1 ml-auto w-fit">
                      <ExternalLink size={12} /> {t('agents.assign')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const { t } = useI18n();
  const colors: Record<string, string> = {
    standby: 'bg-green-400', busy: 'bg-yellow-400', idle: 'bg-blue-400', offline: 'bg-gray-600',
  };
  const labelKey = `status.${status}` as any;
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-600'}`} />
      {t(labelKey)}
    </span>
  );
}
