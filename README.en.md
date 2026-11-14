# dsh-software-company - Software Development Team for DeepSeek Harness

> English version (this file). 中文文档：[README.md]

A **pure-configuration bundle** that adapts the WorkBuddy `software-company` expert team (1 lead + 4 members) into installable **DeepSeek Harness (DSH) 0.2.2-rc.3** agent presets. After installation the host gains 5 Agent Presets: one delivery director (the lead) and four specialists; the lead orchestrates delivery through four named delegation tools following a fixed SOP.

This package has **zero JS entry points**: no runtime code, no `dependencies` / `peerDependencies`, no build scripts. All capabilities come from the `@deepseek-ai/dsh-*` packages already shipped with the host profile. Every persona prompt is inlined into its preset via `@deepseek-ai/dsh-persona` `prefix`, and is also provided as a readable copy under `agents/*.md` (static verification asserts they are byte-for-byte identical).

> Canonical roster (from the original `plugin.json`): 齐活林 / Qi (Delivery Director, lead), 许清楚 / Xu (Product Manager), 高见远 / Gao (Architect), 寇豆码 / Kou (Engineer), 严过关 / Yan (QA Engineer).

---

## Compatibility matrix

| Item | Value |
|------|-------|
| Target host | DeepSeek Harness (DSH) |
| Target host version | `0.2.2-rc.3` |
| Official tag | `dsh-v0.2.2-rc.3` |
| Node requirement | `>=24.9.0` (`engines.node`) |
| Host gate | `engines.dsh: ">=0.2.2-rc.3"` |
| Plugin version | `0.3.0` |
| Bundle type | Pure configuration (patch layer: `./cordis.patch.yml`) |
| Supported profile | `web` (desktop / headless profiles already ship `@deepseek-ai/dsh-*`) |
| License | MIT |

---

## rc.3 incremental adaptation notes

This release moves from `0.1.0` / `dsh-v0.2.2-rc.1` to `0.2.0` / `dsh-v0.2.2-rc.3`:

1. **Version gates realigned**: `engines.dsh` moves from `>=0.2.2-rc.1` to `>=0.2.2-rc.3`, the plugin version becomes `0.2.0`, and the target host tag is `dsh-v0.2.2-rc.3`.
2. **Lead gains `ask_user_question`**: the lead preset mounts `@deepseek-ai/dsh-tool-ask-user` (no extra config) so ambiguous requests can be clarified with structured questions. The four member presets **deliberately do not** mount it - a member asking the user directly would break the rule that all information flows are relayed by the lead.
3. **`tool-subagent-control` `interrupt` made explicit**: all five presets now declare `config.interrupt` explicitly - `true` for the lead (it may need to stop a drifting member) and `false` for members (with `maxDepth: 1` they have no children, so the capability is unusable; this also matches the official standard preset).
4. **Static self-check whitelist aligned with rc.3**: `AUTHORITATIVE_PACKAGES` in `scripts/verify.mjs` now mirrors the full package set of the rc.3 official standard preset (including `tool-ask-user`, `tool-office`, `plan-mode`, `command-goal`, `tool-goal`, `workflow-ptc`, `tool-workflow`), plus new dedicated checks for the `tool-ask-user` distribution and the `interrupt` distribution.
5. **Tool matrix stays deliberately narrow**: the whitelist is only an allow-list. At `0.2.0` the bundle introduced **no** host-optional goal / plan / schedule / office capability. `0.3.0` mounts `command-goal` / `tool-goal` (lead only) and `tool-office` (product manager + engineer only) per the approved matrix; every orchestration capability stays off (see "Capability enablement matrix (0.3.0)" below).

---

## Capability enablement matrix (0.3.0)

| Preset | Added plugin rows | Config | Purpose |
|--------|-------------------|--------|---------|
| `software-company-lead` (`sc-preset-lead`) | `@deepseek-ai/dsh-command-goal` (`command-goal`) + `@deepseek-ai/dsh-tool-goal` (`tool-goal`) | both without config (every field has a default) | the lead tracks cross-stage delivery goals |
| `software-company-product-manager` | `@deepseek-ai/dsh-tool-office` (`tool-office`) | without config (`activationSkills` defaults) | Office document deliverables |
| `software-company-engineer` | `@deepseek-ai/dsh-tool-office` (`tool-office`) | same as above | same as above |
| `software-company-architect` | no new package | - | zero extension |
| `software-company-qa-engineer` | no new package | - | acceptance reports stay in-conversation; office is not enabled by default |

