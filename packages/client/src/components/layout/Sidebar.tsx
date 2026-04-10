import { NavLink } from 'react-router';
import { BarChart3, Gamepad2, Building2, Users, ClipboardList, Terminal, Settings, GitBranch, MessageCircle, Zap, Globe, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';

const links: Array<{ to: string; icon: typeof BarChart3; labelKey: TranslationKey }> = [
  { to: '/', icon: BarChart3, labelKey: 'nav.overview' },
  { to: '/office', icon: Gamepad2, labelKey: 'nav.office' },
  { to: '/departments', icon: Building2, labelKey: 'nav.departments' },
  { to: '/agents', icon: Users, labelKey: 'nav.agents' },
  { to: '/tasks', icon: ClipboardList, labelKey: 'nav.tasks' },
  { to: '/pipelines', icon: GitBranch, labelKey: 'nav.pipelines' },
  { to: '/meetings', icon: MessageCircle, labelKey: 'nav.meetings' },
  { to: '/skills', icon: Zap, labelKey: 'nav.skills' },
  { to: '/projects', icon: FolderOpen, labelKey: 'nav.projects' as any },
  { to: '/terminal', icon: Terminal, labelKey: 'nav.terminal' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Sidebar() {
  const { lang, setLang, t } = useI18n();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-gray-900 border-r border-gray-800 flex flex-col z-50">
      <div className="px-5 py-4 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight">{t('app.title')}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{t('app.subtitle')}</p>
      </div>
      <nav className="flex-1 py-3 px-3 space-y-1">
        {links.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              )
            }
          >
            <Icon size={18} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
      {/* Language Toggle */}
      <div className="px-3 pb-4">
        <button
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors border border-gray-800"
        >
          <Globe size={14} />
          {lang === 'en' ? 'EN / 中文' : '中文 / EN'}
        </button>
      </div>
    </aside>
  );
}
