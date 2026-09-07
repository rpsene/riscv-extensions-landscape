#!/usr/bin/env node
/**
 * Report what riscv-unified-db has that this catalogue does not.
 *
 *   node scripts/check-udb-completeness.mjs <path-to-riscv-unified-db> [--json]
 *
 * The decision logic lives in src/completeness.js, which takes no I/O so it can
 * be tested without a checkout. This file only reads YAML and prints.
 *
 * Reports; does not fail. A gate that goes red the day upstream ratifies
 * something is a gate people turn off, and the daily sync workflow is a better
 * place to act on the result than a build.
 *
 * Why this exists: scripts/sync_udb_extensions.cjs iterates OUR catalogue, so
 * it enriches entries we already have and can never add one we lack. Nothing
 * watched the other direction until now.
 */

import fs from 'node:fs';
import path from 'node:path';
import { compareAgainstUpstream } from '../src/completeness.js';

const udbRoot = process.argv[2];
const asJson = process.argv.includes('--json');

if (!udbRoot || !fs.existsSync(udbRoot)) {
  console.error('usage: node scripts/check-udb-completeness.mjs <path-to-riscv-unified-db>');
  process.exit(2);
}

const specDir = path.join(udbRoot, 'spec', 'std', 'isa');
for (const d of ['ext', 'inst']) {
  if (!fs.existsSync(path.join(specDir, d))) {
    console.error(`error: ${path.join(specDir, d)} does not exist. Is this a unified-db checkout?`);
    process.exit(2);
  }
}

/*
 * A deliberately small YAML reader, matching the one already in
 * sync_udb_extensions.cjs: only the few scalar keys needed here, no dependency.
 * If unified-db restructures, the sanity floor below fails loudly rather than
 * reporting a clean run against nothing.
 */
const readScalars = (file, keys) => {
  const out = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const key of keys) {
    const m = text.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, 'm'));
    if (m) out[key] = m[1].replace(/^["']|["']$/g, '');
  }
  /*
   * definedBy is a nested block, in one of two shapes:
   *
   *   definedBy:            definedBy:
   *     extension:            extension:
   *       name: I               anyOf:
   *                               - name: Zbb
   *                               - name: Zbkb
   *
   * Capture every indented line under it, up to the next key at column zero,
   * then take each `name:`. An earlier version terminated on /$/m, which in
   * multiline mode is the end of the FIRST line, so it captured nothing and
   * every instruction came back unowned.
   */
  const defined = text.match(/^definedBy:\n([\s\S]*?)(?=^\S)/m);
  out.definedBy = defined
    ? [...defined[1].matchAll(/name:\s*([A-Za-z0-9_.]+)/g)].map((x) => x[1])
    : [];
  return out;
};

const extDir = path.join(specDir, 'ext');
const extensions = [];
const ratifiedExtensions = [];
for (const file of fs.readdirSync(extDir).filter((f) => f.endsWith('.yaml'))) {
  const id = file.replace(/\.yaml$/, '');
  extensions.push(id);
  /*
   * "Ever ratified": an extension qualifies if ANY of its versions reached
   * ratified, even where a later one is frozen. unified-db lists a state per
   * version, so this reads them all rather than the first.
   */
  const text = fs.readFileSync(path.join(extDir, file), 'utf8');
  if (/^\s*state:\s*ratified\s*$/m.test(text)) ratifiedExtensions.push(id);
}

const instructions = [];
const instRoot = path.join(specDir, 'inst');
for (const dir of fs.readdirSync(instRoot)) {
  const sub = path.join(instRoot, dir);
  if (!fs.statSync(sub).isDirectory()) continue;
  for (const file of fs.readdirSync(sub).filter((f) => f.endsWith('.yaml'))) {
    const y = readScalars(path.join(sub, file), ['name', 'match']);
    const mnemonic = (y.name || file.replace(/\.yaml$/, '')).toUpperCase();
    // UDB gives an encoding string of 0/1/- rather than match/mask.
    const text = fs.readFileSync(path.join(sub, file), 'utf8');
    const enc = text.match(/^\s*match:\s*([01-]+)\s*$/m);
    if (!enc) continue;
    const bits = enc[1];
    let match = 0n;
    let mask = 0n;
    for (const ch of bits) {
      match <<= 1n;
      mask <<= 1n;
      if (ch === '1') {
        match |= 1n;
        mask |= 1n;
      } else if (ch === '0') {
        mask |= 1n;
      }
    }
    instructions.push({
      mnemonic,
      match,
      mask,
      // Fall back to the directory only when the file names no owner. An empty
      // array is truthy, so `|| [dir]` silently kept the empty list.
      definedBy: y.definedBy.length ? y.definedBy : [dir],
    });
  }
}

