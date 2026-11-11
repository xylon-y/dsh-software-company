/**
 * Static self-check for the dsh-software-company bundle.
 *
 * Zero third-party dependencies: run with `node scripts/verify.mjs`.
 * Prints one PASS/FAIL line per check plus a summary, and sets
 * process.exitCode = 1 when any check fails.
 *
 * The YAML is intentionally parsed with small, purpose-built text extractors
 * rather than a YAML library, so the verifier itself stays dependency-free.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Canonical preset table; must stay in sync with cordis.patch.yml. */
const PRESETS = [
  { rowId: 'sc-preset-lead', presetId: 'software-company-lead', file: 'agents/software-team-lead.md', order: 10, lead: true },
  { rowId: 'sc-preset-product-manager', presetId: 'software-company-product-manager', file: 'agents/software-product-manager.md', order: 11, lead: false },
  { rowId: 'sc-preset-architect', presetId: 'software-company-architect', file: 'agents/software-architect.md', order: 12, lead: false },
  { rowId: 'sc-preset-engineer', presetId: 'software-company-engineer', file: 'agents/software-engineer.md', order: 13, lead: false },
  { rowId: 'sc-preset-qa-engineer', presetId: 'software-company-qa-engineer', file: 'agents/software-qa-engineer.md', order: 14, lead: false },
];

const TOOL_NAMES = ['delegate_to_pm', 'delegate_to_architect', 'delegate_to_engineer', 'delegate_to_qa'];
const HOST_RESERVED_IDS = [
  'agent-preset-registry', 'system-prompt', 'skill-filesystem', 'tool-skill',
  'agent-loop', 'persona', 'default', 'standard', 'delegation', 'compaction',
];
const LEGACY_NAMES = /\b(Alice|Bob|Alex|Edward)\b/g;
const WORKBUDDY_MECHANISMS = ['TeamCreate', 'subagent_type', 'TaskCreate', 'Agent(name=', 'shutdown_request'];

/**
 * Authoritative @deepseek-ai/dsh-* package names for DSH 0.2.2-rc.1.
 *
 * SOURCE: packages/bundle/web-app/presets/standard.patch.yml @ tag dsh-v0.2.2-rc.1
 * (the official DeepSeek Harness web-app standard preset).
 *
 * This is a hardcoded copy of the official package set. When the host adds,
 * renames, or removes a package, this table MUST be updated in the same change:
 * a stale table either rejects a valid package or waves a typo through. Any
 * plugin `name:` outside this set (and outside the `cordis:group` sentinel)
 * fails verification, so a package name can never be "guessed by pattern".
 */
const AUTHORITATIVE_PACKAGES = [
  'persona', 'agent-instructions', 'time-context', 'tool-bash', 'tool-pwsh',
  'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-schedule', 'skill-filesystem',
  'tool-skill', 'command-goal', 'tool-goal', 'plan-mode', 'compaction-basic',
  'command-compact', 'compaction-tool-result-pruner', 'tool-subagent-control',
  'tool-subagent', 'workflow-ptc', 'tool-workflow', 'tool-ask-user', 'tool-todo',
  'tool-web', 'tool-present', 'plugin-manager/tools', 'plugin-market/tools',
];
const ALLOWED_PLUGIN_NAMES = new Set([
  ...AUTHORITATIVE_PACKAGES.map((name) => `@deepseek-ai/dsh-${name}`),
  'cordis:group',
]);

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

function exists(rel) {
  return existsSync(join(ROOT, rel));
}

function record(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error && error.message ? error.message : String(error) });
  }
}

/** Canonical form shared with the patch generator. */
function normalize(text) {
  const lines = text.split('\n').map((line) => line.replace(/[ \t]+$/g, ''));
  while (lines.length && lines[0] === '') {
    lines.shift();
  }
  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.join('\n');
}

/** Returns the raw frontmatter body of a Markdown document. */
function frontmatter(text) {
  const lines = text.split('\n');
  assert(lines[0].trim() === '---', 'frontmatter must start with ---');
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  assert(end > 0, 'unterminated frontmatter');
  return lines.slice(1, end).join('\n');
}

