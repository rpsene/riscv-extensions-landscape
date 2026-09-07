import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseUpstream, EXTENSION_ALIASES } from '../scripts/check-udb-completeness.mjs';

/*
 * The parser, against committed fixtures.
 *
 * Every defect this file has had lived in the parsing, and real data found all
 * of them because there was nothing importable to test:
 *
 *   - a definedBy regex terminating on /$/m, which in multiline mode is the end
 *     of the FIRST line, so it captured nothing and every instruction came back
 *     unowned;
 *   - `owners || [dir]`, which never fell back because an empty array is truthy;
 *   - no `state` read at all, so draft extensions were reported as ratified gaps.
 *
 * The fixtures below carry one case per shape, so a regression fails here
 * rather than in a weekly cron nobody is watching.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const specDir = path.join(here, 'fixtures', 'udb', 'spec', 'std', 'isa');
const upstream = parseUpstream(specDir);
const inst = (name) => upstream.instructions.find((i) => i.mnemonic === name);

test('extensions are read, and their ids come from the filename', () => {
  assert.deepEqual(upstream.extensions.sort(), ['Zdraft', 'Zfix', 'Zlateratified', 'Zwasfrozen']);
});

test('only ever-ratified extensions are marked ratified', () => {
  assert.deepEqual(upstream.ratifiedExtensions.sort(), ['Zfix', 'Zlateratified', 'Zwasfrozen']);
  assert.equal(
    upstream.ratifiedExtensions.includes('Zdraft'),
    false,
    'a development extension is not ratified',
  );
});

test('"ever ratified" counts an extension whose later version is frozen', () => {
  // Zwasfrozen is ratified at 1.0.0 and frozen at 2.0.0. Reading only the LAST
  // state would drop it.
  assert.ok(upstream.ratifiedExtensions.includes('Zwasfrozen'));
});

test('"ever ratified" counts an extension ratified after a draft version', () => {
  /*
   * Zlateratified is development at 0.5.0 and ratified at 1.0.0, so the
   * ratified state is not the first one in the file. Mutation testing put this
   * here: substituting "read only the first state" failed nothing, because
   * every other fixture happened to list ratified first.
   */
  assert.ok(upstream.ratifiedExtensions.includes('Zlateratified'));
});

test('the single-owner definedBy shape is parsed', () => {
  assert.deepEqual(inst('SIMPLE').definedBy, ['Zfix']);
});

test('the anyOf definedBy shape yields every owner', () => {
  assert.deepEqual(inst('SHARED').definedBy, ['Zfix', 'Zwasfrozen']);
});

test('an instruction with no definedBy falls back to its directory', () => {
  // The `|| [dir]` bug: an empty array is truthy, so the fallback never fired
  // and the instruction was left unowned.
  assert.deepEqual(inst('UNOWNED').definedBy, ['Zfix']);
});

test('an instruction with no encoding is skipped, not crashed on', () => {
  assert.equal(inst('NOENCODING'), undefined);
});

test('the 0/1/- encoding string becomes the right match and mask', () => {
  // match: 0000000----------000-----0001011
  const s = inst('SIMPLE');
  let match = 0n;
  let mask = 0n;
  for (const ch of '0000000----------000-----0001011') {
    match <<= 1n;
    mask <<= 1n;
    if (ch === '1') {
      match |= 1n;
      mask |= 1n;
    } else if (ch === '0') {
      mask |= 1n;
    }
  }
  assert.equal(s.match, match);
  assert.equal(s.mask, mask);
  assert.equal(s.mask & 0x7fn, 0x7fn, 'the opcode field is fully fixed');
  assert.equal(s.match & 0x7fn, 0x0bn, 'opcode 0x0b, custom-0');
});

test('a dash in the encoding leaves that bit free in the mask', () => {
  const s = inst('SIMPLE');
  // bits 24-15 are dashes in the fixture, so none of them may be set in mask
  for (let bit = 15n; bit <= 24n; bit += 1n) {
    assert.equal((s.mask >> bit) & 1n, 0n, `bit ${bit} should be free`);
  }
});

test('match never sets a bit its own mask leaves free', () => {
  for (const i of upstream.instructions) {
    assert.equal((i.match & ~i.mask) === 0n, true, `${i.mnemonic} has a dead match bit`);
  }
});

test('every parsed instruction names at least one owner', () => {
  for (const i of upstream.instructions) {
    assert.ok(i.definedBy.length > 0, `${i.mnemonic} has no owner`);
  }
});

test('the alias map is exported and covers upstream bare I', () => {
  // Exported so the workflow and the tests agree on it rather than each
  // carrying their own copy.
  assert.deepEqual(EXTENSION_ALIASES.I, ['RV32I', 'RV64I', 'RV32E', 'RV64E']);
});

test('parseUpstream throws on a directory that is not a checkout', () => {
  assert.throws(() => parseUpstream(path.join(here, 'fixtures', 'nope')));
});
