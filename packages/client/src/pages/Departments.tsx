import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Link } from 'react-router';
import { useI18n } from '@/i18n/context';

// Brief English descriptions for each department (shown on cards)
const DEPT_BRIEFS: Record<string, string> = {
  engineering: 'Frontend, backend, mobile, embedded, XR, blockchain, and platform engineering.',
  design: 'UI/UX design, brand identity, accessibility, and visual storytelling.',
  product: 'Product strategy, user research, sprint planning, and market analysis.',
  marketing: 'Content, SEO, social media, video, and platform-specific marketing (global + China).',
  sales: 'Outbound prospecting, deal strategy, pipeline management, and enterprise sales.',
  'paid-media': 'PPC, paid social, programmatic buying, tracking, and attribution.',
  'project-mgmt': 'Project delivery, workflow design, experiment tracking, and studio operations.',
  qa: 'Code review, API testing, security auditing, and performance benchmarking.',
  'data-ai': 'ML engineering, data pipelines, analytics, and AI agent orchestration.',
  infrastructure: 'DevOps, SRE, security compliance, and incident response.',
  'game-dev': 'Unity, Unreal, Godot, Roblox, Blender — game design, art, audio, multiplayer.',
  finance: 'Accounting, financial analysis, tax strategy, and investment research.',
  legal: 'Regulatory compliance, contract review, and healthcare regulations.',
  'customer-service': 'Multi-industry support: retail, healthcare, hospitality, financial services.',
  support: 'HR, training, documentation, research, commerce consulting, and operations.',
};

const DEPT_BRIEFS_ZH: Record<string, string> = {
  engineering: '28名工程师 — 前端/后端/移动端/嵌入式/XR/区块链/MCP全栈开发',
  design: '8名设计师 — UI/UX设计、品牌守护、无障碍审计、视觉叙事',
  product: '8名产品专家 — 产品策略、用户研究、冲刺规划、趋势分析',
  marketing: '27名营销专家 — 抖音/小红书/B站/TikTok/Instagram全平台覆盖',
  sales: '12名销售专家 — 外呼、交易策略、管道分析、政企售前',
  'paid-media': '7名投放专家 — PPC/社交广告/程序化购买/追踪归因',
  'project-mgmt': '9名项目专家 — 项目交付、流程设计、实验追踪、Jira管理',
  qa: '8名质量专家 — 代码审查、API测试、安全审计、区块链审计',
  'data-ai': '13名数据AI专家 — ML工程、数据管道、分析、Agent编排',
  infrastructure: '8名运维专家 — DevOps、SRE、安全合规、事件响应',
  'game-dev': '20名游戏开发者 — Unity/Unreal/Godot/Roblox/Blender全引擎',
  finance: '7名财务专家 — 会计、财务分析、税务策略、投资研究',
  legal: '5名法务专家 — 合规审查、合同管理、医疗法规',
  'customer-service': '7名客服专家 — 零售/医疗/酒店/金融多行业覆盖',
  support: '19名支持专家 — HR、培训、文档、研究、跨境电商咨询',
};

export default function Departments() {
  const { t, deptName, lang } = useI18n();
  const { data: departments, isLoading } = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments });

  if (isLoading) return <p className="text-gray-500">{t('common.loading')}</p>;

  const briefs = lang === 'en' ? DEPT_BRIEFS : DEPT_BRIEFS_ZH;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('nav.departments')}</h2>
        <p className="text-xs text-gray-500 mt-1">{lang === 'en' ? '15 departments, 201 agents. Click a department to view details and assign tasks.' : '15个部门，201位员工。点击部门查看详情和分配任务。'}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(departments || []).map((dept: any) => (
          <Link
            key={dept.id}
            to={`/departments/${dept.id}`}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{dept.emoji}</span>
              <div>
                <h3 className="font-semibold group-hover:text-blue-400 transition-colors">{deptName(dept.id)}</h3>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">{briefs[dept.id] || ''}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div className="bg-gray-800/50 rounded px-2 py-1.5">
                <p className="text-gray-500">{t('dash.members')}</p>
                <p className="text-lg font-bold text-gray-200">{dept.stats?.totalAgents ?? 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded px-2 py-1.5">
                <p className="text-gray-500">{t('dash.active')}</p>
                <p className="text-lg font-bold text-green-400">{dept.stats?.activeAgents ?? 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded px-2 py-1.5">
                <p className="text-gray-500">{t('dash.running')}</p>
                <p className="text-lg font-bold text-yellow-400">{dept.stats?.runningTasks ?? 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded px-2 py-1.5">
                <p className="text-gray-500">{t('dash.queued')}</p>
                <p className="text-lg font-bold text-gray-200">{dept.stats?.queuedTasks ?? 0}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
