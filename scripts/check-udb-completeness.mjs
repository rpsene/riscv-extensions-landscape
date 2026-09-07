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
/**
 * Fold unified-db `not:` constraints into a match/mask pair.
 *
 * A variable field can be narrowed by excluding values rather than by fixing
 * bits in the match string:
 *
 *   - name: rm
 *     location: 14-12
 *     not: [0, 2, 3, 4, 5, 6, 7]
 *
 * That leaves exactly one legal value, so `rm` is pinned as surely as if the
 * match string had spelled it out. Reading only the match string missed this
 * and reported FCVTMOD.W.D as an encoding upstream leaves free, when upstream
 * constrains it precisely and this catalogue agrees.
 *
 * Only a field left with ONE legal value can be folded in. The other twelve
 * uses upstream merely narrow a field -- `ld` and `sd` excluding odd registers,
 * `cm.pop` excluding low counts -- and "any value except these four" cannot be
 * said with a match and a mask. Those are returned as `narrowed` so a caller
 * can report the limit rather than pretend it does not exist.
 */
export function applyNotConstraints({ match, mask }, variables) {
  let m = match;
  let k = mask;
  const narrowed = [];

  for (const v of variables) {
    if (!v.not || v.not.length === 0) continue;
    const width = v.hi - v.lo + 1;
    const total = 1 << width;
    const excluded = new Set(v.not);
    if (excluded.size !== total - 1) {
      narrowed.push({ field: v.name, remaining: total - excluded.size });
      continue;
    }
    let only = null;
    for (let candidate = 0; candidate < total; candidate += 1) {
      if (!excluded.has(candidate)) only = candidate;
    }
    if (only === null) continue;
    const fieldMask = ((1n << BigInt(width)) - 1n) << BigInt(v.lo);
    k |= fieldMask;
    m = (m & ~fieldMask) | (BigInt(only) << BigInt(v.lo));
  }

  return { match: m, mask: k, narrowed };
}

/** The `variables:` block of an encoding: name, bit range, and any `not:` list. */
export function parseVariables(text) {
  /*
   * Capture everything after `variables:` and let the item pattern below decide
   * what counts, rather than trying to find where the block ends.
   *
   * The tempting lookahead is /(?=^\S|$)/m, and it is wrong for the second time
   * today: in multiline mode `$` is the end of the FIRST line, so the group
   * captures nothing. definedBy had the identical bug. An item only matches
   * when `name:` is followed by `location:`, which no later key in these files
   * produces, so the loose capture is safe.
   */
  const block = text.match(/^\s*variables:\n([\s\S]*)/m);
  if (!block) return [];
  const out = [];
  const re = /-\s*name:\s*(\w+)\s*\n\s*location:\s*(\d+)-(\d+)([\s\S]*?)(?=\n\s*-\s*name:|$)/g;
  for (const m of block[1].matchAll(re)) {
    const notList = m[4].match(/not:\s*\[([\s\S]*?)\]/);
    out.push({
      name: m[1],
      hi: Number(m[2]),
      lo: Number(m[3]),
      not: notList
        ? notList[1]
            .split(',')
            .map((x) => x.trim())
            .filter((x) => /^\d+$/.test(x))
            .map(Number)
        : [],
    });
  }
  return out;
}

/**
 * The indented body of a top-level YAML key, by scanning lines.
 *
 * Deliberately not a regex. Three separate bugs today came from trying to
 * express "up to the next line at column zero" as a lookahead: /$/m is the end
 * of the FIRST line, so the capture came back empty, and /(?=^\S)/m silently
 * matches nothing when the block runs to the end of the file. Scanning lines
 * has neither failure mode.
 */
function blockUnder(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `${key}:`);
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() !== '' && !/^\s/.test(line)) break;
    body.push(line);
  }
  return body.join('\n');
}

/**
 * The encodings an instruction file declares, one per XLEN where it has two.
 *
 * unified-db writes most instructions with a single `encoding.match`, but 19 of
 * them differ by XLEN and are keyed instead:
 *
 *   encoding:
 *     RV32:
 *       match: 011010011000-----101-----0010011
 *     RV64:
 *       match: 011010111000-----101-----0010011
 *
 * Taking the first `match:` in the file silently read one of the two. That
 * covered exactly the instructions where RV32 and RV64 diverge -- rev8, rori,
 * ld, sd, the shift-immediates, the Zbs single-bit ops -- so the gate compared
 * against half the data for the cases most likely to disagree, and reported
 * rev8 as an encoding this catalogue got wrong when it carries both.
 */
export function parseEncodings(text) {
  const bitsToPair = (bits) => {
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
    return { match, mask };
  };

  const body = blockUnder(text, 'encoding');
  if (body === null) return [];

  // Scanned, not matched, for the same reason blockUnder exists: a lookahead
  // for "the next XLEN key or the end" needs an end assertion that /$/m does
  // not provide, and gets it silently wrong rather than loudly.
  const lines = body.split('\n');
  const keyed = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i].match(/^\s{2}(RV32|RV64):\s*$/);
    if (!head) continue;
    const collected = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s{2}(RV32|RV64):\s*$/.test(lines[j])) break;
      collected.push(lines[j]);
    }
    keyed.push({ xlen: head[1], text: collected.join('\n') });
  }
  const blocks = keyed.length ? keyed : [{ xlen: null, text: body }];

  const out = [];
  for (const block of blocks) {
    const bits = block.text.match(/^\s*match:\s*([01-]+)\s*$/m);
    if (!bits) continue;
    const pair = bitsToPair(bits[1]);
    const folded = applyNotConstraints(pair, parseVariables(block.text));
    out.push({ xlen: block.xlen, ...folded });
  }
  return out;
}

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
    const block = blockUnder(text, 'definedBy');
    return block ? [...block.matchAll(/name:\s*([A-Za-z0-9_.]+)/g)].map((x) => x[1]) : [];
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
      const mnemonic = (name ? name[1] : file.replace(/\.yaml$/, '')).toUpperCase();
      const owners = readDefinedBy(text);

      // One entry per declared encoding: two where the file is XLEN-keyed.
      for (const enc of parseEncodings(text)) {
        instructions.push({
          mnemonic,
          xlen: enc.xlen,
          match: enc.match,
          mask: enc.mask,
          narrowedFields: enc.narrowed,
          // Fall back to the directory only when the file names no owner. An
          // empty array is truthy, so `|| [dir]` silently kept the empty list.
          definedBy: owners.length ? owners : [dir],
        });
      }
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
