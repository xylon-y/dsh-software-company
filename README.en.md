# dsh-software-company - Software Development Team for DeepSeek Harness

> English version (this file). 中文文档：[README.md]

A **pure-configuration bundle** that adapts the WorkBuddy `software-company` expert team (1 lead + 4 members) into installable **DeepSeek Harness (DSH) 0.2.2-rc.1** agent presets. After installation the host gains 5 Agent Presets: one delivery director (the lead) and four specialists; the lead orchestrates delivery through four named delegation tools following a fixed SOP.

This package has **zero JS entry points**: no runtime code, no `dependencies` / `peerDependencies`, no build scripts. All capabilities come from the `@deepseek-ai/dsh-*` packages already shipped with the host profile. Every persona prompt is inlined into its preset via `@deepseek-ai/dsh-persona` `prefix`, and is also provided as a readable copy under `agents/*.md` (static verification asserts they are byte-for-byte identical).

> Canonical roster (from the original `plugin.json`): 齐活林 / Qi (Delivery Director, lead), 许清楚 / Xu (Product Manager), 高见远 / Gao (Architect), 寇豆码 / Kou (Engineer), 严过关 / Yan (QA Engineer).

---

## Compatibility matrix

| Item | Value |
|------|-------|
| Target host | DeepSeek Harness (DSH) |
| Target host version | `0.2.2-rc.1` |
| Official tag | `dsh-v0.2.2-rc.1` |
| Node requirement | `>=24.9.0` (`engines.node`) |
| Host gate | `engines.dsh: ">=0.2.2-rc.1"` |
| Plugin version | `0.1.0` |
| Bundle type | Pure configuration (patch layer: `./cordis.patch.yml`) |
| Supported profile | `web` (desktop / headless profiles already ship `@deepseek-ai/dsh-*`) |
| License | MIT |

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

1. **No real-host composition test**: the build environment has no DSH runtime. This bundle is validated by static self-checks plus the official `dsh-v0.2.2-rc.1` tag contract only; please re-check `dsh --dump-config` and the real delegation chain on a host. `compatibility.json` records `runtimeVerification: "not executed (no DSH host in build environment)"`.
2. **Pure-configuration bundle**: no custom runtime tools, UI, or JS entry points; all capabilities depend on the `@deepseek-ai/dsh-*` packages shipped by the host profile.
3. **Token overhead**: the full SOP is injected as a persona `prefix` into the system prompt, so it is carried on every turn and increases per-turn token usage.
4. **Message topology**: DSH `send_message` only supports direct parent/child communication, so members cannot message each other directly. This happens to satisfy the original SOP rule ("all cross-member information flows are relayed by the lead"), but it also prevents lateral member-to-member negotiation.
5. **Do not overwrite the official `standard` preset**: this bundle only inserts new `sc-`-prefixed rows and never touches host top-level rows such as `agent-preset-registry`, `system-prompt`, `skill-filesystem`, `tool-skill`, `agent-loop`. Do not hand-edit it into a `replace`.
6. **Tool subset fully matches the official standard**: shell tools are conditionally disabled per host platform - `@deepseek-ai/dsh-tool-bash` on win32 and `@deepseek-ai/dsh-tool-pwsh` on non-win32, exactly like the official standard preset (`disabled` is evaluated in the patch layer via a `!!js` expression). Other tool config also matches the official standard: `tool-fs` disables `applyPatch`, `tool-fs-search` disables `sampleOverCapGlobResults`, `tool-todo` enables `allowParallelInProgress`, `tool-web` enables `fetch` with `searchTimeoutMs: 60000`, and `compaction-tool-result-pruner` sets `thresholdChars: 8192` / `headChars: 4096` / `tailChars: 1024`.
7. **Prompt variable interpolation**: DSH interpolates variables inside the persona `prefix`; unregistered variables break prompt assembly. All `prefix` blocks and `agents/*.md` bodies here are guaranteed free of the template-variable opener (two consecutive left curly braces) - do not introduce one when customizing.
8. **Node gate**: `engines.node: ">=24.9.0"` is required by DSH 0.2.2-rc.1. `scripts/verify.mjs` itself uses only Node built-ins, but please run it in an environment that satisfies the gate.

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
