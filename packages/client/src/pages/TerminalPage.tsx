import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useTerminalStore } from '@/stores/use-terminal';
import { sendCommand } from '@/api/ws';
import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, Clock } from 'lucide-react';

export default function TerminalPage() {
  const { data: sessions = [] } = useQuery({ queryKey: ['terminals'], queryFn: api.getTerminals, refetchInterval: 3000 });
  const { data: recentTasks = [] } = useQuery({
    queryKey: ['recent-tasks-output'],
    queryFn: () => api.getTasks({ limit: '10' } as any),
    refetchInterval: 5000,
  });
  const outputs = useTerminalStore(s => s.outputs);
  const activeSessionId = useTerminalStore(s => s.activeSessionId);
  const setActiveSession = useTerminalStore(s => s.setActiveSession);
  const [inputText, setInputText] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const activeOutput = activeSessionId ? (outputs.get(activeSessionId) || []) : [];

  // Tasks with output for the "recent output" section
  const tasksWithOutput = (recentTasks as any[]).filter((t: any) => t.output).slice(0, 10);
  const selectedTask = selectedTaskId ? tasksWithOutput.find((t: any) => t.id === selectedTaskId) : null;

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeOutput, selectedTask]);

  // Auto-select first session
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, [sessions, activeSessionId, setActiveSession]);

  const handleSend = () => {
    if (!activeSessionId || !inputText.trim()) return;
    sendCommand({ type: 'terminal:input', data: { sessionId: activeSessionId, input: inputText + '\n' } });
    setInputText('');
  };

  const displayOutput = selectedTaskId
    ? (selectedTask?.output || '无输出')
    : activeOutput.join('');

  const isLiveSession = !selectedTaskId && !!activeSessionId;

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)]">
      <h2 className="text-xl font-semibold flex items-center gap-2"><TerminalIcon size={20} /> 终端</h2>

      <div className="flex h-full gap-4">
        {/* Session list */}
        <div className="w-60 bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col overflow-hidden">
          {/* Live sessions */}
          <p className="text-xs text-gray-500 mb-2 flex-shrink-0">活跃会话 ({sessions.length})</p>
          {sessions.length === 0 && <p className="text-xs text-gray-600">无活跃会话</p>}
          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => { setActiveSession(s.id); setSelectedTaskId(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors mb-1 ${
                !selectedTaskId && activeSessionId === s.id ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <p className="font-medium truncate">{s.agentId}</p>
              <p className="text-gray-500 truncate">{s.id}</p>
            </button>
          ))}

          {/* Recent task outputs */}
          {tasksWithOutput.length > 0 && (
            <>
              <div className="border-t border-gray-800 my-2 flex-shrink-0" />
              <p className="text-xs text-gray-500 mb-2 flex-shrink-0 flex items-center gap-1">
                <Clock size={10} /> 最近任务输出 ({tasksWithOutput.length})
              </p>
              <div className="flex-1 overflow-y-auto space-y-1">
                {tasksWithOutput.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTaskId(t.id); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedTaskId === t.id ? 'bg-green-900/20 text-green-400' : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-gray-500 truncate">{t.assignedTo || '未分配'}</p>
                    <span className={`text-[10px] px-1 py-0.5 rounded ${
                      t.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                      t.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                      'bg-gray-800 text-gray-500'
                    }`}>{t.status}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Terminal output */}
        <div className="flex-1 flex flex-col bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
          {selectedTask && (
            <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-400">{selectedTask.title} — {selectedTask.assignedTo}</span>
              <button onClick={() => setSelectedTaskId(null)} className="text-xs text-gray-500 hover:text-gray-300">切换到实时</button>
            </div>
          )}
          <div
            ref={outputRef}
            className="flex-1 p-4 overflow-y-auto font-mono text-xs text-green-400 whitespace-pre-wrap leading-relaxed"
          >
            {!displayOutput ? (
              <p className="text-gray-600">{selectedTaskId ? '无输出内容' : '等待输出...'}</p>
            ) : (
              displayOutput
            )}
          </div>

          {/* Input (only for live sessions) */}
          {isLiveSession && (
            <div className="border-t border-gray-800 p-3 flex gap-2">
              <input
                type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={activeSessionId ? '输入命令...' : '无活跃会话'}
                disabled={!activeSessionId}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-600 disabled:opacity-50"
              />
              <button onClick={handleSend} disabled={!activeSessionId}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Send size={14} />
              </button>
            </div>
          )}
          {selectedTaskId && (
            <div className="border-t border-gray-800 p-2 text-center">
              <span className="text-xs text-gray-600">已完成任务的输出 — 只读</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
