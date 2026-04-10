import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useState } from 'react';
import { MessageCircle, Plus, X, Loader2, CheckCircle, Users, Play } from 'lucide-react';
import { useI18n } from '@/i18n/context';

const DEPT_DIRECTORS = [
  { id: 'engineering', directorId: 'eng-000', emoji: '⚙️' },
  { id: 'design', directorId: 'des-000', emoji: '🎨' },
  { id: 'product', directorId: 'prd-000', emoji: '📦' },
  { id: 'marketing', directorId: 'mkt-000', emoji: '📢' },
  { id: 'sales', directorId: 'sal-000', emoji: '💰' },
  { id: 'paid-media', directorId: 'pmd-000', emoji: '📊' },
  { id: 'project-mgmt', directorId: 'pmg-000', emoji: '📋' },
  { id: 'qa', directorId: 'qa-000', emoji: '🔍' },
  { id: 'data-ai', directorId: 'dai-000', emoji: '🤖' },
  { id: 'infrastructure', directorId: 'inf-000', emoji: '🏗️' },
  { id: 'game-dev', directorId: 'gam-000', emoji: '🎮' },
  { id: 'finance', directorId: 'fin-000', emoji: '💵' },
  { id: 'legal', directorId: 'leg-000', emoji: '⚖️' },
  { id: 'customer-service', directorId: 'csr-000', emoji: '🎧' },
  { id: 'support', directorId: 'sup-000', emoji: '🤝' },
];

export default function Meetings() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: meetings = [] } = useQuery({ queryKey: ['meetings'], queryFn: api.getMeetings, refetchInterval: 5000 });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2"><MessageCircle size={20} /> {t('nav.meetings')}</h2>
        <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">
          <Plus size={14} /> {lang === 'en' ? 'New Meeting' : '发起会议'}
        </button>
      </div>

      {showCreate && <CreateMeetingForm onClose={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['meetings'] }); }} />}

      <div className="space-y-4">
        {meetings.length === 0 ? (
          <p className="text-gray-500 text-sm">{lang === 'en' ? 'No meetings yet' : '暂无会议记录'}</p>
        ) : meetings.map((meeting: any) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </div>
  );
}