/** Returns the Markdown body after the closing frontmatter delimiter. */
function bodyOf(text) {
  const lines = text.split('\n');
  assert(lines[0].trim() === '---', 'frontmatter must start with ---');
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  assert(end > 0, 'unterminated frontmatter');
  return lines.slice(end + 1).join('\n');
}

/**
 * Extracts every YAML literal `prefix: |` block, de-indenting it the same way
 * a YAML parser would (common minimal indentation of non-empty lines).
 */
function extractPrefixes(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*)prefix:\s*\|\s*$/);
    if (!match) {
      continue;
    }
    const baseIndent = match[1].length;
    const buffer = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === '') {
        buffer.push(line);
        continue;
      }
      const indent = line.match(/^ */)[0].length;
      if (indent <= baseIndent) {
        break;
      }
      buffer.push(line);
    }
    const nonEmpty = buffer.filter((line) => line.trim() !== '');
    assert(nonEmpty.length > 0, `empty prefix block at line ${i + 1}`);
    const blockIndent = Math.min(...nonEmpty.map((line) => line.match(/^ */)[0].length));
    const body = buffer
      .map((line) => (line.length >= blockIndent ? line.slice(blockIndent) : ''))
      .join('\n');
    blocks.push({ body, line: i + 1 });
    i = j - 1;
  }
  return blocks;
}

/** Splits the patch into one chunk per top-level `sc-preset-*` row. */
function splitPresets(text) {
  const lines = text.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^ {4}- id: sc-preset-/.test(lines[i])) {
      starts.push(i);
    }
  }
  const blocks = new Map();
  for (let k = 0; k < starts.length; k += 1) {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const chunk = lines.slice(starts[k], end).join('\n');
    const idMatch = chunk.match(/^ {4}- id:\s*(\S+)/m);
    assert(idMatch, `cannot read row id at line ${starts[k] + 1}`);
    blocks.set(idMatch[1], chunk);
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// (a) package.json
// ---------------------------------------------------------------------------
record('a1 package.json 可解析且必填字段齐全', () => {
  const pkg = JSON.parse(read('package.json'));
  const required = ['name', 'version', 'type', 'description', 'license', 'repository', 'homepage', 'keywords', 'engines', 'files', 'exports', 'dsh'];
  for (const key of required) {
    assert(Object.prototype.hasOwnProperty.call(pkg, key), `missing field: ${key}`);
  }
  assert(pkg.name === 'dsh-software-company', `name mismatch: ${pkg.name}`);
  assert(pkg.version === '0.1.0', `version mismatch: ${pkg.version}`);
  assert(pkg.type === 'module', 'type must be module');
  assert(pkg.license === 'MIT', 'license must be MIT');
  assert(String(pkg.repository.url || '').includes('xylon-y/dsh-software-company'), 'repository url mismatch');
  assert(String(pkg.homepage).includes('xylon-y/dsh-software-company'), 'homepage mismatch');
  for (const keyword of ['dsh-plugin', 'deepseek-harness', 'dsh', 'agent-preset', 'multi-agent']) {
    assert(pkg.keywords.includes(keyword), `missing keyword: ${keyword}`);
  }
  assert(pkg.exports['./cordis.patch.yml'] === './cordis.patch.yml', 'exports must expose ./cordis.patch.yml');
  assert(pkg.exports['./package.json'] === './package.json', 'exports must expose ./package.json');
  assert(Object.keys(pkg.exports).length === 2, 'exports must expose exactly 2 entries');
  return `name=${pkg.name} version=${pkg.version} exports=2`;
});

record('a2 engines.dsh / engines.node 版本门控', () => {
  const pkg = JSON.parse(read('package.json'));
  assert(typeof pkg.engines.dsh === 'string' && pkg.engines.dsh.includes('0.2.2-rc.1'), 'engines.dsh must contain 0.2.2-rc.1');
  assert(typeof pkg.engines.node === 'string' && pkg.engines.node.includes('24.9'), 'engines.node must require >= 24.9');
  assert(pkg.engines.node === '>=24.9.0', `engines.node exact value: ${pkg.engines.node}`);
  assert(pkg.engines.dsh === '>=0.2.2-rc.1', `engines.dsh exact value: ${pkg.engines.dsh}`);
  return `node=${pkg.engines.node} dsh=${pkg.engines.dsh}`;
});

record('a3 dsh.bundle.patch 指向文件存在', () => {
  const pkg = JSON.parse(read('package.json'));
  const patch = pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch;
  assert(patch === './cordis.patch.yml', `unexpected patch path: ${patch}`);
  assert(exists('cordis.patch.yml'), 'cordis.patch.yml missing');
  return patch;
});

record('a4 files 清单中每个文件都存在', () => {
  const pkg = JSON.parse(read('package.json'));
  assert(Array.isArray(pkg.files) && pkg.files.length > 0, 'files must be a non-empty array');
  for (const entry of pkg.files) {
    assert(exists(entry), `listed file missing: ${entry}`);
  }
  assert(pkg.files.includes('cordis.patch.yml'), 'files must list cordis.patch.yml');
  return `${pkg.files.length} entries verified`;
});

record('a5 无 dependencies / peerDependencies / main', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const key of ['dependencies', 'peerDependencies', 'main', 'types']) {
    assert(!Object.prototype.hasOwnProperty.call(pkg, key), `forbidden field: ${key}`);
  }
  assert(!Object.prototype.hasOwnProperty.call(pkg, 'scripts'), 'package.json must not declare build/run scripts');
  return 'clean';
});