Design principle: **orchestration capabilities are never opened to members, artifact capabilities are mounted per role** - `plan-mode`, `tool-schedule`, `workflow-ptc` and `tool-workflow` stay at zero occurrences, members still cannot spawn subagents or reach the user behind the lead.

---

## Installation

### CLI

```
dsh plugin --profile web add github:xylon-y/dsh-software-company
```

This adds the repository to `dsh.profile.bundles` of the selected profile.

### Desktop app

Open **Plugins -> Add plugin** and paste the repository URL:

```
https://github.com/xylon-y/dsh-software-company
```

### After installing

**Restart the profile** (or restart the desktop app) so the patch layer participates in config composition. Then run `dsh --dump-config` for a self-check (see below).

---

## Usage

When creating a new session, pick **"软件开发团队 · 交付总监（齐活林 Qi）"** (`software-company-lead`) in the **Agent Preset** selector, or set it as the default preset in settings. Then describe the request: the lead (齐活林 / Qi) first classifies the workflow (Fast mode / BugFix / Standard SOP / Partial workflow) and delegates accordingly.

> Only the lead preset owns the four delegation tools. The four member presets carry only `@deepseek-ai/dsh-tool-subagent-control` (`send_message` / `interrupt_agent` / `list_agents`); they cannot spawn further subagents and cannot message each other. Subagent completion notices are delivered to the lead automatically - no polling, no sleep.

---

## 5 Agent Presets and 4 delegation tools

| Role | Name | `config.id` | `order` | Lead delegation tool |
|------|------|------------|---------|----------------------|
| Lead / Delivery Director | 齐活林 (Qi) | `software-company-lead` | 10 | Owns all four tools below |
| Product Manager | 许清楚 (Xu) | `software-company-product-manager` | 11 | `delegate_to_pm` |
| Architect | 高见远 (Gao) | `software-company-architect` | 12 | `delegate_to_architect` |
| Engineer | 寇豆码 (Kou) | `software-company-engineer` | 13 | `delegate_to_engineer` |
| QA Engineer | 严过关 (Yan) | `software-company-qa-engineer` | 14 | `delegate_to_qa` |

`order` uses 10-14 to avoid the official `standard` preset (order 1). Each delegation tool is a distinct `@deepseek-ai/dsh-tool-subagent` instance with `provider: spawn`, `maxDepth: 1`, an explicit `agentPreset`, and a globally unique `toolName`. Instances live in the `delegation` `cordis:group` with `isolate: { workflowEngine: true }` preserved from the official standard preset.

---

## Four workflows

| Workflow | Trigger | Stage order |
|----------|---------|-------------|
| Fast mode | Single-page app / small game / CLI tool / <= 10 source files | Request -> `delegate_to_engineer` (all code in one turn) -> `delegate_to_qa` -> deliver |
| BugFix | A clearly reported bug, not a new feature | Bug report -> `delegate_to_engineer` (locate + fix) -> `delegate_to_qa` (regression only) |
| Standard SOP | Medium/large, multi-module, frontend + backend, > 10 source files | PRD -> system design + task decomposition -> coding + global consistency review -> tests + smart routing |
| Partial workflow | Analysis only | Dispatch a single member: PRD only / architecture review / implementation only / tests only / market research |

Quality gates: the Engineer runs an `IS_PASS` global consistency review (max 2 rounds); QA makes an `Engineer / QA / NoOne` smart-routing decision per round (max 2 test rounds). Other invariants: sequential flow, full prior context forwarded, feedback loops, language consistency, documentation, structured output, incremental-development support, member conclusions are authoritative while the lead only orchestrates. The final delivery summary must contain **TL;DR / Delivery overview / File list / Next-step suggestions**.

---

## Optional skill installation

The full SOP is already inlined into the lead's persona `prefix`, so it works out of the box. The bundled `skills/software-company-sop/SKILL.md` is an **optional project-level enhancement** cheat sheet (routing table, role/delegation mapping, workflow stages, quality gates, delivery spec, message-relay rules).

The `skills/` directory **inside the plugin package is NOT auto-discovered**. `@deepseek-ai/dsh-skill-filesystem` scans `<project>/.dsh/skills`, `<project>/.agents/skills`, `customSkillDirs`, and the user directory, one level deep for `<name>/SKILL.md`. Copy it manually:

```
mkdir -p <project>/.dsh/skills
cp -r skills/software-company-sop <project>/.dsh/skills/
```

The resulting path must be `<project>/.dsh/skills/software-company-sop/SKILL.md`; the model can then load it on demand via the `skill` tool. Do not try `!!js` tricks to guess the package path (fragile and possibly blocked by execution policy).

