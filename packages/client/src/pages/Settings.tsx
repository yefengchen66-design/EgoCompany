import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useI18n } from '@/i18n/context';

export default function Settings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: runtimes = [], isLoading } = useQuery({ queryKey: ['runtimes'], queryFn: api.getRuntimes });
  const detect = useMutation({
    mutationFn: api.detectRuntimes,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runtimes'] }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">{t('nav.settings')}</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">CLI Runtimes</h3>
          <button onClick={() => detect.mutate()} disabled={detect.isPending}
            className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 flex items-center gap-1 disabled:opacity-50">
            <RefreshCw size={14} className={detect.isPending ? 'animate-spin' : ''} /> Re-detect
          </button>
        </div>

        {isLoading ? <p className="text-gray-500 text-sm">{t('common.loading')}</p> : (
          <div className="space-y-3">
            {runtimes.map((rt: any) => (
              <div key={rt.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{rt.name}</p>
                  <p className="text-xs text-gray-500">Command: {rt.command} {rt.version ? `(${rt.version})` : ''}</p>
                  {rt.path && <p className="text-xs text-gray-600">{rt.path}</p>}
                </div>
                {rt.isAvailable ? (
                  <CheckCircle size={18} className="text-green-400" />
                ) : (
                  <XCircle size={18} className="text-gray-600" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-medium mb-2">About</h3>
        <p className="text-sm text-gray-400">EgoCompany v1.0.0</p>
        <p className="text-sm text-gray-500 mt-1">15 departments · 201 agents · Local CLI execution</p>
      </div>
    </div>
  );
}