function CreateMeetingForm({ onClose }: { onClose: () => void }) {
  const { deptName, lang } = useI18n();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (directorId: string) => {
    const next = new Set(selected);
    if (next.has(directorId)) next.delete(directorId); else next.add(directorId);
    setSelected(next);
  };

  const create = useMutation({
    mutationFn: () => api.createMeeting({
      title: title || (lang === 'en' ? 'Cross-Department Meeting' : '跨部门会议'),
      topic,
      participantIds: Array.from(selected),
    }),
    onSuccess: () => onClose(),
  });

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{lang === 'en' ? 'New Cross-Department Meeting' : '发起跨部门会议'}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
      </div>

      <input type="text" placeholder={lang === 'en' ? 'Meeting title (optional)' : '会议标题（可选）'} value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm" />

      <textarea placeholder={lang === 'en' ? 'Meeting topic...' : '会议议题...'} value={topic} onChange={e => setTopic(e.target.value)} rows={3}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm resize-none" />

      <div>
        <label className="text-xs text-gray-400 mb-2 block">{lang === 'en' ? 'Select department directors' : '选择参会部门领导'}</label>
        <div className="grid grid-cols-3 gap-2">
          {DEPT_DIRECTORS.map(d => (
            <button key={d.directorId} onClick={() => toggle(d.directorId)}
              className={`px-3 py-2 rounded-lg text-sm border text-left transition-colors ${selected.has(d.directorId) ? 'border-blue-600 bg-blue-600/20 text-blue-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              <span className="mr-1">{d.emoji}</span>{deptName(d.id)}
              {selected.has(d.directorId) && <span className="ml-1 text-blue-400">✓</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">{selected.size} {lang === 'en' ? 'directors selected' : '位部门领导已选'}</p>
      </div>

      <button onClick={() => create.mutate()} disabled={!topic.trim() || selected.size < 2 || create.isPending}
        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
        <Users size={14} /> {create.isPending ? (lang === 'en' ? 'Creating...' : '创建中...') : (lang === 'en' ? `Start Meeting (${selected.size})` : `开始会议 (${selected.size}人)`)}
      </button>
      {selected.size < 2 && topic.trim() && <p className="text-xs text-yellow-400">{lang === 'en' ? 'Select at least 2 directors' : '请至少选择2位部门领导'}</p>}
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: any }) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(meeting.status === 'in_progress');
  const [followup, setFollowup] = useState('');

  const sendFollowup = useMutation({
    mutationFn: () => api.meetingFollowup(meeting.id, followup),
    onSuccess: () => { setFollowup(''); queryClient.invalidateQueries({ queryKey: ['meetings'] }); },
  });

  const dispatch = useMutation({
    mutationFn: () => api.dispatchMeetingWork(meeting.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });

  const [synthAgent, setSynthAgent] = useState('pmg-009');
  const synthesize = useMutation({
    mutationFn: () => api.synthesizeMeeting(meeting.id, synthAgent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });

  const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
    pending: { color: 'text-gray-400', label: lang === 'en' ? 'Pending' : '等待中', icon: Loader2 },
    in_progress: { color: 'text-yellow-400', label: lang === 'en' ? 'In Progress' : '进行中', icon: Loader2 },
    completed: { color: 'text-green-400', label: lang === 'en' ? 'Completed' : '已完成', icon: CheckCircle },
    failed: { color: 'text-red-400', label: lang === 'en' ? 'Failed' : '失败', icon: X },
  };

  const cfg = statusConfig[meeting.status] || statusConfig.pending;
  const Icon = cfg.icon;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors text-left">
        <div>
          <p className="font-medium">{meeting.title}</p>
          <p className="text-sm text-gray-400 mt-0.5">{meeting.topic}</p>
          <p className="text-xs text-gray-500 mt-1">
            {meeting.participantIds.length} {lang === 'en' ? 'participants' : '位参会者'} · {new Date(meeting.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Icon size={16} className={`${cfg.color} ${meeting.status === 'in_progress' ? 'animate-spin' : ''}`} />
          <span className={`text-sm ${cfg.color}`}>{cfg.label}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
          <div className="space-y-3">
            {(meeting.messages || []).length === 0 ? (
              <p className="text-gray-500 text-sm">{meeting.status === 'in_progress' ? (lang === 'en' ? 'Meeting in progress, waiting for responses...' : '会议进行中，等待发言...') : (lang === 'en' ? 'No messages yet' : '暂无发言记录')}</p>
            ) : (meeting.messages || []).map((msg: any, i: number) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm text-blue-400">{msg.agentName}</span>
                  <span className="text-xs text-gray-500">{msg.agentId}</span>
                  <span className="text-xs text-gray-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>

          {meeting.status === 'in_progress' && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <Loader2 size={14} className="animate-spin" />
              {(meeting.messages || []).length}/{meeting.participantIds.length} {lang === 'en' ? 'responses' : '位已发言'}
            </div>
          )}

          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
            <input type="text" value={followup} onChange={e => setFollowup(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && followup.trim() && sendFollowup.mutate()}
              placeholder={lang === 'en' ? 'Follow-up question...' : '追问或补充指示...'}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm" />
            <button onClick={() => sendFollowup.mutate()} disabled={!followup.trim() || sendFollowup.isPending}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {sendFollowup.isPending ? (lang === 'en' ? 'Sending...' : '发送中...') : (lang === 'en' ? 'Send' : '发送')}
            </button>
          </div>

          {meeting.status === 'completed' && (
            <div className="space-y-2">
              <button onClick={() => dispatch.mutate()} disabled={dispatch.isPending}
                className="w-full px-3 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1">
                <Play size={14} /> {dispatch.isPending ? (lang === 'en' ? 'Dispatching...' : '派发中...') : (lang === 'en' ? 'Step 1: Dispatch Tasks to Departments' : '第1步：各部门开始执行')}
              </button>

              {/* Synthesize button */}
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-400">{lang === 'en' ? 'Step 2: After departments complete, synthesize results into a unified report:' : '第2步：各部门完成后，汇总为统一项目报告：'}</p>
                <div className="flex gap-2">
                  <select value={synthAgent} onChange={e => setSynthAgent(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs">
                    <optgroup label={lang === 'en' ? 'Recommended' : '推荐'}>
                      <option value="pmg-009">Chief of Staff (pmg-009)</option>
                      <option value="pmg-001">Senior Project Manager (pmg-001)</option>
                      <option value="pmg-002">Project Shepherd (pmg-002)</option>
                    </optgroup>
                    <optgroup label={lang === 'en' ? 'Other Options' : '其他选项'}>
                      <option value="pmg-003">Studio Producer (pmg-003)</option>
                      <option value="sup-038">Executive Summary Generator</option>
                      <option value="prd-001">Product Manager (prd-001)</option>
                    </optgroup>
                  </select>
                  <button onClick={() => synthesize.mutate()} disabled={synthesize.isPending}
                    className="px-3 py-1.5 bg-purple-700 text-white rounded text-xs hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap">
                    {synthesize.isPending ? '...' : (lang === 'en' ? 'Synthesize Report' : '生成汇总报告')}
                  </button>
                </div>
                {synthesize.isSuccess && (
                  <p className="text-xs text-green-400">{lang === 'en' ? 'Report task created! Check Tasks page.' : '报告任务已创建！查看任务页面。'}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
