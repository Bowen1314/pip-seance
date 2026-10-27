// The medium's kit: six small tools, all jailed to one workspace directory.
// Tests, conftest.py and pytest/tox/setup config are read-only: the original
// test suite is the oracle, so the agent may read it but never edit it.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { GHOSTS, PY313, PYTHON, REPO } from './config.js';

const run = promisify(execFile);
const PROTECTED = new Set(['conftest.py', 'pytest.ini', 'tox.ini', 'setup.cfg', 'pyproject.toml', 'sitecustomize.py', 'usercustomize.py']);
const TEST_DIRS = new Set(['test', 'tests', 'testing']);

export function isProtected(rel: string): boolean {
  const parts = rel.split(path.sep);
  const name = parts[parts.length - 1];
  if (PROTECTED.has(name) || name.endsWith('.pth')) return true;
  if (parts.slice(0, -1).some((p) => TEST_DIRS.has(p))) return true;
  return /^test.*\.py$/.test(name) || /_test\.py$/.test(name) || name === 'tests.py';
}

function clip(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n) + `\n... [${s.length - n} more chars cut]`;
}

export function makeTools(root: string, project: string, onTestRun?: (r: unknown) => void, guard?: () => string | null) {
  const resolve = (p: string) => {
    const abs = path.resolve(root, p);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`path escapes the workspace: ${p}`);
    if (fs.existsSync(abs) && fs.realpathSync(abs) !== abs && !fs.realpathSync(abs).startsWith(fs.realpathSync(root))) {
      throw new Error(`symlink escapes the workspace: ${p}`);
    }
    return abs;
  };

  const listFiles = createTool({
    id: 'list_files',
    description: 'List files under a directory of the package (recursive, max 200 entries). Test/config files are marked [read-only].',
    inputSchema: z.object({ dir: z.string().default('.') }),
    execute: async ({ dir }) => {
      const base = resolve(dir);
      const out: string[] = [];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (out.length >= 200 || ['.git', '__pycache__', '.seance-ok'].includes(e.name)) continue;
          const abs = path.join(d, e.name);
          const rel = path.relative(root, abs);
          if (e.isDirectory()) walk(abs);
          else out.push(rel + (isProtected(rel) ? '  [read-only]' : ''));
        }
      };
      walk(base);
      return { files: out.join('\n') };
    },
  });

  const readFile = createTool({
    id: 'read_file',
    description: 'Read a text file with line numbers. Optionally pass start/end line (1-based, inclusive). At most 150 lines per call.',
    inputSchema: z.object({ path: z.string(), start: z.number().int().optional(), end: z.number().int().optional() }),
    execute: async ({ path: p, start, end }) => {
      const lines = fs.readFileSync(resolve(p), 'utf8').split('\n');
      const s = Math.max(1, start ?? 1);
      const e = Math.min(lines.length, end ?? s + 149, s + 149);
      return {
        total_lines: lines.length,
        text: lines.slice(s - 1, e).map((l, i) => `${String(s + i).padStart(5)}  ${l}`).join('\n'),
      };
    },
  });

  const search = createTool({
    id: 'search',
    description: "Search the package's text files for a regular expression (JavaScript syntax, like grep -rnE). Returns up to 60 matching lines.",
    inputSchema: z.object({ pattern: z.string() }),
    execute: async ({ pattern }) => {
      let re: RegExp;
      try { re = new RegExp(pattern); } catch (e) { return { matches: `bad pattern: ${(e as Error).message}` }; }
      const hits: string[] = [];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (hits.length >= 60 || ['.git', '__pycache__'].includes(e.name)) continue;
          const abs = path.join(d, e.name);
          if (e.isDirectory()) walk(abs);
          else if (/\.(py|cfg|txt|ini|toml|rst|md)$/.test(e.name)) {
            fs.readFileSync(abs, 'utf8').split('\n').forEach((l, i) => {
              if (hits.length < 60 && re.test(l)) hits.push(`${path.relative(root, abs)}:${i + 1}: ${l.slice(0, 200)}`);
            });
          }
        }
      };
      walk(root);
      return { matches: hits.join('\n') || '(no matches)' };
    },
  });

  const editFile = createTool({
    id: 'edit_file',
    description: 'Replace one exact occurrence of old_text with new_text in a library file. old_text must match exactly once. Test and config files are read-only.',
    inputSchema: z.object({ path: z.string(), old_text: z.string(), new_text: z.string() }),
    execute: async ({ path: p, old_text, new_text }) => {
      const rel = path.relative(root, resolve(p));
      if (isProtected(rel)) return { ok: false, error: `${rel} is read-only (tests and test config are the judge).` };
      const abs = resolve(p);
      const src = fs.readFileSync(abs, 'utf8');
      const n = src.split(old_text).length - 1;
      if (n !== 1) return { ok: false, error: `old_text matched ${n} times; it must match exactly once.` };
      fs.writeFileSync(abs, src.replace(old_text, () => new_text));
      return { ok: true };
    },
  });

  const writeFile = createTool({
    id: 'write_file',
    description: 'Create or overwrite a whole library file. Prefer edit_file for small changes. Test and config files are read-only.',
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path: p, content }) => {
      const rel = path.relative(root, resolve(p));
      if (isProtected(rel)) return { ok: false, error: `${rel} is read-only (tests and test config are the judge).` };
      fs.mkdirSync(path.dirname(resolve(p)), { recursive: true });
      fs.writeFileSync(resolve(p), content);
      return { ok: true };
    },
  });

  const runTests = createTool({
    id: 'run_tests',
    description: "Run the package's original test suite on Python 3.13. Reports how many of the target tests (the ones that passed on Python 3.8) pass now, which still fail, and the end of pytest's output.",
    inputSchema: z.object({}),
    execute: async () => {
      const { stdout } = await run(PYTHON, [
        path.join(REPO, 'seance', 'verify.py'), '--ghost', GHOSTS, '--project', project,
        '--root', root, '--python', PY313, '--brief',
      ], { maxBuffer: 16 << 20, timeout: 240_000 });
      const r = JSON.parse(stdout);
      onTestRun?.(r);
      return { ...r, pytest_tail: clip(r.pytest_tail ?? '', 1800) };
    },
  });

  const tools = { list_files: listFiles, read_file: readFile, search, edit_file: editFile, write_file: writeFile, run_tests: runTests };
  // Budget guard: once the run is over its dollar cap, every tool refuses, so
  // the agent cannot keep working even if the loop itself does not stop.
  for (const t of Object.values(tools) as any[]) {
    const orig = t.execute;
    t.execute = async (input: unknown, ctx: unknown) => {
      const refusal = guard?.();
      return refusal ? { ok: false, error: refusal } : orig(input, ctx);
    };
  }
  return tools;
}
