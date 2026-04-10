import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useState } from 'react';
import { Search, Trash2, Zap, Plus, Edit3, Users, ChevronDown, ChevronRight, BookOpen, Wrench, Brain, FileText, Layers } from 'lucide-react';
import { useI18n } from '@/i18n/context';

const CATEGORIES = [
  { id: 'workflow', label: 'Workflow', icon: Layers, color: 'text-blue-400', bg: 'bg-blue-900/20' },
  { id: 'template', label: 'Template', icon: FileText, color: 'text-green-400', bg: 'bg-green-900/20' },
  { id: 'tool', label: 'Tool', icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-900/20' },
  { id: 'knowledge', label: 'Knowledge', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-900/20' },
  { id: 'general', label: 'General', icon: BookOpen, color: 'text-gray-400', bg: 'bg-gray-800' },
];

const DEPARTMENTS = [
  'engineering', 'design', 'product', 'marketing', 'sales', 'paid-media',
  'project-mgmt', 'qa', 'data-ai', 'infrastructure', 'game-dev',
  'finance', 'legal', 'customer-service', 'support',
];

export default function Skills() {
  const { t, deptName } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const params: Record<string, string> = {};
  if (search) params.q = search;
  else if (catFilter) params.category = catFilter;

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills', params],
    queryFn: () => api.getSkills(Object.keys(params).length ? params : undefined),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Zap size={20} className="text-yellow-400" /> {t('skills.title')}</h2>
          <p className="text-xs text-gray-500 mt-1">Curated capabilities assigned to agents. Injected into prompts at execution time.</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs flex items-center gap-1">
          <Plus size={14} /> New Skill
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCatFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${!catFilter ? 'border-blue-600 bg-blue-600/20 text-blue-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
          All ({skills.length})
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setCatFilter(cat.id); setSearch(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5 ${catFilter === cat.id ? 'border-blue-600 bg-blue-600/20 text-blue-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            <cat.icon size={12} /> {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="text" placeholder={t('skills.search')} value={search}
          onChange={e => { setSearch(e.target.value); setCatFilter(''); }}
          className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
      </div>

      {showCreate && <SkillEditor onDone={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['skills'] }); }} />}

      {isLoading ? <p className="text-gray-500">{t('common.loading')}</p> : (
        <div className="space-y-3">
          {skills.map((skill: any) => (
            editingId === skill.id
              ? <SkillEditor key={skill.id} skill={skill} onDone={() => { setEditingId(null); queryClient.invalidateQueries({ queryKey: ['skills'] }); }} />
              : <SkillCard key={skill.id} skill={skill} onEdit={() => setEditingId(skill.id)} />
          ))}
          {skills.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Zap size={32} className="mx-auto mb-3 text-gray-600" />
              <p>{t('skills.noSkills')}</p>
              <p className="text-xs mt-1">Create skills to give agents reusable capabilities.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkillCard({ skill, onEdit }: { skill: any; onEdit: () => void }) {
  const { deptName } = useI18n();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const cat = CATEGORIES.find(c => c.id === skill.category) || CATEGORIES[4];
  const CatIcon = cat.icon;

  const delSkill = useMutation({
    mutationFn: () => api.deleteSkill(skill.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  });

  const assignDept = useMutation({
    mutationFn: (deptId: string) => api.assignSkill(skill.id, { departmentId: deptId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['skills'] }); setShowAssign(false); },
  });

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden ${!skill.isActive ? 'opacity-50' : ''}`}>
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Category icon */}
        <div className={`p-2 rounded-lg ${cat.bg} flex-shrink-0 mt-0.5`}>
          <CatIcon size={16} className={cat.color} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{skill.name}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${cat.bg} ${cat.color}`}>{cat.label}</span>
            {!skill.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/20 text-red-400">Disabled</span>}
          </div>
          {skill.description && <p className="text-xs text-gray-400 mt-1">{skill.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
            <span>Used {skill.useCount}x</span>
            {skill.tags?.length > 0 && skill.tags.map((tag: string) => (
              <span key={tag} className="px-1.5 py-0.5 bg-gray-800 rounded">{tag}</span>
            ))}
            {skill.createdBy && <span>by {skill.createdBy}</span>}
            {skill.assignedAgents?.length > 0 && (
              <span className="flex items-center gap-1 text-blue-400">
                <Users size={10} /> {skill.assignedAgents.length} agents
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setShowAssign(!showAssign)} className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-blue-400" title="Assign to agents">
            <Users size={14} />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-yellow-400" title="Edit">
            <Edit3 size={14} />
          </button>
          <button onClick={() => delSkill.mutate()} className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-red-400" title="Delete">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded hover:bg-gray-800 text-gray-500">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* Assign panel */}
      {showAssign && (
        <div className="px-4 pb-3 border-t border-gray-800 pt-3">
          <p className="text-xs text-gray-500 mb-2">Assign to all agents in a department:</p>
          <div className="flex flex-wrap gap-1">
            {DEPARTMENTS.map(d => (
              <button key={d} onClick={() => assignDept.mutate(d)}
                className="px-2 py-1 text-[10px] bg-gray-800 rounded hover:bg-blue-900/30 hover:text-blue-400 text-gray-400">
                {deptName(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3">
          <pre className="p-3 bg-gray-950 rounded-lg text-xs text-gray-300 overflow-x-auto max-h-64 whitespace-pre-wrap font-mono border border-gray-800">
            {skill.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function SkillEditor({ skill, onDone }: { skill?: any; onDone: () => void }) {
  const [name, setName] = useState(skill?.name || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [content, setContent] = useState(skill?.content || '');
  const [category, setCategory] = useState(skill?.category || 'general');
  const [tags, setTags] = useState(skill?.tags?.join(', ') || '');

  const create = useMutation({
    mutationFn: () => skill
      ? api.updateSkill(skill.id, { name, description, content, category, tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean) })
      : api.createSkill({ name, description, content, category, tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean) }),
    onSuccess: onDone,
  });

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold">{skill ? 'Edit Skill' : 'Create New Skill'}</h3>

      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="Skill name (unique identifier)" value={name} onChange={e => setName(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <input type="text" placeholder="Short description — what this skill does" value={description} onChange={e => setDescription(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm" />

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Skill content (markdown — injected into agent's system prompt)</label>
        <textarea placeholder={`# Skill Name\n\n## When to use\nUse this skill when...\n\n## Steps\n1. First...\n2. Then...\n\n## Output format\nReturn results as...`}
          value={content} onChange={e => setContent(e.target.value)} rows={10}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono resize-y" />
      </div>

      <input type="text" placeholder="Tags (comma separated): react, frontend, testing" value={tags} onChange={e => setTags(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm" />

      <div className="flex gap-2">
        <button onClick={() => create.mutate()} disabled={!name.trim() || !content.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs disabled:opacity-50">
          {skill ? 'Save Changes' : 'Create Skill'}
        </button>
        <button onClick={onDone} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-xs">Cancel</button>
      </div>
    </div>
  );
}
