# EgoCompany

A virtual AI company platform with 15 departments, 201 AI agent employees, pixel-art office visualization, and real task execution via local Claude Code CLI.

![Node](https://img.shields.io/badge/Node.js-≥20-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![React](https://img.shields.io/badge/React-19-cyan) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Quick Start

```bash
git clone https://github.com/yefengchen66-design/egocompany.git
cd egocompany
pnpm install
pnpm dev
```

Open **http://localhost:5173** in your browser.

## Prerequisites

| Requirement | Version | Install |
|---|---|---|
| **Node.js** | >= 20 | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| **pnpm** | >= 9 | `npm install -g pnpm` |
| **Claude Code CLI** | latest | `npm install -g @anthropic-ai/claude-code` |

### Claude Code Setup

```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude login    # required once
```

## Commands

```bash
pnpm dev          # Start both frontend and backend
pnpm dev:server   # Backend only (port 3141)
pnpm dev:client   # Frontend only (port 5173)
pnpm build        # Production build
pnpm test         # Run tests (54 tests)
```

## How It Works

### Architecture

```
Browser (React + Vite)
    ↕ HTTP REST + WebSocket
Fastify Server (Node.js + SQLite)
    ↕ child_process.spawn
Local Terminal: claude -p --permission-mode bypassPermissions
```

### Complete Project Workflow

```
1. Meeting: Select department directors → discuss a topic → each responds

2. Orchestration: Chief of Staff analyzes → creates phased execution plan
   Phase 1: Product + Design (parallel — no dependencies)
   Phase 2: Engineering (needs Phase 1 specs)
   Phase 3: QA (needs Phase 2 code)

3. Phased Execution:
   Phase 1 → Directors delegate to employees → employees execute in parallel
   Wait for Phase 1 completion
   Phase 2 → receives Phase 1 results as context → employees execute
   And so on...

4. Director Review: each director reviews employee output (up to 3 rounds)

5. Project Report: view all results, generate full report, copy to clipboard

6. Follow-up: send additional instructions to any department with full context
```

### Cross-Department Collaboration

Any department can request help from another:
1. Click "+ Request Help" on department page
2. Select target department and describe the need
3. Target department's director receives, accepts, and delegates to employees
4. Results posted back to requesting department

### Task Execution Detail

Each agent task spawns an independent `claude -p` process:
- System prompt built from agent's personality profile (~200 lines)
- Injected context: memories, department feed, colleague insights, sibling results, skills
- Token usage tracked per model
- Session ID saved for `--resume` continuity
- Execution log: tool calls, progress, errors

## 15 Departments, 201 Agents

| Dept | Director | Members | Focus |
|------|----------|---------|-------|
| ⚙️ Engineering | Engineering Director | 28 | Frontend, backend, mobile, embedded, XR, blockchain, MCP |
| 🎨 Design | Design Director | 8 | UI/UX, brand, accessibility, visual storytelling |
| 📦 Product | Product Director | 8 | Product management, sprint planning, trend research |
| 📢 Marketing | Marketing Director | 27 | Content, SEO, social media, video, China + global platforms |
| 💰 Sales | Sales Director | 12 | Outbound, deals, account strategy, pipeline, govt sales |
| 📊 Paid Media | Paid Media Director | 7 | PPC, paid social, programmatic, tracking |
| 📋 Project Mgmt | PM Director | 9 | Project delivery, workflow design, experiment tracking |
| 🔍 QA & Testing | QA Director | 8 | Code review, API testing, security, performance |
| 🤖 Data & AI | Data & AI Director | 13 | ML engineering, data pipelines, analytics, agent orchestration |
| 🏗️ Infrastructure | Infra Director | 8 | DevOps, SRE, security compliance, incident response |
| 🎮 Game Dev | Game Dev Director | 20 | Unity, Unreal, Godot, Roblox, Blender, audio, narrative |
| 💵 Finance | Finance Director | 7 | Accounting, financial analysis, tax, investment |
| ⚖️ Legal | Legal Director | 5 | Compliance, contracts, healthcare regulations |
| 🎧 Customer Service | CS Director | 7 | Multi-industry support: retail, healthcare, hospitality |
| 🤝 Support | Support Director | 19 | HR, training, docs, research, commerce consulting |

Agent definitions sourced from [agency-agents](https://github.com/msitarzewski/agency-agents) with full personality profiles.

## Features

### Pixel Office (16-floor building)
- Each floor = one department with pixel-art characters
- Click characters to assign tasks directly
- Real-time status: green=working, blue=idle, yellow=standby, red=offline
- Meeting room floor with interactive meeting controls

### Project Management
- Projects auto-detected from meeting dispatches
- Phased execution view with progress bar
- Full report generation (markdown, one-click copy)
- Follow-up tasks to any department with project context
- Retry failed phases or individual tasks

### Intelligent Phased Execution
- Chief of Staff analyzes meeting → creates dependency-aware phase plan
- Parallel departments in same phase, sequential across phases
- Each phase receives prior phase results as input context

### Director Delegation
- Director receives task → analyzes → outputs JSON subtask plan
- System creates subtasks → assigns to employees → parallel execution
- Director reviews results (approve / request revision, max 3 rounds)

### Cross-Department Requests
- Any department can request help from another
- Target department's director receives, delegates, and delivers results
- Both departments see status updates on their message boards

### Skills Library
- Curated reusable capabilities (workflow, template, tool, knowledge)
- Assign skills to agents or entire departments
- Save task results as skills directly from task cards
- Skills auto-injected into agent prompts at execution time

### Department Intelligence
- Department overview with capability profiles
- Department message board (real-time feed)
- Shared knowledge store (key-value)
- Cross-agent memory search (FTS5)

### Meetings
- Select department directors → set topic → sequential discussion
- Follow-up questions during meeting
- Dispatch tasks with intelligent phasing after meeting
- Synthesize results into unified project report

### Token Tracking
- Per-task, per-model token usage (input, output, cache)
- Cost display on task cards
- Aggregate dashboard stats

### i18n
- Full English/Chinese bilingual support
- Toggle via sidebar button
- Language preference persisted in localStorage

## Project Structure

```
egocompany/
├── packages/
│   ├── shared/           # TypeScript types + constants
│   ├── server/           # Fastify 5 backend (port 3141)
│   │   ├── db/           # SQLite schema + 15 query modules
│   │   ├── services/     # AgentRegistry, TaskEngine, TerminalManager,
│   │   │                   MeetingExecutor, PipelineExecutor, EventBus
│   │   ├── routes/       # REST API routes (12 route modules)
│   │   └── ws/           # WebSocket hub
│   ├── client/           # React 19 + Vite 6 frontend
│   │   ├── pages/        # 13 pages
│   │   ├── i18n/         # EN/ZH bilingual
│   │   └── api/          # HTTP + WebSocket client
│   └── agents/           # 201 Markdown agent definitions
├── data/                 # SQLite DB + logs (auto-created)
└── scripts/              # Utilities
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 6, TailwindCSS 4, Zustand 5, TanStack Query 5 |
| Backend | Node.js 20+, Fastify 5, better-sqlite3, WebSocket |
| AI Runtime | Local `claude -p` with `--permission-mode bypassPermissions` |
| Search | SQLite FTS5 for memories + skills |
| Agent Defs | Markdown + YAML frontmatter |
| Tests | Vitest, 54 tests |

## API Reference

```
Health & Stats
  GET  /api/health
  GET  /api/stats

Departments
  GET  /api/departments
  GET  /api/departments/:id
  GET  /api/departments/:id/messages
  GET  /api/departments/:id/context
  PUT  /api/departments/:id/context

Agents
  GET  /api/agents
  GET  /api/agents/:id
  PUT  /api/agents/:id/config
  GET  /api/agents/:id/memories
  GET  /api/agents/:id/skills

Tasks
  GET  /api/tasks
  POST /api/tasks
  POST /api/tasks/department
  POST /api/tasks/:id/execute
  POST /api/tasks/:id/cancel
  POST /api/tasks/:id/retry
  POST /api/tasks/:id/redispatch
  GET  /api/tasks/:id/tree
  GET  /api/tasks/:id/messages
  GET  /api/tasks/:id/usage
  GET  /api/tasks/:id/reviews

Skills
  GET  /api/skills
  POST /api/skills
  PUT  /api/skills/:id
  POST /api/skills/:id/assign
  POST /api/skills/:id/unassign

Cross-Department
  GET  /api/cross-dept-requests
  POST /api/cross-dept-requests
  POST /api/cross-dept-requests/:id/accept
  POST /api/cross-dept-requests/:id/complete

Meetings
  GET  /api/meetings
  POST /api/meetings
  POST /api/meetings/:id/followup
  POST /api/meetings/:id/dispatch
  POST /api/meetings/:id/synthesize

WebSocket /ws
```

## Troubleshooting

**"claude: command not found"** — Install: `npm install -g @anthropic-ai/claude-code`

**Database errors** — Delete `data/ai-company.db` and restart. Schema auto-creates.

**Frontend shows 0 agents** — Start with `pnpm dev` from project root (not from packages/server/).

**Tasks stuck in "running"** — Check `ps aux | grep "claude.*-p"`. Restart server to reset.

## Credits

- Agent personality definitions: [agency-agents](https://github.com/msitarzewski/agency-agents)

## License

MIT
