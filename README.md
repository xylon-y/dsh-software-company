# dsh-software-company · DeepSeek Harness 软件开发团队插件

> 中文文档（即本文件，GitHub 首页默认展示）。English version: [README.en.md]

把 WorkBuddy `software-company` 专家团（1 主理人 + 4 成员）适配为 **DeepSeek Harness（DSH）0.2.2-rc.1** 可安装的**纯配置 Bundle**。安装后宿主会多出 5 个 Agent Preset：1 个主理人 + 4 个成员，主理人通过 4 个具名委派工具按 SOP 编排交付。

本包**零 JS 入口**：不提供运行时代码、不声明任何 `dependencies` / `peerDependencies`、没有构建脚本；能力全部来自宿主自带的 `@deepseek-ai/dsh-*` 包。所有角色提示词以 `@deepseek-ai/dsh-persona` 的 `prefix` 内联进各自的 preset，并同时以 `agents/*.md` 提供可读副本（两者由静态自检保证逐字一致）。

> 正式花名（以原 `plugin.json` 为准）：齐活林（Qi，交付总监 / 主理人）、许清楚（Xu，产品经理）、高见远（Gao，架构师）、寇豆码（Kou，工程师）、严过关（Yan，QA 工程师）。

---

## 兼容性矩阵

| 项目 | 值 |
|------|-----|
| 目标宿主 | DeepSeek Harness（DSH） |
| 目标宿主版本 | `0.2.2-rc.1` |
| 官方 tag | `dsh-v0.2.2-rc.1` |
| Node 要求 | `>=24.9.0`（`engines.node`） |
| 宿主门控 | `engines.dsh: ">=0.2.2-rc.1"` |
| 插件版本 | `0.1.0` |
| Bundle 类型 | 纯配置（patch 层：`./cordis.patch.yml`） |
| 适用 profile | `web`（桌面端 / headless 均自带 `@deepseek-ai/dsh-*` 包） |
| License | MIT |

---

## 安装

### CLI

```
dsh plugin --profile web add github:xylon-y/dsh-software-company
```

该命令会把本仓库加入所选 profile 的 `dsh.profile.bundles`。

### 桌面端

打开 **Plugins → Add plugin**，粘贴仓库 URL：

```
https://github.com/xylon-y/dsh-software-company
```

### 安装后

**重启对应 profile**（或重启桌面端），让 patch 层参与配置组装。建议随后用 `dsh --dump-config` 做一次组合配置自检（见下文）。

---

## 使用

新建会话时，在 **Agent Preset** 下拉中选择 **「软件开发团队 · 交付总监（齐活林 Qi）」**（`software-company-lead`）；也可在设置里把它设为默认 preset。随后直接描述需求，主理人齐活林会先判定工作流类型（快速模式 / BugFix / 标准 SOP / 部分工作流），再分派给成员。

> 只有主理人 preset 持有 4 个委派工具。4 个成员 preset 只挂 `@deepseek-ai/dsh-tool-subagent-control`（提供 `send_message` / `interrupt_agent` / `list_agents`），不能再委派下级代理，也无法互相直连。子代理完成通知（completion notice）会自动回到主理人，无需轮询或 sleep。

---

## 5 个 Agent Preset 与 4 个委派工具

| 角色 | 花名 | `config.id` | `order` | 主理人委派工具 |
|------|------|-------------|---------|----------------|
| 主理人 / 交付总监 | 齐活林（Qi） | `software-company-lead` | 10 | 持有下列全部 4 个 |
| 产品经理 | 许清楚（Xu） | `software-company-product-manager` | 11 | `delegate_to_pm` |
| 架构师 | 高见远（Gao） | `software-company-architect` | 12 | `delegate_to_architect` |
| 工程师 | 寇豆码（Kou） | `software-company-engineer` | 13 | `delegate_to_engineer` |
| QA 工程师 | 严过关（Yan） | `software-company-qa-engineer` | 14 | `delegate_to_qa` |

`order` 使用 10-14，避开官方 `standard` preset 的 1。每个委派工具都是 `@deepseek-ai/dsh-tool-subagent` 的一个独立实例：`provider: spawn`、`maxDepth: 1`、显式 `agentPreset`，`toolName` 全局唯一。这些实例包在 `delegation` 的 `cordis:group` 里，并保留 `isolate: { workflowEngine: true }`。

---

## 四种工作流

| 工作流 | 判定条件 | 阶段顺序 |
|--------|---------|---------|
| ⚡ 快速模式 | 单页面应用 / 小游戏 / 工具脚本 / ≤ 10 个源文件 | 用户需求 → `delegate_to_engineer`（一次性写完全部代码）→ `delegate_to_qa` → 交付 |
| 🔧 BugFix | 用户报告明确 Bug、非新功能 | Bug 报告 → `delegate_to_engineer`（定位 + 修复）→ `delegate_to_qa`（仅回归） |
| 🏗️ 标准 SOP | 中大型 / 多模块 / 涉及前后端 / > 10 个源文件 | PRD → 系统设计 + 任务分解 → 编码 + 全局一致性审查 → 测试 + 智能路由 |
| 📋 部分工作流 | 仅需分析 | 只分派单个成员：仅 PRD / 架构评审 / 代码实现 / 仅测试 / 市场调研 |

质量关卡：工程师完成全部文件后做 `IS_PASS` 全局一致性审查（最多 2 轮）；QA 每轮做智能路由判定 `Engineer / QA / NoOne`，最多 2 轮测试。其余铁律：顺序流转、信息传递含前序完整上下文、反馈回路、语言一致性、文档化、结构化输出、增量开发支持、成员结论为准而主理人只做编排。最终交付总结必含 **TL;DR / 交付概览 / 文件清单 / 用户下一步建议**。