// Sanity floor: a parser that silently matches nothing would report a perfect
// catalogue, which is the most dangerous possible output for this tool.
if (extensions.length < 100 || instructions.length < 500) {
  console.error(
    `error: parsed only ${extensions.length} extensions and ${instructions.length} instructions. ` +
      'unified-db has likely restructured; refusing to report a clean run.',
  );
  process.exit(2);
}

const catalogue = JSON.parse(
  fs.readFileSync(new URL('../src/riscv_extensions.json', import.meta.url), 'utf8'),
);
/*
 * unified-db attributes the base integer instructions to a bare `I`. This
 * catalogue models the concrete bases instead, RV32I and RV64I, which is the
 * distinction a reader building an -march string actually needs. The alias
 * keeps that modelling choice from reading as 300 missing instructions.
 */
const EXTENSION_ALIASES = { I: ['RV32I', 'RV64I', 'RV32E', 'RV64E'] };

const result = compareAgainstUpstream(
  catalogue,
  { extensions, instructions },
  {
    extensionAliases: EXTENSION_ALIASES,
    allowMissingExtensions: Object.keys(EXTENSION_ALIASES),
    // Default to the question the catalogue exists to answer. --all widens it
    // to everything upstream carries, which is useful for seeing what is coming
    // but is not a completeness failure.
    onlyRatified: !process.argv.includes('--all'),
    ratifiedExtensions,
  },
);

if (asJson) {
  console.log(JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  process.exit(0);
}

const list = (rows, f) =>
  rows
    .map(f)
    .map((s) => `    ${s}`)
    .join('\n');

const scope = process.argv.includes('--all') ? 'all upstream' : 'ratified only';
console.log(
  `unified-db: ${extensions.length} extensions ` +
    `(${ratifiedExtensions.length} ever ratified), ${instructions.length} instructions`,
);
console.log(`scope: ${scope}   (pass --all to include draft and in-development work)`);
console.log(`catalogue:  ${Object.values(catalogue).flat().filter(Boolean).length} extensions\n`);

console.log(`missing extensions (${result.missingExtensions.length}):`);
console.log(
  result.missingExtensions.length ? list(result.missingExtensions, (x) => x) : '    none',
);

console.log(`\nmissing instructions (${result.missingInstructions.length}):`);
console.log(
  result.missingInstructions.length
    ? list(result.missingInstructions, (x) => `${x.mnemonic}  (${x.definedBy.join(', ')})`)
    : '    none',
);

console.log(
  `\ncovered by a broader row (${result.coveredByBroaderRow.length}), of which ordering-only: ` +
    `${result.coveredByBroaderRow.filter((c) => c.orderingOnly).length}`,
);

if (result.encodingMismatches.length) {
  console.log(`\nsame name, different bits (${result.encodingMismatches.length}):`);
  for (const x of result.encodingMismatches) {
    console.log(`    ${x.extension} ${x.mnemonic}`);
    console.log(`      local    ${x.local}`);
    console.log(`      upstream ${x.upstream}`);
    console.log(
      x.narrower
        ? '      we pin a bit upstream leaves free'
        : '      upstream carries another encoding under this name',
    );
  }
}

if (result.malformed.length) {
  console.log(`\nmalformed local encodings (${result.malformed.length}):`);
  console.log(list(result.malformed, (x) => `${x.extension} ${x.mnemonic}`));
}

console.log(`\ncomplete: ${result.complete}`);
