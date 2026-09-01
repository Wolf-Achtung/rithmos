/**
 * Guard: engine/ must stay free of framework, I/O and provider imports.
 * This test reads every non-test source file under engine/ and fails
 * as soon as one of the forbidden modules is imported or required.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ENGINE_DIR = join(__dirname, '..');

const FORBIDDEN: RegExp[] = [
  /^react$/,
  /^react\//,
  /^react-dom/,
  /^react-native/,
  /^expo/,
  /^fs$/,
  /^node:fs/,
  /^fs\//,
  /^http$/,
  /^https$/,
  /^node:http/,
  /^node:https/,
  /^net$/,
  /^node:net/,
  /^child_process$/,
  /^node:child_process/,
  /^pg$/,
  /^@anthropic-ai\//,
  /^openai$/,
  /^@openai\//,
  /^@google\/generative-ai/,
  /^@mistralai\//,
  /^cohere/,
  /^ollama/,
  /^axios$/,
  /^node-fetch$/,
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'bench' || entry === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.(test|bench)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function importedModules(code: string): string[] {
  const modules: string[] = [];
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) modules.push(m[1]!);
  }
  return modules;
}

describe('engine import guard', () => {
  const files = sourceFiles(ENGINE_DIR);

  it('finds engine source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${relative(ENGINE_DIR, file)} imports nothing forbidden`, () => {
      const mods = importedModules(readFileSync(file, 'utf8'));
      const bad = mods.filter((m) => FORBIDDEN.some((re) => re.test(m)));
      expect(bad).toEqual([]);
    });
  }

  it('the guard itself recognises forbidden modules', () => {
    const sample = `import React from 'react';\nimport { readFileSync } from 'node:fs';\nconst h = require('http');`;
    const bad = importedModules(sample).filter((m) => FORBIDDEN.some((re) => re.test(m)));
    expect(bad).toEqual(['react', 'node:fs', 'http']);
  });
});
