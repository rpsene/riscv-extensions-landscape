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
import { fileURLToPath } from 'node:url';
import { compareAgainstUpstream } from '../src/completeness.js';

/**
 * Read an unified-db checkout into the shape completeness.js compares against.
 *
 * Exported and given a directory rather than reading argv, because every bug
 * this file has had was in the parsing: a regex that terminated on /$/m and so
 * captured nothing, an `|| [dir]` fallback that never fired because an empty
 * array is truthy, and a missing `state` read that reported draft extensions as
 * ratified gaps. Real data found all three; tests found none, because there was
 * nothing importable to test. Now there is.
 */
export function parseUpstream(specDir) {
  const readDefinedBy = (text) => {
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
     * then take each `name:`.
     */
    const block = text.match(/^definedBy:\n([\s\S]*?)(?=^\S)/m);
    return block ? [...block[1].matchAll(/name:\s*([A-Za-z0-9_.]+)/g)].map((x) => x[1]) : [];
  };

  const extDir = path.join(specDir, 'ext');
  const extensions = [];
  const ratifiedExtensions = [];
  for (const file of fs.readdirSync(extDir).filter((f) => f.endsWith('.yaml'))) {
    const id = file.replace(/\.yaml$/, '');
    extensions.push(id);
    /*
     * "Ever ratified": an extension qualifies if ANY of its versions reached
     * ratified, even where a later one is frozen.
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
      const text = fs.readFileSync(path.join(sub, file), 'utf8');
      const name = text.match(/^name:\s*(.+?)\s*$/m);
      // unified-db gives an encoding string of 0/1/- rather than match/mask.
      const enc = text.match(/^\s*match:\s*([01-]+)\s*$/m);
      if (!enc) continue;
      let match = 0n;
      let mask = 0n;
      for (const ch of enc[1]) {
        match <<= 1n;
        mask <<= 1n;
        if (ch === '1') {
          match |= 1n;
          mask |= 1n;
        } else if (ch === '0') {
          mask |= 1n;
        }
      }
      const owners = readDefinedBy(text);
      instructions.push({
        mnemonic: (name ? name[1] : file.replace(/\.yaml$/, '')).toUpperCase(),
        match,
        mask,
        // Fall back to the directory only when the file names no owner. An
        // empty array is truthy, so `|| [dir]` silently kept the empty list.
        definedBy: owners.length ? owners : [dir],
      });
    }
  }

  return { extensions, ratifiedExtensions, instructions };
}

/*
 * unified-db attributes the base integer instructions to a bare `I`. This
 * catalogue models the concrete bases instead, RV32I and RV64I, which is the
 * distinction a reader building an -march string actually needs.
 */
export const EXTENSION_ALIASES = { I: ['RV32I', 'RV64I', 'RV32E', 'RV64E'] };

/*
 * Exit codes match check-opcodes-drift.mjs, which the reporting workflow keys
 * off: 0 complete, 1 gaps found, 2 the checkout could not be read. Conflating
 * the last two would let a broken clone report a perfect catalogue, which is
 * the most dangerous output this tool has.
 */
function main(argv) {
  const udbRoot = argv[2];
  const asJson = argv.includes('--json');
  const includeAll = argv.includes('--all');

  if (!udbRoot || !fs.existsSync(udbRoot)) {
    console.error(
      'usage: node scripts/check-udb-completeness.mjs <path-to-riscv-unified-db> [--all] [--json]',
    );
    return 2;
  }

  const specDir = path.join(udbRoot, 'spec', 'std', 'isa');
  for (const d of ['ext', 'inst']) {
    if (!fs.existsSync(path.join(specDir, d))) {
      console.error(
        `error: ${path.join(specDir, d)} does not exist. Is this a unified-db checkout?`,
      );
      return 2;
    }
  }

  const { extensions, ratifiedExtensions, instructions } = parseUpstream(specDir);

  // A parser that silently matched nothing would report a perfect catalogue.
  if (extensions.length < 100 || instructions.length < 500) {
    console.error(
      `error: parsed only ${extensions.length} extensions and ${instructions.length} instructions. ` +
        'unified-db has likely restructured; refusing to report a clean run.',
    );
    return 2;
  }

  const catalogue = JSON.parse(
    fs.readFileSync(new URL('../src/riscv_extensions.json', import.meta.url), 'utf8'),
  );

  const result = compareAgainstUpstream(
    catalogue,
    { extensions, instructions },
    {
      extensionAliases: EXTENSION_ALIASES,
      allowMissingExtensions: Object.keys(EXTENSION_ALIASES),
      onlyRatified: !includeAll,
      ratifiedExtensions,
    },
  );

  if (asJson) {
    console.log(JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    return result.complete ? 0 : 1;
  }

  const list = (rows, f) =>
    rows
      .map(f)
      .map((x) => `    ${x}`)
      .join('\n');

  console.log(
    `unified-db: ${extensions.length} extensions ` +
      `(${ratifiedExtensions.length} ever ratified), ${instructions.length} instructions`,
  );
  console.log(
    `scope: ${includeAll ? 'all upstream' : 'ratified only'}` +
      '   (pass --all to include draft and in-development work)',
  );
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
  return result.complete ? 0 : 1;
}

// Only run when invoked directly, so the parser can be imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv));
}
