### 消息中转铁律（重要）

- 本插件的所有角色提示词中，成员只与主理人通信：成员通过 `send_message` 把产出**完整回传给主理人**（直接父代理）；跨成员信息一律由主理人中转。`send_message` 仅支持直接父/子通信，天然保证成员之间不能互相直连。
- 主理人用 `list_agents` 查看子代理状态，用 `send_message` 向成员追问；子代理完成通知（completion notice）自动送达主理人，无需轮询或 sleep。
- ⚠️ 这是硬性消息边界，不是风格建议：任何成员不得尝试直接联系用户或其他成员。

---

## 已知限制（如实标注）

1. **真机已验证**：已在 DSH NEXT 桌面端（Electron，内核 `0.2.2-rc.3`）实测：5 个 preset 全部加载成功，主理人 preset 的 4 个 `delegate_to_*` 工具全部可用，4 名成员均被正确委派并各自正确自报身份（齐活林 / 许清楚 / 高见远 / 寇豆码 / 严过关）。仍建议在自有宿主上跑一次 `dsh --dump-config` 复核组合配置。`compatibility.json` 中 `runtimeVerification` 已如实记录该结果。
2. **纯配置 Bundle**：不提供自定义运行时工具、UI 或 JS 入口；所有能力依赖宿主 profile 自带的 `@deepseek-ai/dsh-*` 包。
3. **token 开销**：完整 SOP 作为 persona `prefix` 注入系统提示，每轮对话都会携带，会增加每轮 token 消耗。
4. **消息拓扑**：DSH 的 `send_message` 只支持直接父/子通信，成员之间不能互相直连 —— 这恰好满足原 SOP「所有跨成员信息流经主理人中转」的铁律，但也意味着无法做成员间横向协商。
5. **不要覆盖官方 `standard` preset**：本 bundle 只 `insert` 全新的 `sc-` 前缀行，不改动 `agent-preset-registry` / `system-prompt` / `skill-filesystem` / `tool-skill` / `agent-loop` 等宿主顶层行；请勿手工把它改成 `replace`。
6. **已启用工具的参数与官方 standard 对齐（但工具面是收窄子集）**：本包只启用核心编码工具；goal / plan / schedule / office / workflow 等宿主可选能力刻意不启用（见上文「rc.3 增量适配说明」第 5 条）。对已启用的工具，参数与官方 standard 保持一致：shell 工具按宿主平台条件禁用 —— `@deepseek-ai/dsh-tool-bash` 在 win32 禁用、`@deepseek-ai/dsh-tool-pwsh` 在非 win32 禁用（`disabled` 使用 `!!js` 表达式在 patch 层求值）；`tool-fs` 关闭 `applyPatch`、`tool-fs-search` 关闭 `sampleOverCapGlobResults`、`tool-todo` 开启 `allowParallelInProgress`、`tool-web` 开启 `fetch` 并设 `searchTimeoutMs: 60000`、`compaction-tool-result-pruner` 设 `thresholdChars: 8192` / `headChars: 4096` / `tailChars: 1024`。
7. **prompt 变量插值**：DSH 会对 persona `prefix` 做变量插值，未注册变量会导致 prompt 组装失败；本包所有 `prefix` 与 `agents/*.md` 正文均已确保不含模板变量起始符（两个连续的左花括号），自定义修改时请勿引入。
8. **Node 门控**：`engines.node: ">=24.9.0"` 是 DSH 0.2.2-rc.3 的要求；`scripts/verify.mjs` 本身只用 Node 原生 API，但请在满足门控的环境运行。
