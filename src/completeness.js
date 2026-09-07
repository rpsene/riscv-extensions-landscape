/**
 * completeness.js — is the catalogue missing anything the upstream spec has?
 *
 * Pure functions, no I/O and no data imports: both sides are passed in, the
 * same contract marchUtils.js keeps. The script that reads riscv-unified-db
 * off disk lives in scripts/; everything decidable lives here so it can be
 * tested without a checkout.
 *
 * WHY ENCODING COVERAGE RATHER THAN NAME MATCHING
 *
 * unified-db enumerates memory-ordering forms as separate instructions:
 * amoadd.w, amoadd.w.aq, amoadd.w.rl, amoadd.w.aqrl. This catalogue models one
 * AMOADD.W whose mask leaves the aq and rl bits unconstrained, which is how
 * riscv-opcodes models them too (both appear in variable_fields beside rd and
 * rs1). One row already covers all four encodings.
 *
 * The tempting shortcut is to strip a trailing .aq/.rl/.aqrl from the upstream
 * name before comparing. That is wrong, and Zalasr is the proof: its loads are
 * LB.AQ with the aq bit FIXED, because forms without it are reserved, and its
 * stores are SB.RL with rl fixed. Stripping turns LB.AQ into LB, which is a
 * different instruction in the base ISA with a different encoding. The gate
 * would either match the wrong row and hide a real gap, or collide.
 *
 * So coverage is decided on the bits. An upstream encoding is covered when a
 * local row in the SAME extension constrains a subset of the same bits to the
 * same values. That answers the question actually being asked -- "would this
 * upstream instruction decode as something we already list" -- and it cannot be
 * fooled by a name.
 */

/** aq is bit 26, rl is bit 25, per the A extension's AMO format. */
export const AQ_BIT = 1n << 26n;
export const RL_BIT = 1n << 25n;
export const ORDERING_BITS = AQ_BIT | RL_BIT;

const big = (v) => (typeof v === 'bigint' ? v : BigInt(v));

/**
 * Does the local pattern cover the upstream one?
 *
 * True when local fixes a subset of the bits upstream fixes, and agrees with it
 * on every bit local does fix. A local row with aq/rl unconstrained therefore
 * covers all four ordering forms, while a local row that fixed MORE bits than
 * upstream does not cover it, which is what catches a mask quietly narrowing.
 */
export function patternCovers(local, upstream) {
  const lMask = big(local.mask);
  const lMatch = big(local.match);
  const uMask = big(upstream.mask);
  const uMatch = big(upstream.match);

  if ((uMask & lMask) !== lMask) return false;
  return ((uMatch ^ lMatch) & lMask) === 0n;
}

/**
 * An encoding is well formed when it sets no bit its own mask leaves free.
 *
 * A match bit outside the mask can never be tested, so it is silently dead. It
 * usually means a hand-edited entry drifted.
 */
export function encodingIsWellFormed({ match, mask }) {
  return (big(match) & ~big(mask)) === 0n;
}

/**
 * The bits upstream pins that we leave free, and whether they are only ordering
 * bits. Used to explain WHY something is covered rather than merely that it is.
 */
export function extraFixedBits(local, upstream) {
  return big(upstream.mask) & ~big(local.mask);
}

export function isOrderingRefinement(local, upstream) {
  const extra = extraFixedBits(local, upstream);
  return extra !== 0n && (extra & ~ORDERING_BITS) === 0n;
}

/** Every instruction in the catalogue, flattened, keeping its owning entry. */
export function flattenCatalogue(catalogue) {
  const rows = [];
  for (const group of Object.values(catalogue || {})) {
    for (const entry of group || []) {
      if (!entry || !entry.id) continue;
      for (const [mnemonic, details] of Object.entries(entry.instructions || {})) {
        if (!details || details.match == null || details.mask == null) continue;
        rows.push({
          extension: entry.id,
          mnemonic: mnemonic.toUpperCase(),
          match: big(details.match),
          mask: big(details.mask),
          variableFields: details.variable_fields || [],
        });
      }
    }
  }
  return rows;
}

/**
 * Compare the catalogue against an upstream inventory.
 *
 * `upstream` is { extensions: [id...], instructions: [{ mnemonic, match, mask,
 * definedBy }] }, already normalised by the caller from whatever upstream
 * ships. definedBy is a list, because unified-db can attribute one instruction
 * to several extensions.
 *
 * Reports rather than throws. A completeness gate that fails the build the day
 * upstream adds something is a gate people switch off.
 */