---

## 可选 Skill 安装

主理人的完整 SOP 已内联在 persona `prefix` 中，**默认即可工作**。仓库自带的 `skills/software-company-sop/SKILL.md` 是可选的**项目级增强**速查卡（路由判定表、角色与委派映射、四种工作流阶段、质量关卡、交付规范、消息中转铁律）。

插件包内的 `skills/` **不会**被 DSH 自动发现。`@deepseek-ai/dsh-skill-filesystem` 只扫描 `<project>/.dsh/skills`、`<project>/.agents/skills`、`customSkillDirs` 与用户目录，且只扫一层 `<name>/SKILL.md`。因此需要手动复制：

```
mkdir -p <project>/.dsh/skills
cp -r skills/software-company-sop <project>/.dsh/skills/
```

复制后应存在 `<project>/.dsh/skills/software-company-sop/SKILL.md`，模型即可通过 `skill` 工具按需加载。不要用 `!!js` 之类手段去猜插件包路径（脆弱且可能被执行策略拦截）。

---

## 验证

零第三方依赖，Node 原生即可运行：

```
node scripts/verify.mjs
```

会逐项输出 PASS/FAIL 并汇总；任一项失败则退出码为 1。覆盖：`package.json` 字段与版本门控、`files` 清单、`cordis.patch.yml` 结构（单个 `- insert:`、5 个 `sc-` 行、行 id / `config.id` 唯一、`agentPreset` / `toolName` 合法、成员无委派实例）、`prefix` 与 `agents/*.md` 逐字一致、prompt 插值安全、Skill frontmatter 与长度、两份 README 的安装命令等。

### 组合配置自检（建议真机执行）

```
dsh --dump-config
```

核对：5 个 `software-company-*` preset 出现在组合后的配置树中；每个 preset 的 `plugins[0]` 是 `@deepseek-ai/dsh-persona`；只有主理人 preset 含 4 个 `tool-subagent` 实例；没有任何宿主已有的顶层行 id 被覆盖。因为 patch 层的 `config` 是**整段替换**而非深合并，本 bundle 只 `insert` 全新的 `sc-` 前缀行。

---

## 已知限制（如实标注）

1. **未做真机组合验证**：构建环境没有 DSH 运行时，本包只通过静态自检 + 官方 `dsh-v0.2.2-rc.1` tag 契约取证；`dsh --dump-config` 与真实委派链路请在宿主上复核。`compatibility.json` 中 `runtimeVerification` 明确记为 `not executed (no DSH host in build environment)`。
2. **纯配置 Bundle**：不提供自定义运行时工具、UI 或 JS 入口；所有能力依赖宿主 profile 自带的 `@deepseek-ai/dsh-*` 包。
3. **token 开销**：完整 SOP 作为 persona `prefix` 注入系统提示，每轮对话都会携带，会增加每轮 token 消耗。
4. **消息拓扑**：DSH 的 `send_message` 只支持直接父/子通信，成员之间不能互相直连 —— 这恰好满足原 SOP「所有跨成员信息流经主理人中转」的铁律，但也意味着无法做成员间横向协商。
5. **不要覆盖官方 `standard` preset**：本 bundle 只 `insert` 全新的 `sc-` 前缀行，不改动 `agent-preset-registry` / `system-prompt` / `skill-filesystem` / `tool-skill` / `agent-loop` 等宿主顶层行；请勿手工把它改成 `replace`。
6. **工具子集与官方 standard 完全对齐**：shell 工具按宿主平台条件禁用 —— `@deepseek-ai/dsh-tool-bash` 在 win32 禁用、`@deepseek-ai/dsh-tool-pwsh` 在非 win32 禁用，与官方 standard preset 一致（`disabled` 使用 `!!js` 表达式在 patch 层求值）。其余工具 config 亦对齐官方：`tool-fs` 关闭 `applyPatch`、`tool-fs-search` 关闭 `sampleOverCapGlobResults`、`tool-todo` 开启 `allowParallelInProgress`、`tool-web` 开启 `fetch` 并设 `searchTimeoutMs: 60000`、`compaction-tool-result-pruner` 设 `thresholdChars: 8192` / `headChars: 4096` / `tailChars: 1024`。
7. **prompt 变量插值**：DSH 会对 persona `prefix` 做变量插值，未注册变量会导致 prompt 组装失败；本包所有 `prefix` 与 `agents/*.md` 正文均已确保不含模板变量起始符（两个连续的左花括号），自定义修改时请勿引入。
8. **Node 门控**：`engines.node: ">=24.9.0"` 是 DSH 0.2.2-rc.1 的要求；`scripts/verify.mjs` 本身只用 Node 原生 API，但请在满足门控的环境运行。

---

## 目录结构

```
dsh-software-company/
├── package.json                 # 纯配置 bundle 声明 + engines 门控 + dsh.bundle.patch
├── cordis.patch.yml             # 单个 - insert: 内含 5 个 Agent Preset
├── agents/                      # DSH 版角色提示词（可读源，prefix 由此逐字注入）
│   ├── software-team-lead.md
│   ├── software-product-manager.md
│   ├── software-architect.md
│   ├── software-engineer.md
│   └── software-qa-engineer.md
├── skills/software-company-sop/SKILL.md   # 可选项目级增强
├── scripts/verify.mjs          # 零依赖静态自检
├── README.md（中文，默认首页）/ README.en.md（English）
├── compatibility.json
├── LICENSE
└── .gitignore
```

## License

MIT © 2026 xylon-y
