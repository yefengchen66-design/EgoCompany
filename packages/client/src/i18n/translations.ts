export type Lang = 'en' | 'zh';

const translations = {
  // Sidebar
  'nav.overview': { en: 'Overview', zh: '概览' },
  'nav.office': { en: 'Office View', zh: '公司全景' },
  'nav.departments': { en: 'Departments', zh: '部门' },
  'nav.agents': { en: 'Agents', zh: 'Agent' },
  'nav.tasks': { en: 'Tasks', zh: '任务' },
  'nav.pipelines': { en: 'Pipelines', zh: '流水线' },
  'nav.meetings': { en: 'Meetings', zh: '会议' },
  'nav.skills': { en: 'Skills', zh: '技能库' },
  'nav.projects': { en: 'Projects', zh: '项目管理' },
  'nav.terminal': { en: 'Terminal', zh: '终端' },
  'nav.settings': { en: 'Settings', zh: '设置' },
  'app.title': { en: 'EgoCompany', zh: 'EgoCompany' },
  'app.subtitle': { en: 'AI Agent Virtual Company', zh: 'AI Agent 虚拟公司' },

  // Dashboard
  'dash.title': { en: 'Company Overview', zh: '公司概览' },
  'dash.totalAgents': { en: 'Total Agents', zh: '总Agent数' },
  'dash.busy': { en: 'Busy', zh: '工作中' },
  'dash.runningTasks': { en: 'Running Tasks', zh: '运行中任务' },
  'dash.runtimesAvail': { en: 'Runtimes', zh: '可用Runtime' },
  'dash.tokenUsage': { en: 'Token Usage', zh: 'Token消耗' },
  'dash.skillsAccum': { en: 'Skills', zh: '技能积累' },
  'dash.inputTokens': { en: 'Input Tokens', zh: '输入Token' },
  'dash.outputTokens': { en: 'Output Tokens', zh: '输出Token' },
  'dash.trackedTasks': { en: 'Tracked Tasks', zh: '涉及任务' },
  'dash.deptOverview': { en: 'Department Overview', zh: '部门概览' },
  'dash.recentTasks': { en: 'Recent Tasks', zh: '最近任务' },
  'dash.noTasks': { en: 'No tasks yet', zh: '暂无任务' },
  'dash.members': { en: 'Members', zh: '成员' },
  'dash.active': { en: 'Active', zh: '活跃' },
  'dash.busyLabel': { en: 'Busy', zh: '忙碌' },
  'dash.running': { en: 'Running', zh: '运行任务' },
  'dash.queued': { en: 'Queued', zh: '队列' },
  'dash.unassigned': { en: 'Unassigned', zh: '未分配' },

  // Agents page
  'agents.title': { en: 'Agent Management', zh: 'Agent 管理' },
  'agents.search': { en: 'Search agents...', zh: '搜索Agent...' },
  'agents.allDepts': { en: 'All Departments', zh: '全部部门' },
  'agents.count': { en: 'agents', zh: '个Agent' },
  'agents.agent': { en: 'Agent', zh: 'Agent' },
  'agents.dept': { en: 'Department', zh: '部门' },
  'agents.role': { en: 'Role', zh: '角色' },
  'agents.status': { en: 'Status', zh: '状态' },
  'agents.runtimes': { en: 'Runtimes', zh: 'Runtimes' },
  'agents.assign': { en: 'Assign Task', zh: '指派任务' },
  'agents.director': { en: 'Director', zh: '领导' },
  'agents.member': { en: 'Member', zh: '成员' },

  // Agent status
  'status.standby': { en: 'Standby', zh: '待命' },
  'status.busy': { en: 'Busy', zh: '工作中' },
  'status.idle': { en: 'Idle', zh: '空闲' },
  'status.offline': { en: 'Offline', zh: '离线' },
  'status.online': { en: 'Online', zh: '在线' },

  // Agent detail
  'agent.identity': { en: 'Identity', zh: '身份介绍' },
  'agent.coreMission': { en: 'Core Mission', zh: '核心使命' },
  'agent.workflow': { en: 'Workflow', zh: '工作流程' },
  'agent.metrics': { en: 'Success Metrics', zh: '成功指标' },
  'agent.leadership': { en: 'Leadership', zh: '领导能力' },
  'agent.delegation': { en: 'Delegation Rules', zh: '分配规则' },
  'agent.memory': { en: 'Memory', zh: '记忆' },
  'agent.addMemory': { en: 'Add memory...', zh: '添加记忆...' },
  'agent.noMemory': { en: 'No memories yet. Will auto-save after tasks.', zh: '暂无记忆。执行任务后会自动保存。' },
  'agent.save': { en: 'Save', zh: '保存' },
  'agent.notFound': { en: 'Agent not found', zh: 'Agent未找到' },

  // Tasks page
  'tasks.title': { en: 'Task Center', zh: '任务中心' },
  'tasks.total': { en: 'total', zh: '个任务' },
  'tasks.running': { en: 'running', zh: '执行中' },
  'tasks.completed': { en: 'completed', zh: '已完成' },
  'tasks.newTask': { en: 'New Task', zh: '新建任务' },
  'tasks.all': { en: 'All', zh: '全部' },
  'tasks.failed': { en: 'Failed', zh: '失败' },
  'tasks.noTasks': { en: 'No tasks', zh: '暂无任务' },
  'tasks.clickCreate': { en: 'Click "New Task" to start', zh: '点击"新建任务"开始' },
  'tasks.instruction': { en: 'Task instruction', zh: '任务指令' },
  'tasks.result': { en: 'Result', zh: '执行结果' },
  'tasks.created': { en: 'Created', zh: '创建' },
  'tasks.started': { en: 'Started', zh: '开始' },
  'tasks.completedAt': { en: 'Completed', zh: '完成' },
  'tasks.execute': { en: 'Execute', zh: '开始执行' },
  'tasks.executing': { en: 'Starting...', zh: '启动中...' },
  'tasks.cancel': { en: 'Cancel', zh: '取消' },
  'tasks.cancelling': { en: 'Cancelling...', zh: '取消中...' },
  'tasks.dispatching': { en: 'Dispatching...', zh: '派发中...' },
  'tasks.tokenUsage': { en: 'Token Usage', zh: 'Token使用' },
  'tasks.directorReview': { en: 'Director Review', zh: '领导审核' },
  'tasks.rounds': { en: 'rounds', zh: '轮' },
  'tasks.approved': { en: 'Approved', zh: '通过' },
  'tasks.revisionNeeded': { en: 'Revision Needed', zh: '需修订' },
  'tasks.viewLog': { en: 'View execution log', zh: '查看执行日志' },
  'tasks.hideLog': { en: 'Hide execution log', zh: '收起执行日志' },
  'tasks.runtime': { en: 'Runtime: Claude Code', zh: '运行时: Claude Code' },

  // Task creation
  'create.title': { en: 'New Task', zh: '新建任务' },
  'create.mode': { en: 'Assignment Mode', zh: '分配方式' },
  'create.singleDept': { en: 'Single Dept', zh: '单部门' },
  'create.multiDept': { en: 'Multi Dept', zh: '多部门并行' },
  'create.specifyAgent': { en: 'Specific Agent', zh: '指定Agent' },
  'create.selectDept': { en: 'Select department', zh: '选择部门' },
  'create.selectMulti': { en: 'Select departments', zh: '选择多个部门' },
  'create.selectAgent': { en: 'Select agent', zh: '选择Agent' },
  'create.titlePlaceholder': { en: 'Task title (optional)', zh: '任务标题（可选）' },
  'create.inputPlaceholder': { en: 'Task instructions...', zh: '任务指令...' },
  'create.autoStart': { en: 'Execute immediately after creation', zh: '创建后立即执行' },
  'create.submitDept': { en: 'Dispatch to {n} departments', zh: '并行派发到 {n} 个部门' },
  'create.submitExecute': { en: 'Create & Execute', zh: '创建并执行' },
  'create.submitCreate': { en: 'Create Task', zh: '创建任务' },
  'create.selected': { en: 'selected', zh: '已选' },
  'create.director': { en: 'Director', zh: '领导' },
  'create.willAutoStandby': { en: '(will auto-activate)', zh: '(将自动待命)' },

  // Task status
  'taskStatus.queued': { en: 'Queued', zh: '等待中' },
  'taskStatus.running': { en: 'Running', zh: '执行中' },
  'taskStatus.reviewing': { en: 'Reviewing', zh: '审核中' },
  'taskStatus.completed': { en: 'Completed', zh: '已完成' },
  'taskStatus.failed': { en: 'Failed', zh: '失败' },
  'taskStatus.cancelled': { en: 'Cancelled', zh: '已取消' },

  // Department detail
  'dept.director': { en: 'Department Director', zh: '部门领导' },
  'dept.board': { en: 'Department Feed', zh: '部门动态' },
  'dept.teamMembers': { en: 'Team Members', zh: '团队成员' },
  'dept.notFound': { en: 'Department not found', zh: '部门未找到' },
  'dept.noFeed': { en: 'No activity yet. Tasks will generate updates.', zh: '暂无部门动态。派发任务后会自动生成。' },
  'dept.activate': { en: 'Activate', zh: '激活' },
  'dept.deactivate': { en: 'Deactivate', zh: '停用' },

  // Skills
  'skills.title': { en: 'Skills Library', zh: '技能库' },
  'skills.desc': { en: 'Auto-accumulated from completed tasks. Injected into relevant future tasks.', zh: '任务完成后自动沉淀为可复用技能，下次执行相关任务时自动注入。' },
  'skills.search': { en: 'Search skills...', zh: '搜索技能...' },
  'skills.addManual': { en: 'Add Manually', zh: '手动添加' },
  'skills.noSkills': { en: 'No skills yet. Will accumulate from tasks.', zh: '暂无技能。执行任务后会自动积累。' },
  'skills.uses': { en: 'uses', zh: '次使用' },
  'skills.viewTemplate': { en: 'View template', zh: '查看模板' },
  'skills.createTitle': { en: 'Create Skill Manually', zh: '手动创建技能' },
  'skills.name': { en: 'Skill name', zh: '技能名称' },
  'skills.description': { en: 'Description', zh: '描述' },
  'skills.template': { en: 'Template content', zh: '模板内容（可复用的解决方案）' },
  'skills.tags': { en: 'Tags (comma separated)', zh: '标签（逗号分隔）' },
  'skills.create': { en: 'Create', zh: '创建' },

  // Department names
  'dept.engineering': { en: 'Engineering', zh: '工程部' },
  'dept.design': { en: 'Design', zh: '设计部' },
  'dept.product': { en: 'Product', zh: '产品部' },
  'dept.marketing': { en: 'Marketing', zh: '市场营销部' },
  'dept.sales': { en: 'Sales', zh: '销售部' },
  'dept.paid-media': { en: 'Paid Media', zh: '付费媒体部' },
  'dept.project-mgmt': { en: 'Project Management', zh: '项目管理部' },
  'dept.qa': { en: 'QA & Testing', zh: '质量保障部' },
  'dept.data-ai': { en: 'Data & AI', zh: '数据与AI部' },
  'dept.infrastructure': { en: 'Infrastructure', zh: '基础设施部' },
  'dept.game-dev': { en: 'Game Development', zh: '游戏开发部' },
  'dept.finance': { en: 'Finance', zh: '财务部' },
  'dept.legal': { en: 'Legal & Compliance', zh: '法务合规部' },
  'dept.customer-service': { en: 'Customer Service', zh: '客户服务部' },
  'dept.support': { en: 'Support', zh: '综合支持部' },

  // Common
  'common.loading': { en: 'Loading...', zh: '加载中...' },
  'common.error': { en: 'Error', zh: '错误' },
  'common.cancel': { en: 'Cancel', zh: '取消' },
  'common.save': { en: 'Save', zh: '保存' },
  'common.delete': { en: 'Delete', zh: '删除' },
  'common.search': { en: 'Search', zh: '搜索' },
  'common.by': { en: 'by', zh: 'by' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}

/** Parse agent name "中文名 (English Name)" based on language */
export function agentName(fullName: string, lang: Lang): string {
  if (lang === 'en') {
    const match = fullName.match(/\(([^)]+)\)/);
    return match ? match[1] : fullName;
  }
  // zh: return full name or just Chinese part
  return fullName;
}

/** Get department display name */
export function deptName(deptId: string, lang: Lang): string {
  const key = `dept.${deptId}` as TranslationKey;
  return t(key, lang);
}

export default translations;