// ---------------------------------------------------------------------------
// (b) cordis.patch.yml top-level structure
// ---------------------------------------------------------------------------
record('b1 patch 顶层恰有一个 - insert:', () => {
  const text = read('cordis.patch.yml');
  const inserts = text.match(/^- insert:\s*$/gm) || [];
  assert(inserts.length === 1, `expected 1 top-level "- insert:", found ${inserts.length}`);
  const operations = text.match(/^- (insert|remove|replace|merge):/gm) || [];
  assert(operations.length === 1, `unexpected extra top-level operations: ${operations.join(', ')}`);
  return '1';
});

record('b2 恰有 5 个 @deepseek-ai/dsh-agent-preset 声明行', () => {
  const text = read('cordis.patch.yml');
  const declarations = text.match(/name:\s*'@deepseek-ai\/dsh-agent-preset'/g) || [];
  assert(declarations.length === 5, `expected 5 preset rows, found ${declarations.length}`);
  return `${declarations.length}`;
});

record('b3 行 id 唯一 + sc- 前缀 + 不与宿主保留 id 冲突', () => {
  const text = read('cordis.patch.yml');
  const ids = [...text.matchAll(/^ {4}- id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  assert(ids.length === 5, `expected 5 row ids, found ${ids.length}`);
  assert(new Set(ids).size === 5, 'row ids are not unique');
  for (const id of ids) {
    assert(id.startsWith('sc-'), `row id must start with sc-: ${id}`);
    assert(!HOST_RESERVED_IDS.includes(id), `row id collides with host reserved id: ${id}`);
  }
  const expected = PRESETS.map((p) => p.rowId);
  assert(ids.every((id, i) => id === expected[i]), `row id order mismatch: ${ids.join(', ')}`);
  return ids.join(', ');
});

// ---------------------------------------------------------------------------
// (c) preset ids, agentPreset, toolName, delegation topology
// ---------------------------------------------------------------------------
record('c1 5 个 config.id 唯一且符合预期顺序', () => {
  const text = read('cordis.patch.yml');
  const ids = [...text.matchAll(/^ {8}id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  assert(ids.length === 5, `expected 5 config ids, found ${ids.length}`);
  assert(new Set(ids).size === 5, 'config ids are not unique');
  const expected = PRESETS.map((p) => p.presetId);
  assert(ids.every((id, i) => id === expected[i]), `config id mismatch/order: ${ids.join(', ')}`);
  return ids.join(', ');
});

record('c2 所有 agentPreset 值都在 config.id 集合内', () => {
  const text = read('cordis.patch.yml');
  const values = [...text.matchAll(/agentPreset:\s*(\S+)/g)].map((m) => m[1]);
  assert(values.length === 4, `expected 4 agentPreset values, found ${values.length}`);
  const allowed = new Set(PRESETS.map((p) => p.presetId));
  for (const value of values) {
    assert(allowed.has(value), `unknown agentPreset: ${value}`);
  }
  assert(!allowed.has('software-company-lead') || !values.includes('software-company-lead'), 'lead preset must not be a delegation target');
  return values.join(', ');
});

record('c3 toolName 全局唯一且为 4 个具名委派工具', () => {
  const text = read('cordis.patch.yml');
  const names = [...text.matchAll(/toolName:\s*(\S+)/g)].map((m) => m[1]);
  assert(names.length === 4, `expected 4 toolName values, found ${names.length}`);
  assert(new Set(names).size === 4, 'toolName values are not globally unique');
  assert(names.every((name, i) => name === TOOL_NAMES[i]), `toolName mismatch/order: ${names.join(', ')}`);
  return names.join(', ');
});

record('c4 仅 lead 有 4 个 spawn 委派实例，成员只挂 control', () => {
  const text = read('cordis.patch.yml');
  const blocks = splitPresets(text);
  const spawnRe = /name:\s*'@deepseek-ai\/dsh-tool-subagent'\s*$/gm;
  const controlRe = /name:\s*'@deepseek-ai\/dsh-tool-subagent-control'/g;
  for (const preset of PRESETS) {
    const chunk = blocks.get(preset.rowId);
    assert(chunk, `missing preset block: ${preset.rowId}`);
    const spawnCount = (chunk.match(spawnRe) || []).length;
    const controlCount = (chunk.match(controlRe) || []).length;
    assert(controlCount === 1, `${preset.rowId}: expected exactly 1 subagent-control, found ${controlCount}`);
    if (preset.lead) {
      assert(spawnCount === 4, `lead must declare 4 spawn subagent instances, found ${spawnCount}`);
      assert((chunk.match(/provider:\s*spawn/g) || []).length === 4, 'lead must declare provider spawn exactly 4 times');
      assert((chunk.match(/maxDepth:\s*1/g) || []).length === 4, 'lead must declare maxDepth 1 exactly 4 times');
      assert(!/provider:\s*fork/.test(chunk), 'lead must not declare a fork provider');
    } else {
      assert(spawnCount === 0, `${preset.rowId}: member preset must NOT contain spawn subagent instances`);
      assert(!/provider:\s*spawn/.test(chunk), `${preset.rowId}: member preset must not declare provider spawn`);
      assert(!/agentPreset:/.test(chunk), `${preset.rowId}: member preset must not declare agentPreset`);
      assert(!/toolName:/.test(chunk), `${preset.rowId}: member preset must not declare toolName`);
    }
  }
  return 'lead=4 spawn, members=0 spawn';
});

// ---------------------------------------------------------------------------
// (d) prompt interpolation safety + DSH conversion hygiene
// ---------------------------------------------------------------------------
record('d1 所有 persona prefix 块不含模板变量起始符', () => {
  const text = read('cordis.patch.yml');
  const prefixes = extractPrefixes(text);
  assert(prefixes.length === 5, `expected 5 prefix blocks, found ${prefixes.length}`);
  for (const block of prefixes) {
    assert(!block.body.includes(String.fromCharCode(123, 123)), `prefix at line ${block.line} contains a template-variable opener`);
  }
  return `${prefixes.length} blocks clean`;
});

record('d2 agents 正文不含模板变量起始符', () => {
  for (const preset of PRESETS) {
    const body = bodyOf(read(preset.file));
    assert(!body.includes(String.fromCharCode(123, 123)), `${preset.file} contains a template-variable opener`);
  }
  return '5 files clean';
});

record('d3 旧英文名已统一为 plugin.json 花名', () => {
  const text = read('cordis.patch.yml');
  const combined = [text, ...PRESETS.map((p) => read(p.file))].join('\n');
  const found = combined.match(LEGACY_NAMES) || [];
  assert(found.length === 0, `legacy names remain: ${[...new Set(found)].join(', ')}`);
  assert(read('agents/software-team-lead.md').includes('齐活林'), 'lead document must name 齐活林');
  return 'clean';
});

record('d4 WorkBuddy 专有机制描述已清理', () => {
  const targets = ['cordis.patch.yml', ...PRESETS.map((p) => p.file)];
  for (const rel of targets) {
    const content = rel.endsWith('.md') ? bodyOf(read(rel)) : read(rel);
    for (const word of WORKBUDDY_MECHANISMS) {
      assert(!content.includes(word), `${rel} still mentions ${word}`);
    }
  }
  return 'clean';
});

// ---------------------------------------------------------------------------
// (e) verbatim persona prefix == agent document body
// ---------------------------------------------------------------------------
record('e1 5 个 prefix 与对应 agents MD 正文逐字一致', () => {
  const text = read('cordis.patch.yml');
  const prefixes = extractPrefixes(text);
  assert(prefixes.length === PRESETS.length, `prefix count ${prefixes.length} != preset count ${PRESETS.length}`);
  for (let i = 0; i < PRESETS.length; i += 1) {
    const fromPatch = normalize(prefixes[i].body);
    const fromMarkdown = normalize(bodyOf(read(PRESETS[i].file)));
    assert(fromPatch === fromMarkdown, `prefix #${i + 1} differs from ${PRESETS[i].file}`);
  }
  return '5/5 exact match';
});

// ---------------------------------------------------------------------------
// (f) agent frontmatter
// ---------------------------------------------------------------------------
record('f1 frontmatter name 与 preset id 对应且有 description', () => {
  for (const preset of PRESETS) {
    const fm = frontmatter(read(preset.file));
    const name = fm.match(/^name:\s*(.+)\s*$/m);
    const description = fm.match(/^description:\s*(.+)\s*$/m);
    assert(name, `${preset.file} missing frontmatter name`);
    assert(description, `${preset.file} missing frontmatter description`);
    assert(name[1].trim() === preset.presetId, `${preset.file} name=${name[1].trim()} != ${preset.presetId}`);
    assert(description[1].trim().length > 0, `${preset.file} empty description`);
  }
  return '5/5 aligned';
});

// ---------------------------------------------------------------------------
// (g) optional skill
// ---------------------------------------------------------------------------
record('g1 SKILL.md frontmatter name kebab-case + description + whenToUse', () => {
  const text = read('skills/software-company-sop/SKILL.md');
  const fm = frontmatter(text);
  const name = fm.match(/^name:\s*(.+)\s*$/m);
  const description = fm.match(/^description:\s*(.+)\s*$/m);
  const whenToUse = fm.match(/^whenToUse:\s*(.+)\s*$/m);
  assert(name, 'SKILL.md missing name');
  assert(description, 'SKILL.md missing description');
  assert(whenToUse, 'SKILL.md missing whenToUse');
  assert(name[1].trim() === 'software-company-sop', `skill name mismatch: ${name[1].trim()}`);
  assert(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name[1].trim()), `name not kebab-case: ${name[1].trim()}`);
  assert(description[1].trim().length > 0, 'SKILL.md description empty');
  return name[1].trim();
});

record('g2 SKILL.md 全文 < 8192 字符', () => {
  const text = read('skills/software-company-sop/SKILL.md');
  assert(text.length < 8192, `SKILL.md length ${text.length} >= 8192`);
  return `${text.length} chars`;
});

// ---------------------------------------------------------------------------
// (h) README install command + target version
// ---------------------------------------------------------------------------
for (const [id, rel] of [['h1', 'README.md'], ['h2', 'README.en.md']]) {
  record(`${id} ${rel} 含安装命令与 0.2.2-rc.1`, () => {
    const text = read(rel);
    assert(text.includes('github:xylon-y/dsh-software-company'), `${rel} missing install command`);
    assert(text.includes('0.2.2-rc.1'), `${rel} missing target version`);
    assert(text.includes('node scripts/verify.mjs'), `${rel} missing verify command`);
    assert(text.includes('--dump-config'), `${rel} missing --dump-config self-check`);
    return 'install + version + verify + dump-config';
  });
}

// ---------------------------------------------------------------------------
// extra cross-file consistency checks
// ---------------------------------------------------------------------------
record('i1 每个 preset 的 plugins[0] 为 persona 且 delegation group 正确', () => {
  const text = read('cordis.patch.yml');
  const blocks = splitPresets(text);
  const personas = text.match(/name:\s*'@deepseek-ai\/dsh-persona'/g) || [];
  assert(personas.length === 5, `expected 5 persona plugins, found ${personas.length}`);
  for (const preset of PRESETS) {
    const chunk = blocks.get(preset.rowId);
    assert(/^ {10}- id: persona$/m.test(chunk), `${preset.rowId}: plugins[0] must be persona`);
    assert(/^ {14}prefix:\s*\|\s*$/m.test(chunk), `${preset.rowId}: persona prefix block missing`);
    assert(/isolate:[ \t]*\n[ \t]+workflowEngine:[ \t]*true/.test(chunk), `${preset.rowId}: delegation isolate missing`);
    assert(/^ {10}- id: delegation$/m.test(chunk), `${preset.rowId}: delegation group missing`);
  }
  return '5/5';
});

record('i2 order 为 10/11/12/13/14', () => {
  const text = read('cordis.patch.yml');
  const orders = [...text.matchAll(/^ {8}order:\s*(\d+)\s*$/gm)].map((m) => Number(m[1]));
  assert(orders.length === 5, `expected 5 order values, found ${orders.length}`);
  const expected = PRESETS.map((p) => p.order);
  assert(orders.every((v, i) => v === expected[i]), `order mismatch: ${orders.join(', ')}`);
  return orders.join(', ');
});

record('i3 通用工具子集与 compaction group 齐全（官方包名）', () => {
  const text = read('cordis.patch.yml');
  const packages = [
    '@deepseek-ai/dsh-agent-instructions', '@deepseek-ai/dsh-time-context',
    '@deepseek-ai/dsh-tool-bash', '@deepseek-ai/dsh-tool-pwsh',
    '@deepseek-ai/dsh-tool-fs', '@deepseek-ai/dsh-tool-fs-search',
    '@deepseek-ai/dsh-tool-jobs', '@deepseek-ai/dsh-skill-filesystem',
    '@deepseek-ai/dsh-tool-skill', '@deepseek-ai/dsh-tool-todo',
    '@deepseek-ai/dsh-tool-web', '@deepseek-ai/dsh-tool-present',
    '@deepseek-ai/dsh-compaction-basic', '@deepseek-ai/dsh-command-compact',
    '@deepseek-ai/dsh-compaction-tool-result-pruner',
  ];
  for (const name of packages) {
    const count = (text.match(new RegExp(`name: '${name}'`, 'g')) || []).length;
    assert(count === 5, `${name} expected in all 5 presets, found ${count}`);
  }
  assert(/maxBytes:\s*65536/.test(text), 'agent-instructions maxBytes missing');
  assert(/applyPatch:\s*false/.test(text), 'tool-fs applyPatch false missing');
  assert(/sampleOverCapGlobResults:\s*false/.test(text), 'tool-fs-search sampleOverCapGlobResults missing');
  assert(/allowParallelInProgress:\s*true/.test(text), 'tool-todo allowParallelInProgress missing');
  assert(/fetch:\s*true/.test(text), 'tool-web fetch true missing');
  assert(/searchTimeoutMs:\s*60000/.test(text), 'tool-web searchTimeoutMs missing');
  assert((text.match(/thresholdChars:\s*8192/g) || []).length === 5, 'compaction-tool-result-pruner thresholdChars missing');
  assert((text.match(/headChars:\s*4096/g) || []).length === 5, 'compaction-tool-result-pruner headChars missing');
  assert((text.match(/tailChars:\s*1024/g) || []).length === 5, 'compaction-tool-result-pruner tailChars missing');
  return `${packages.length} packages x 5 presets`;
});

record('i4 所有插件包名命中官方白名单（禁止按模式推断）', () => {
  const text = read('cordis.patch.yml');
  // Child and group entry names live at indentation >= 12 and are single-quoted;
  // the preset declaration (indent 6) and the display name (indent 8) are excluded.
  const names = [...text.matchAll(/^ {12,}name:\s*'([^']+)'\s*$/gm)].map((m) => m[1].trim());
  assert(names.length > 0, 'no child plugin names found');
  const unknown = [...new Set(names)].filter((name) => !ALLOWED_PLUGIN_NAMES.has(name));
  assert(unknown.length === 0, `package names outside authoritative list: ${unknown.join(', ')}`);
  return `${new Set(names).size} unique names all whitelisted`;
});

record('i5 shell 工具按宿主平台条件禁用（与官方 standard 一致）', () => {
  const text = read('cordis.patch.yml');
  const blocks = splitPresets(text);
  const bashRe = /disabled:\s*!!js\s+process\.platform\s*===\s*'win32'/;
  const pwshRe = /disabled:\s*!!js\s+process\.platform\s*!==\s*'win32'/;
  for (const preset of PRESETS) {
    const chunk = blocks.get(preset.rowId);
    assert(bashRe.test(chunk), `${preset.rowId}: tool-bash platform-conditional disabled missing`);
    assert(pwshRe.test(chunk), `${preset.rowId}: tool-pwsh platform-conditional disabled missing`);
  }
  assert((text.match(/!!js process\.platform === 'win32'/g) || []).length === 5, 'tool-bash disabled expr count != 5');
  assert((text.match(/!!js process\.platform !== 'win32'/g) || []).length === 5, 'tool-pwsh disabled expr count != 5');
  return 'bash/pwsh conditional in 5/5 presets';
});

record('i6 compaction-tool-result-pruner 出现 5 次且无旧包名', () => {
  const text = read('cordis.patch.yml');
  const count = (text.match(/name:\s*'@deepseek-ai\/dsh-compaction-tool-result-pruner'/g) || []).length;
  assert(count === 5, `expected 5 compaction-tool-result-pruner, found ${count}`);
  assert(!text.includes(`'@deepseek-ai/dsh-tool-result-pruner'`), 'legacy @deepseek-ai/dsh-tool-result-pruner package name still present');
  return `${count}`;
});

record('i7 compaction group 均含 isolate（compaction + toolResultPruner）', () => {
  const lines = read('cordis.patch.yml').split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === '          - id: compaction') {
      starts.push(i);
    }
  }
  assert(starts.length === 5, `expected 5 compaction groups, found ${starts.length}`);
  for (const start of starts) {
    const block = lines.slice(start, start + 10);
    assert(block.includes('            group: true'), `compaction at line ${start + 1}: group: true missing`);
    assert(block.includes('            isolate:'), `compaction at line ${start + 1}: isolate block missing`);
    assert(block.includes('              compaction: true'), `compaction at line ${start + 1}: isolate.compaction missing`);
    assert(block.includes('              toolResultPruner: true'), `compaction at line ${start + 1}: isolate.toolResultPruner missing`);
    assert(block.indexOf('            isolate:') < block.indexOf('            config:'), `compaction at line ${start + 1}: isolate must precede config`);
  }
  return '5/5 compaction groups isolated';
});

record('i8 delegation group 均含 isolate.workflowEngine', () => {
  const lines = read('cordis.patch.yml').split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === '          - id: delegation') {
      starts.push(i);
    }
  }
  assert(starts.length === 5, `expected 5 delegation groups, found ${starts.length}`);
  for (const start of starts) {
    const block = lines.slice(start, start + 10);
    assert(block.includes('            isolate:'), `delegation at line ${start + 1}: isolate block missing`);
    assert(block.includes('              workflowEngine: true'), `delegation at line ${start + 1}: isolate.workflowEngine missing`);
  }
  return '5/5 delegation groups isolated';
});

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
let passed = 0;
for (const item of results) {
  const tag = item.ok ? 'PASS' : 'FAIL';
  const suffix = item.detail ? ` - ${item.detail}` : '';
  console.log(`[${tag}] ${item.name}${suffix}`);
  if (item.ok) {
    passed += 1;
  }
}
console.log('');
console.log(`Summary: ${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log('RESULT: FAIL');
  process.exitCode = 1;
} else {
  console.log('RESULT: PASS');
}
