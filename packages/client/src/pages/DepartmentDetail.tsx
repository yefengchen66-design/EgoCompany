import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { api } from '@/api/client';
import { ArrowLeft, Power, PowerOff, MessageCircle, Zap, Info, Send, ArrowRightLeft, Check, X as XIcon } from 'lucide-react';
import { useState } from 'react';
import { useWebSocket } from '@/api/ws';
import { useI18n } from '@/i18n/context';

function DeptBoard({ deptId }: { deptId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dept-messages', deptId],
    queryFn: () => api.getDeptMessages(deptId, 30),
    refetchInterval: 5000,
  });

  // Refetch on WebSocket dept:message events
  useWebSocket((event) => {
    if (event.type === 'dept:message' && (event.data as any)?.departmentId === deptId) {
      queryClient.invalidateQueries({ queryKey: ['dept-messages', deptId] });
    }
  });

  const typeIcons: Record<string, string> = {
    message: '💬', result: '📄', request: '🔄', mention: '📢', directive: '📋',
  };
  const typeColors: Record<string, string> = {
    message: 'border-gray-700', result: 'border-green-800/50', request: 'border-yellow-800/50',
    mention: 'border-blue-800/50', directive: 'border-purple-800/50',
  };

  if (isLoading) return <p className="text-gray-500 text-xs">{t('common.loading')}</p>;
  if (messages.length === 0) return <p className="text-gray-600 text-xs">{t('dept.noFeed')}</p>;

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {messages.map((msg: any) => (
        <div key={msg.id} className={`bg-gray-900 border ${typeColors[msg.type] || 'border-gray-800'} rounded-lg px-3 py-2`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">{typeIcons[msg.type] || '💬'}</span>
            <span className="text-xs text-blue-400 font-medium">{msg.authorId}</span>
            <span className="text-xs text-gray-600">{new Date(msg.createdAt).toLocaleTimeString('zh-CN')}</span>
          </div>
          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
      ))}
    </div>
  );
}

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, agentName, deptName } = useI18n();
  const queryClient = useQueryClient();
  const { data: dept, isLoading } = useQuery({
    queryKey: ['department', id],
    queryFn: () => api.getDepartment(id!),
    enabled: !!id,
  });

  const activate = useMutation({
    mutationFn: api.activateAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['department', id] }),
  });

  const deactivate = useMutation({
    mutationFn: api.deactivateAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['department', id] }),
  });

  if (isLoading) return <p className="text-gray-500">{t('common.loading')}</p>;
  if (!dept) return <p className="text-red-400">{t('dept.notFound')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/departments" className="text-gray-400 hover:text-gray-200"><ArrowLeft size={20} /></Link>
        <span className="text-2xl">{dept.emoji}</span>
        <div>
          <h2 className="text-xl font-semibold">{deptName(id!)}</h2>
          <p className="text-sm text-gray-500">{dept.nameEn}</p>
        </div>
      </div>

      {/* Director */}
      {dept.director && (
        <div className="bg-gray-900 border border-blue-800/50 rounded-xl p-4">
          <p className="text-xs text-blue-400 mb-2 uppercase tracking-wider">{t('dept.director')}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{dept.director.emoji}</span>
              <div>
                <Link to={`/agents/${dept.director.id}`} className="font-medium hover:text-blue-400">{agentName(dept.director.name)}</Link>
                <p className="text-xs text-gray-500">{dept.director.id}</p>
              </div>
            </div>
            <AgentStatusControl agent={dept.director} onActivate={() => activate.mutate(dept.director.id)} onDeactivate={() => deactivate.mutate(dept.director.id)} />
          </div>
        </div>
      )}

      {/* Department Overview */}
      <DeptOverview deptId={id!} director={dept.director} />

      {/* Department Message Board */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={16} className="text-purple-400" />
          <h3 className="text-sm font-medium">{t('dept.board')}</h3>
        </div>
        <DeptBoard deptId={id!} />
      </div>

      {/* Cross-Department Requests */}
      <CrossDeptSection deptId={id!} directorId={dept.director?.id} />

      {/* Department Skills */}
      <DeptSkills deptId={id!} />

      {/* Members */}
      <div>
        <h3 className="text-lg font-medium mb-3">{t('dept.teamMembers')} ({dept.members?.length ?? 0})</h3>
        <div className="grid grid-cols-2 gap-3">
          {(dept.members || []).map((agent: any) => (
            <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{agent.emoji}</span>
                <div>
                  <Link to={`/agents/${agent.id}`} className="text-sm font-medium hover:text-blue-400">{agentName(agent.name)}</Link>
                  <p className="text-xs text-gray-500">{agent.id}</p>
                </div>
              </div>
              <AgentStatusControl agent={agent} onActivate={() => activate.mutate(agent.id)} onDeactivate={() => deactivate.mutate(agent.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DEPT_IDS = ['engineering','design','product','marketing','sales','paid-media','project-mgmt','qa','data-ai','infrastructure','game-dev','finance','legal','customer-service','support'];

function CrossDeptSection({ deptId, directorId }: { deptId: string; directorId?: string }) {
  const { lang, deptName } = useI18n();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [toDept, setToDept] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  // Incoming + outgoing requests
  const { data: incoming = [] } = useQuery({
    queryKey: ['cross-dept-incoming', deptId],
    queryFn: () => api.getCrossDeptRequests({ to: deptId }),
    refetchInterval: 5000,
  });
  const { data: outgoing = [] } = useQuery({
    queryKey: ['cross-dept-outgoing', deptId],
    queryFn: () => api.getCrossDeptRequests({ from: deptId }),
    refetchInterval: 5000,
  });

  const createReq = useMutation({
    mutationFn: () => api.createCrossDeptRequest({
      fromDeptId: deptId, toDeptId: toDept, fromAgentId: directorId || '',
      title, description: desc,
    }),
    onSuccess: () => {
      setShowCreate(false); setTitle(''); setDesc(''); setToDept('');
      queryClient.invalidateQueries({ queryKey: ['cross-dept-outgoing', deptId] });
    },
  });

  const acceptReq = useMutation({
    mutationFn: (id: string) => api.acceptCrossDeptRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cross-dept-incoming', deptId] }),
  });

  const rejectReq = useMutation({
    mutationFn: (id: string) => api.rejectCrossDeptRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cross-dept-incoming', deptId] }),
  });

  const pendingIncoming = incoming.filter((r: any) => r.status === 'pending');
  const total = incoming.length + outgoing.length;

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400', accepted: 'text-blue-400', completed: 'text-green-400', rejected: 'text-gray-500',
  };
  const statusLabels: Record<string, Record<string, string>> = {
    en: { pending: 'Pending', accepted: 'In Progress', completed: 'Done', rejected: 'Rejected' },
    zh: { pending: '待处理', accepted: '执行中', completed: '已完成', rejected: '已拒绝' },
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-cyan-400" />
          <h3 className="text-sm font-medium">{lang === 'en' ? 'Cross-Department Requests' : '跨部门协作'}</h3>
          {pendingIncoming.length > 0 && (
            <span className="px-1.5 py-0.5 bg-yellow-900/30 text-yellow-400 rounded-full text-[10px]">{pendingIncoming.length} {lang === 'en' ? 'pending' : '待处理'}</span>
          )}
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded text-xs hover:bg-cyan-900/50">
          {lang === 'en' ? '+ Request Help' : '+ 发起协作'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-gray-800/50 rounded-lg p-3 mb-3 space-y-2">
          <select value={toDept} onChange={e => setToDept(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs">
            <option value="">{lang === 'en' ? 'Select target department' : '选择目标部门'}</option>
            {DEPT_IDS.filter(d => d !== deptId).map(d => (
              <option key={d} value={d}>{deptName(d)}</option>
            ))}
          </select>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder={lang === 'en' ? 'Request title' : '请求标题'}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
            placeholder={lang === 'en' ? 'What do you need from this department?' : '需要该部门做什么？'}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={() => createReq.mutate()} disabled={!toDept || !title || !desc || createReq.isPending}
              className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs disabled:opacity-50">
              {lang === 'en' ? 'Send Request' : '发送请求'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs">
              {lang === 'en' ? 'Cancel' : '取消'}
            </button>
          </div>
        </div>
      )}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Incoming Requests' : '收到的请求'}</p>
          {incoming.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between bg-gray-800/30 rounded px-3 py-2 mb-1">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{r.title}</p>
                <p className="text-[10px] text-gray-500">{lang === 'en' ? 'From' : '来自'} {deptName(r.fromDeptId)} · <span className={statusColors[r.status]}>{statusLabels[lang]?.[r.status]}</span></p>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button onClick={() => acceptReq.mutate(r.id)} className="p-1 rounded bg-green-900/30 text-green-400 hover:bg-green-900/50" title="Accept & Execute">
                    <Check size={12} />
                  </button>
                  <button onClick={() => rejectReq.mutate(r.id)} className="p-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50" title="Reject">
                    <XIcon size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Outgoing Requests' : '发出的请求'}</p>
          {outgoing.map((r: any) => (
            <div key={r.id} className="bg-gray-800/30 rounded px-3 py-2 mb-1">
              <p className="text-xs font-medium truncate">{r.title}</p>
              <p className="text-[10px] text-gray-500">{lang === 'en' ? 'To' : '发给'} {deptName(r.toDeptId)} · <span className={statusColors[r.status]}>{statusLabels[lang]?.[r.status]}</span></p>
              {r.resultSummary && <p className="text-[10px] text-green-400 mt-1">{r.resultSummary.substring(0, 100)}</p>}
            </div>
          ))}
        </div>
      )}

      {total === 0 && !showCreate && (
        <p className="text-xs text-gray-600">{lang === 'en' ? 'No cross-department requests. Click "+ Request Help" to collaborate with another department.' : '暂无跨部门请求。点击"+ 发起协作"与其他部门协作。'}</p>
      )}
    </div>
  );
}

const DEPT_DESC_ZH: Record<string, string> = {
  engineering: '工程部是公司最大的技术团队，拥有28名专业工程师，覆盖前端开发（React/Vue/Angular）、后端架构（微服务/API设计）、移动端（iOS/Android）、嵌入式固件（ESP32/ARM）、数据库优化、XR沉浸式开发（visionOS/WebXR）、区块链智能合约、MCP协议开发、飞书集成、微信小程序等全栈技术领域。部门领导负责将复杂需求拆解为可执行的子任务，根据每位工程师的专长精准分配，并审查产出质量。适合派发：功能开发、技术架构设计、代码审查、性能优化、技术方案评估等任务。',
  design: '设计部由8名专业设计师组成，涵盖UI界面设计（设计系统/组件库）、UX架构（信息架构/交互设计/CSS系统）、UX研究（用户测试/数据驱动设计）、品牌守护（品牌一致性/视觉规范）、视觉叙事（多媒体内容/情感化设计）、无障碍审计（WCAG合规/屏幕阅读器测试）、包容性视觉（文化准确/反偏见图像）、趣味注入（品牌个性/惊喜时刻）。适合派发：界面设计、用户体验优化、品牌视觉规范、设计系统建设、无障碍合规审查等任务。',
  product: '产品部由8名产品专家组成，涵盖产品管理（全生命周期/路线图/利益相关者对齐）、冲刺优先级规划（敏捷方法/资源分配）、趋势研究（市场洞察/竞品分析）、用户反馈综合（多渠道收集/定性转定量）、行为助推引擎（用户动机/交互优化）、应用商店优化（ASO/转化率）、开发者倡导（社区建设/技术内容）、工具评估（技术选型/平台推荐）。适合派发：产品规划、竞品分析、用户调研、功能优先级排序、市场策略制定等任务。',
  marketing: '市场营销部是公司最大的非技术团队，拥有27名专家，覆盖全球和中国双市场。全球平台：TikTok、Instagram、LinkedIn、Twitter、Reddit、YouTube。中国平台：抖音、小红书、B站、微博、快手、微信公众号、知乎。专业能力：内容创作、SEO优化、社交媒体策略、短视频制作与剪辑、直播电商教练、增长黑客、播客策略、轮播图自动生成、电商运营（淘宝/拼多多）、跨境电商、AI搜索优化、中国市场本地化。适合派发：品牌推广、内容营销、社交媒体运营、竞品营销分析、增长策略、中国市场进入等任务。',
  sales: '销售部由12名销售专家组成，涵盖外呼策略（信号驱动/多渠道/个性化）、发现教练（提问技巧/需求挖掘）、交易策略（MEDDPICC资格认证/竞争定位）、客户策略（扩展规划/QBR/净收入留存）、管道分析（健康诊断/预测准确性）、销售教练（代表培训/通话辅导）、提案策略（RFP响应/赢单叙事）、销售工程（技术演示/POC）、政企数字化售前顾问（中国政府IT项目/合规要求）、Salesforce架构（多云设计/集成模式）。适合派发：销售策略制定、客户分析、提案撰写、管道健康检查、政企项目支持等任务。',
  'paid-media': '付费媒体部由7名专家组成，涵盖PPC搜索广告（Google/Microsoft/Amazon/大规模账户架构）、付费社交（Meta/LinkedIn/TikTok/Pinterest全漏斗广告）、程序化购买（展示广告/DV360/DSP/ABM策略）、广告创意策略（RSA优化/素材测试/跨平台创意）、搜索词分析（否定关键词/意图映射）、追踪归因（GTM/GA4/CAPI/服务端实现）、媒体审计（200+检查点/优化建议）。适合派发：广告投放策略、预算分配、ROI优化、追踪配置、账户审计等任务。',
  'project-mgmt': '项目管理部由9名专家组成，涵盖高级项目经理（规格转任务/范围管理）、项目牧羊人（跨职能协调/时间线管理）、工作室制片人（创意与技术项目编排/资源分配）、工作室运营（日常效率/流程优化）、实验追踪（A/B测试设计/假设验证）、Jira流程管家（Git工作流/可追溯提交/发布策略）、流程架构师（完整流程树/故障模式/交接合同）、流程优化（分析/自动化/效率提升）、幕僚长（跨职能间隙管理/战略执行）。适合派发：项目规划、资源协调、流程优化、实验设计、进度追踪等任务。',
  qa: 'QA部由8名质量专家组成，涵盖代码审查（建设性/可操作反馈/安全/性能）、API测试（全面验证/性能测试/第三方集成）、性能基准（测量/分析/优化/系统性能）、安全工程（威胁建模/漏洞评估/安全架构/事件响应）、证据收集（截图驱动/视觉证明/默认找问题）、现实检查（幻想审批终结者/需要压倒性证据才能通过）、测试结果分析（质量指标/可操作洞察）、区块链安全审计（智能合约漏洞/形式化验证/DeFi协议）。适合派发：代码审查、安全审计、性能测试、质量验收、合约审计等任务。',
  'data-ai': '数据与AI部由13名专家组成，涵盖AI工程（ML模型开发/部署/生产集成）、数据工程（数据管道/湖仓架构/ETL）、数据库专家（Schema设计/查询优化/PostgreSQL/MySQL）、分析报告（数据可视化/KPI追踪/决策支持）、模型QA（端到端审计/校准测试/性能监控）、AI引用策略（AEO/GEO/AI推荐引擎优化）、AI数据修复（自愈管道/异常检测/零数据丢失）、图像提示工程（AI图像生成/摄影提示）、Agent编排（多Agent管道/开发流程自动化）、身份图谱（实体解析/多Agent身份一致性）、ZK知识管家（原子笔记/知识连接/跨领域决策）。适合派发：数据分析、模型训练、数据管道搭建、AI功能开发、知识库建设等任务。',
  infrastructure: '基础设施部由8名专家组成，涵盖DevOps自动化（CI/CD管道/云运维）、SRE站点可靠性（SLO/错误预算/可观测性/混沌工程）、事件响应指挥（生产事件管理/结构化响应/事后复盘）、基础设施维护（系统可靠性/性能优化/成本效率）、合规审计（SOC 2/ISO 27001/HIPAA/PCI-DSS）、威胁检测（SIEM规则/MITRE ATT&CK/威胁狩猎）、自主优化架构（API性能影子测试/财务安全护栏）、自动化治理（n8n优先/价值风险评估）。适合派发：部署自动化、监控告警、安全合规、事件响应、成本优化等任务。',
  'game-dev': '游戏开发部由20名专家组成，是公司最大的创意技术团队。引擎覆盖：Unity（架构/编辑器工具/Shader Graph/多人联机）、Unreal Engine 5（系统工程/世界构建/多人架构/技术美术）、Godot 4（GDScript/着色器/多人联机）、Roblox（体验设计/Luau脚本/Avatar创建/DataStore）、Blender（插件开发/资产管线自动化）。专业领域：游戏设计（系统/经济/玩家心理）、关卡设计（空间叙事/节奏/遭遇设计）、叙事设计（分支对话/世界观/环境叙事）、技术美术（着色器/VFX/LOD/性能预算）、游戏音频（FMOD/Wwise/自适应音乐/空间音频）。适合派发：游戏原型、关卡设计、角色系统、多人联机、音效设计、VFX特效等任务。',
  finance: '财务部由7名专家组成，涵盖会计控制（日常记账/对账/财务报告/审计准备）、财务分析（业务洞察/战略决策支持）、FP&A分析（财务规划/预算管理/预测建模）、税务策略（税务合规/筹划优化）、投资研究（市场分析/投资评估）、应付账款Agent（供应商付款/发票处理/多币种支付）、财务追踪（预算监控/现金流优化/KPI分析）。适合派发：财务报表分析、预算规划、税务咨询、投资评估、成本优化等任务。',
  legal: '法务合规部由5名专家组成，涵盖法律合规审查（业务运营/数据处理/多司法管辖区合规）、合同文档审查（合同分析/风险识别/条款优化）、法律客户接收（案件评估/客户筛选）、法律计费与时间追踪（律所运营效率）、医疗营销合规（广告法/药品管理/医疗器械/隐私保护/中国医疗合规）。适合派发：合规审查、合同审查、法律风险评估、医疗合规咨询、隐私政策制定等任务。',
  'customer-service': '客户服务部由7名专家组成，覆盖多个行业垂直领域。通用客服（多渠道支持/问题解决/用户体验优化/品牌体验）、医疗客服（医疗行业专属/患者隐私/合规要求）、酒店宾客服务（入住/退房/礼宾/投诉处理）、贷款顾问助理（金融服务/贷款申请/资格评估）、房产买卖顾问（房产交易/买卖双方服务）、零售退换货（退货流程/客户满意度）、综合支持响应（高效问题解决/主动客户关怀）。适合派发：客户投诉处理、服务流程优化、行业专属客服方案、满意度提升策略等任务。',
  support: '综合支持部由19名多领域专家组成，是公司功能最多样化的部门。HR与培训：招聘专家、HR入职、企业培训设计师、留学顾问。文档与内容：技术写作、文档生成、执行摘要生成、语言翻译、报告分发。学术与研究：人类学家、地理学家、历史学家、叙事学家、心理学家。商务咨询：中国市场本地化策略师、跨境电商专家、直播电商教练、私域运营、供应链策略师。适合派发：招聘需求、培训方案设计、文档撰写、翻译、市场研究、跨境电商咨询、供应链优化等任务。',
};

function DeptOverview({ deptId, director }: { deptId: string; director: any }) {
  const { agentName, lang } = useI18n();
  const [showAll, setShowAll] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ['dept-agents-overview', deptId],
    queryFn: () => api.getAgents({ department: deptId }),
  });

  const directorDetail = useQuery({
    queryKey: ['director-detail', director?.id],
    queryFn: () => api.getAgent(director?.id),
    enabled: !!director?.id,
  }).data;

  const members = agents.filter((a: any) => a.role !== 'director');
  const capabilities = members
    .filter((a: any) => a.vibe || a.description)
    .map((a: any) => ({
      name: agentName(a.name),
      fullName: a.name, // "中文名 (English Name)" format
      vibe: a.vibe || '',
      desc: a.description || '',
    }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Info size={16} className="text-blue-400" />
        <h3 className="text-sm font-medium">{lang === 'en' ? 'About This Department' : '部门介绍'}</h3>
      </div>

      {/* Department description */}
      <div className="bg-blue-900/10 border border-blue-800/20 rounded-lg p-3">
        {lang === 'en' ? (
          <>
            {directorDetail?.vibe && <p className="text-xs text-blue-300 italic mb-1">{directorDetail.vibe}</p>}
            {directorDetail?.description && <p className="text-xs text-gray-400">{directorDetail.description}</p>}
          </>
        ) : (
          <p className="text-xs text-gray-400">{DEPT_DESC_ZH[deptId] || directorDetail?.description || ''}</p>
        )}
      </div>

      {/* Capabilities grid */}
      <div>
        <p className="text-xs text-gray-500 mb-2">{lang === 'en' ? `Capabilities (${members.length} specialists):` : `能力矩阵 (${members.length} 名专员):`}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(showAll ? capabilities : capabilities.slice(0, 8)).map((c, i) => (
            <div key={i} className="bg-gray-800/50 rounded px-2.5 py-1.5">
              <p className="text-xs font-medium text-gray-200">{c.name}</p>
              {lang === 'en' && <p className="text-[10px] text-gray-500 mt-0.5">{c.vibe || c.desc.substring(0, 60)}</p>}
            </div>
          ))}
        </div>
        {capabilities.length > 8 && (
          <button onClick={() => setShowAll(!showAll)}
            className="text-[10px] text-blue-400 hover:text-blue-300 mt-1">
            {showAll ? (lang === 'en' ? 'Show less' : '收起') : (lang === 'en' ? `Show all ${capabilities.length}` : `展开全部 ${capabilities.length}`)}
          </button>
        )}
      </div>

      {/* Task guide */}
      <div className="border-t border-gray-800 pt-3">
        <p className="text-xs text-gray-500 mb-1.5 font-medium">{lang === 'en' ? 'How to use this department:' : '如何使用此部门:'}</p>
        <div className="space-y-1 text-[10px] text-gray-400">
          <p className="flex items-start gap-1.5">
            <Send size={10} className="text-green-400 mt-0.5 flex-shrink-0" />
            {lang === 'en'
              ? 'Send a task to this department from the Tasks page → the director will analyze and delegate to the right specialists.'
              : '在任务页面发送任务到此部门 → 领导会分析并分配给合适的专员。'}
          </p>
          <p className="flex items-start gap-1.5">
            <Send size={10} className="text-blue-400 mt-0.5 flex-shrink-0" />
            {lang === 'en'
              ? 'Or assign directly to a specific member by clicking their name below.'
              : '或点击下方成员名称直接指定任务。'}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeptSkills({ deptId }: { deptId: string }) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: allSkills = [] } = useQuery({ queryKey: ['skills-all'], queryFn: () => api.getSkills() });

  // Get skills assigned to first agent in dept to approximate dept skills
  const { data: agents = [] } = useQuery({
    queryKey: ['dept-agents-skills', deptId],
    queryFn: () => api.getAgents({ department: deptId }),
  });
  const firstAgent = agents[0];
  const { data: agentSkills = [] } = useQuery({
    queryKey: ['agent-skills', firstAgent?.id],
    queryFn: () => api.getAgentSkills(firstAgent?.id),
    enabled: !!firstAgent?.id,
  });

  const assignedIds = new Set(agentSkills.map((s: any) => s.id));

  const assign = useMutation({
    mutationFn: (skillId: string) => api.assignSkill(skillId, { departmentId: deptId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skills'] });
      queryClient.invalidateQueries({ queryKey: ['skills-all'] });
    },
  });

  const unassignAll = useMutation({
    mutationFn: async (skillId: string) => {
      for (const a of agents) {
        await api.unassignSkill(skillId, a.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-skills'] }),
  });

  const catIcons: Record<string, string> = { workflow: '🔄', template: '📄', tool: '🔧', knowledge: '🧠', general: '📚' };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          <h3 className="text-sm font-medium">{lang === 'en' ? 'Department Skills' : '部门技能'}</h3>
          <span className="text-xs text-gray-500">({agentSkills.length})</span>
        </div>
      </div>

      {/* Assigned skills */}
      {agentSkills.length > 0 && (
        <div className="space-y-1 mb-3">
          {agentSkills.map((skill: any) => (
            <div key={skill.id} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs">{catIcons[skill.category] || '📚'}</span>
                <span className="text-xs font-medium">{skill.name}</span>
                <span className="text-[10px] text-gray-500">{skill.category}</span>
              </div>
              <button onClick={() => unassignAll.mutate(skill.id)}
                className="text-[10px] text-gray-500 hover:text-red-400">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Available skills to assign */}
      {allSkills.filter((s: any) => !assignedIds.has(s.id)).length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Available skills (click to assign):' : '可分配技能（点击分配）:'}</p>
          <div className="flex flex-wrap gap-1">
            {allSkills.filter((s: any) => !assignedIds.has(s.id)).map((skill: any) => (
              <button key={skill.id} onClick={() => assign.mutate(skill.id)}
                className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 hover:border-yellow-600 hover:text-yellow-400 flex items-center gap-1">
                {catIcons[skill.category] || '📚'} {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {allSkills.length === 0 && (
        <p className="text-xs text-gray-600">{lang === 'en' ? 'No skills created yet. Save task results as skills from the Tasks page.' : '暂无技能。在任务页面将结果保存为技能。'}</p>
      )}
    </div>
  );
}

function AgentStatusControl({ agent, onActivate, onDeactivate }: { agent: any; onActivate: () => void; onDeactivate: () => void }) {
  const { t } = useI18n();
  const statusColors: Record<string, string> = {
    standby: 'text-green-400', busy: 'text-yellow-400', idle: 'text-blue-400', offline: 'text-gray-600',
  };

  const statusKeys: Record<string, string> = {
    standby: 'status.standby', busy: 'status.busy', idle: 'status.idle', offline: 'status.offline',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${statusColors[agent.status] || 'text-gray-500'}`}>
        {statusKeys[agent.status] ? t(statusKeys[agent.status] as any) : agent.status}
      </span>
      {agent.isActive ? (
        <button onClick={onDeactivate} className="p-1.5 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors" title={t('dept.deactivate')}>
          <PowerOff size={14} />
        </button>
      ) : (
        <button onClick={onActivate} className="p-1.5 rounded-lg bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors" title={t('dept.activate')}>
          <Power size={14} />
        </button>
      )}
    </div>
  );
}