---

## Verification

Zero third-party dependencies, plain Node:

```
node scripts/verify.mjs
```

It prints one PASS/FAIL line per check plus a summary and exits with code 1 on any failure. Coverage: `package.json` fields and version gates, the `files` manifest, `cordis.patch.yml` structure (single `- insert:`, five `sc-` rows, unique row ids / `config.id`, valid `agentPreset` / `toolName`, no delegation instances in member presets), byte-for-byte `prefix` vs `agents/*.md` agreement, prompt interpolation safety, skill frontmatter and size, install commands in both READMEs, and more.

### Composed-config self-check (recommended on a real host)

```
dsh --dump-config
```

Confirm: all five `software-company-*` presets appear in the composed config tree; each preset's `plugins[0]` is `@deepseek-ai/dsh-persona`; only the lead preset has the four `tool-subagent` instances; no host-owned top-level row id was overwritten. Because patch `config` is a **whole-value replacement** (not a deep merge), this bundle only inserts brand-new `sc-`-prefixed rows.

---

## Known limitations (stated honestly)

1. **Verified on a real host**: tested on DSH NEXT desktop (Electron, kernel `0.2.2-rc.3`): all 5 presets loaded, all four `delegate_to_*` tools on the lead preset were available, and all four members were delegated correctly and self-reported the right identity (齐活林 / 许清楚 / 高见远 / 寇豆码 / 严过关). Running `dsh --dump-config` on your own host is still recommended. `runtimeVerification` in `compatibility.json` records this result.
2. **Pure-configuration bundle**: no custom runtime tools, UI, or JS entry points; all capabilities depend on the `@deepseek-ai/dsh-*` packages shipped by the host profile.
3. **Token overhead**: the full SOP is injected as a persona `prefix` into the system prompt, so it is carried on every turn and increases per-turn token usage.
4. **Message topology**: DSH `send_message` only supports direct parent/child communication, so members cannot message each other directly. This happens to satisfy the original SOP rule ("all cross-member information flows are relayed by the lead"), but it also prevents lateral member-to-member negotiation.
5. **Do not overwrite the official `standard` preset**: this bundle only inserts new `sc-`-prefixed rows and never touches host top-level rows such as `agent-preset-registry`, `system-prompt`, `skill-filesystem`, `tool-skill`, `agent-loop`. Do not hand-edit it into a `replace`.
6. **Enabled tool parameters match the official standard (the tool surface is an intentionally narrow subset)**: this bundle enables the core coding tools; `plan` / `schedule` / `workflow` are deliberately not enabled, `goal` is lead-only and `office` is product-manager + engineer only (see "Capability enablement matrix (0.3.0)" above). For the tools it does enable, parameters match the official standard: shell tools are conditionally disabled per host platform - `@deepseek-ai/dsh-tool-bash` on win32 and `@deepseek-ai/dsh-tool-pwsh` on non-win32 (`disabled` is evaluated in the patch layer via a `!!js` expression); `tool-fs` disables `applyPatch`, `tool-fs-search` disables `sampleOverCapGlobResults`, `tool-todo` enables `allowParallelInProgress`, `tool-web` enables `fetch` with `searchTimeoutMs: 60000`, and `compaction-tool-result-pruner` sets `thresholdChars: 8192` / `headChars: 4096` / `tailChars: 1024`.
7. **Prompt variable interpolation**: DSH interpolates variables inside the persona `prefix`; unregistered variables break prompt assembly. All `prefix` blocks and `agents/*.md` bodies here are guaranteed free of the template-variable opener (two consecutive left curly braces) - do not introduce one when customizing.
8. **Node gate**: `engines.node: ">=24.9.0"` is required by DSH 0.2.2-rc.3. `scripts/verify.mjs` itself uses only Node built-ins, but please run it in an environment that satisfies the gate.

---

## Layout

```
dsh-software-company/
├── package.json                 # pure-config declaration + engines gates + dsh.bundle.patch
├── cordis.patch.yml             # one - insert: containing 5 Agent Presets
├── agents/                      # readable DSH persona sources (prefix injected verbatim)
│   ├── software-team-lead.md
│   ├── software-product-manager.md
│   ├── software-architect.md
│   ├── software-engineer.md
│   └── software-qa-engineer.md
├── skills/software-company-sop/SKILL.md   # optional project-level enhancement
├── scripts/verify.mjs          # zero-dependency static self-check
├── README.md（中文，默认首页）/ README.en.md（English）
├── compatibility.json
├── LICENSE
└── .gitignore
```

## License

MIT (c) 2026 xylon-y