export function compareAgainstUpstream(catalogue, upstream, options = {}) {
  const {
    allowMissingExtensions = [],
    allowMissingInstructions = [],
    /*
     * Upstream ids that this catalogue models under different ones. Upstream's
     * bare `I` is our RV32I and RV64I, for instance. Without this, a deliberate
     * modelling choice reads as hundreds of missing instructions and buries the
     * real gaps.
     */
    extensionAliases = {},
  } = options;

  const aliasesFor = (id) => {
    const mapped = extensionAliases[id] || extensionAliases[id.toLowerCase()];
    return (mapped ? [id, ...mapped] : [id]).map((x) => x.toLowerCase());
  };

  const local = flattenCatalogue(catalogue);
  const localIds = new Set(
    Object.values(catalogue || {})
      .flat()
      .filter(Boolean)
      .map((e) => e.id.toLowerCase()),
  );

  const byExtension = new Map();
  for (const row of local) {
    const key = row.extension.toLowerCase();
    if (!byExtension.has(key)) byExtension.set(key, []);
    byExtension.get(key).push(row);
  }

  const missingExtensions = (upstream.extensions || [])
    .filter((id) => !localIds.has(id.toLowerCase()))
    .filter((id) => !allowMissingExtensions.includes(id))
    .sort();

  const missingInstructions = [];
  const attributedDifferently = [];
  const coveredByBroaderRow = [];
  const encodingMismatches = [];

  for (const inst of upstream.instructions || []) {
    const mnemonic = inst.mnemonic.toUpperCase();
    if (allowMissingInstructions.includes(mnemonic)) continue;

    /*
     * Only rows in an extension upstream attributes the instruction to are
     * eligible. Without this, Zalasr's LB.AQ could be "covered" by the base
     * ISA's LB, which is a different instruction that happens to share a name
     * prefix.
     */
    const owners = (inst.definedBy || []).flatMap(aliasesFor);
    const candidates = owners.flatMap((o) => byExtension.get(o) || []);

    const exact = candidates.find((c) => c.mnemonic === mnemonic);
    const covering = candidates.find((c) => patternCovers(c, inst));

    if (exact && patternCovers(exact, inst)) continue;

    if (exact && !patternCovers(exact, inst)) {
      // The name is here but the bits disagree: either we pin something
      // upstream leaves free, or we pin it to a different value.
      /*
       * The name is here but the bits disagree. Two different faults land here
       * and the report has to show both halves to tell them apart: we may pin
       * a bit upstream leaves free (a narrowing), or we may pin it to a
       * different value, which usually means upstream carries several
       * encodings under one mnemonic and we carry one. REV8 is the live
       * example, with distinct RV32 and RV64 forms.
       */
      encodingMismatches.push({
        mnemonic,
        extension: exact.extension,
        local: `match 0x${exact.match.toString(16)} mask 0x${exact.mask.toString(16)}`,
        upstream: `match 0x${big(inst.match).toString(16)} mask 0x${big(inst.mask).toString(16)}`,
        narrower: (big(inst.mask) & exact.mask) !== exact.mask,
      });
      continue;
    }

    if (covering) {
      coveredByBroaderRow.push({
        upstream: mnemonic,
        coveredBy: covering.mnemonic,
        extension: covering.extension,
        orderingOnly: isOrderingRefinement(covering, inst),
      });
      continue;
    }

    /*
     * Before calling it missing, check whether we carry the encoding at all,
     * just filed elsewhere. AMOCAS.B is the case that forced this: unified-db
     * attributes it to Zabha (byte and halfword AMOs), this catalogue to Zacas
     * (compare-and-swap), and both readings are defensible.
     *
     * That is an attribution difference, not a gap, and it has to be reported
     * separately or 600-odd of them bury the handful of instructions genuinely
     * absent. The encoding check still applies, so this cannot quietly match
     * Zalasr's LB.AQ against the base ISA's LB: their bits differ.
     */
    const elsewhere = local.find((c) => patternCovers(c, inst));
    if (elsewhere) {
      attributedDifferently.push({
        mnemonic,
        upstreamOwners: inst.definedBy || [],
        localExtension: elsewhere.extension,
        localMnemonic: elsewhere.mnemonic,
      });
      continue;
    }

    missingInstructions.push({ mnemonic, definedBy: inst.definedBy || [] });
  }

  const upstreamNames = new Set((upstream.instructions || []).map((i) => i.mnemonic.toUpperCase()));
  const surplusInstructions = local
    .filter((r) => !upstreamNames.has(r.mnemonic))
    .map((r) => ({ mnemonic: r.mnemonic, extension: r.extension }));

  const malformed = local
    .filter((r) => !encodingIsWellFormed(r))
    .map((r) => ({ mnemonic: r.mnemonic, extension: r.extension }));

  return {
    missingExtensions,
    missingInstructions: missingInstructions.sort((a, b) => a.mnemonic.localeCompare(b.mnemonic)),
    attributedDifferently: attributedDifferently.sort((a, b) =>
      a.mnemonic.localeCompare(b.mnemonic),
    ),
    coveredByBroaderRow,
    encodingMismatches,
    surplusInstructions,
    malformed,
    complete: missingExtensions.length === 0 && missingInstructions.length === 0,
  };
}
