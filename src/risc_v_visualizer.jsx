import React, { useState } from 'react';
import {
  Layers,
  Cpu,
  Box,
  Zap,
  Lock,
  Settings,
  LayoutGrid,
  Info,
  ArrowRight,
  Shield,
  Database,
  Minimize,
  Activity,
} from 'lucide-react';

const RISCVExplorer = () => {
  const [activeProfile, setActiveProfile] = useState(null);
  const [selectedExt, setSelectedExt] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Scroll to exact extension tile if searchQuery matches an extension id exactly
  React.useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    // Find exact match among all extensions
    const allExts = Object.values(extensions).flat();
    const exact = allExts.find(ext => ext.id.toLowerCase() === q);

    if (exact) {
      // Scroll to the element
      const el = document.getElementById(`ext-${exact.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Extension Catalog – covers all IDs from your master list (plus a few extras)
  // ---------------------------------------------------------------------------
  const extensions = {
    base: [
      { id: 'RV32I', name: 'RV32I', desc: 'Standard Integer Base (32-bit)', use: 'Microcontrollers, IoT' },
      { id: 'RV64I', name: 'RV64I', desc: 'Standard Integer Base (64-bit)', use: 'Servers, Mobile, PC' },
      { id: 'RV32E', name: 'RV32E', desc: 'Embedded Base (16 regs)', use: 'Tiny cores (Reduced silicon)' },
      { id: 'RV64E', name: 'RV64E', desc: 'Embedded Base (64-bit, 16 regs)', use: 'Efficient 64-bit controllers' },
      { id: 'RV128I', name: 'RV128I', desc: '128-bit Address Space', use: 'Experimental/Research' },
    ],

    // Single-letter + top-level “ISA environment” markers
    standard: [
      { id: 'M', name: 'M', desc: 'Integer Multiply/Divide', use: 'Hardware multiplication and division' },
      { id: 'A', name: 'A', desc: 'Atomics', use: 'LR/SC & AMO ops in hardware' },
      { id: 'F', name: 'F', desc: 'Single-Precision Float (32-bit)', use: 'Basic floating-point workloads' },
      { id: 'D', name: 'D', desc: 'Double-Precision Float (64-bit)', use: 'General-purpose FP, HPC' },
      { id: 'Q', name: 'Q', desc: 'Quad-Precision Float (128-bit)', use: 'High-precision scientific math' },
      { id: 'C', name: 'C', desc: 'Compressed', use: '16-bit instruction encodings' },
      { id: 'V', name: 'V', desc: 'Vector (RVV)', use: 'Full RVV 1.0 vector ISA' },
      { id: 'H', name: 'H', desc: 'Hypervisor', use: 'Virtualization / VMs' },
      { id: 'B', name: 'B', desc: 'Bit-Manip Bundle', use: 'Aggregates Zba/Zbb/Zbc/Zbs' },

      // Additional top-level markers from the registry
      { id: 'K', name: 'K', desc: 'Crypto ISA Umbrella', use: 'Groups scalar & vector crypto (Zk*/Zvk*)' },
      { id: 'N', name: 'N', desc: 'User-Level Interrupts', use: 'User-mode interrupt handling' },
      { id: 'P', name: 'P', desc: 'Packed-SIMD', use: 'Packed SIMD / DSP-style operations' },
      { id: 'S', name: 'S', desc: 'Supervisor ISA', use: 'Supervisor privilege level (Volume II)' },
      { id: 'U', name: 'U', desc: 'User ISA', use: 'User privilege level (Volume II)' },

      // Non-ISA but profile-visible tags
      // { id: 'HTI', name: 'HTI', desc: 'Trace & Instrumentation', use: 'Hardware trace / instrumentation' },
      // { id: 'RERI', name: 'RERI', desc: 'RAS Error Reporting', use: 'Reliability/availability error reporting' },
      // { id: 'Semihosting', name: 'Semihosting', desc: 'Semihosting ABI', use: 'Host-assisted I/O for bare-metal' },
    ],

    // Zb* scalar bit-manip
    z_bit: [
      { id: 'Zba', name: 'Zba', desc: 'Address-Generation Bitmanip', use: 'Shift/add address generation' },
      { id: 'Zbb', name: 'Zbb', desc: 'Basic Bitmanip', use: 'CLZ/CTZ, popcnt, min/max, etc.' },
      { id: 'Zbc', name: 'Zbc', desc: 'Carry-less Multiply', use: 'CRC, Galois-field crypto' },
      { id: 'Zbs', name: 'Zbs', desc: 'Single-Bit Ops', use: 'Set/clear/invert bit in word' },
    ],

    // Zc* compressed
    z_compress: [
      { id: 'Zca', name: 'Zca', desc: 'Base Compressed (no FP)', use: 'Compressed base integer ops' },
      { id: 'Zcb', name: 'Zcb', desc: 'Extra Compressed Integer', use: 'More 16-bit ALU/control ops' },
      { id: 'Zcd', name: 'Zcd', desc: 'Compressed Double Float', use: '16-bit encodings for 64-bit FP' },
      { id: 'Zce', name: 'Zce', desc: 'Embedded Compressed', use: 'RV32E/RV64E-focused compressed subset' },
      { id: 'Zcf', name: 'Zcf', desc: 'Compressed Float Load/Store', use: '16-bit encodings for FP LD/ST' },
      { id: 'Zcmp', name: 'Zcmp', desc: 'Push/Pop & Reg Save/Restore', use: 'Stack push/pop, frame save' },
      { id: 'Zcmt', name: 'Zcmt', desc: 'Compressed Table Jumps', use: 'Switch/jumptable compression' },
      { id: 'Zcmop', name: 'Zcmop', desc: 'Compressed May-Be-Ops', use: 'Reserved 16-bit NOP/future ops' },
      { id: 'Zclsd', name: 'Zclsd', desc: 'Compressed LS-Pair', use: 'Compressed load/store pairs' },
      { id: 'Zcmlsd', name: 'Zcmlsd', desc: 'Compressed Mem-Loop', use: 'Compact memcpy/memset-style sequences' },
    ],

    // Zf*/Za* floating-point & atomics family
    z_float: [
      { id: 'Zfh', name: 'Zfh', desc: 'Half-Precision FP (16-bit)', use: 'Low-precision FP (AI/graphics)' },
      { id: 'Zfhmin', name: 'Zfhmin', desc: 'Minimal Half-Precision FP', use: 'Conversions, no arithmetic' },
      { id: 'Zfbfmin', name: 'Zfbfmin', desc: 'Minimal BF16 FP', use: 'BFloat16 conversions and storage' },
      { id: 'Zfa', name: 'Zfa', desc: 'Additional FP Instructions', use: 'Fused ops, sign inject, etc.' },
      { id: 'Zfinx', name: 'Zfinx', desc: 'FP in Integer Regs (F)', use: 'Single-precision FP in x-regs' },
      { id: 'Zdinx', name: 'Zdinx', desc: 'FP in Integer Regs (D)', use: 'Double-precision FP in x-regs' },
      { id: 'Zhinx', name: 'Zhinx', desc: 'FP in Integer Regs (Half)', use: 'Half-precision FP in x-regs' },
      { id: 'Zhinxmin', name: 'Zhinxmin', desc: 'Minimal Half-in-Int', use: 'Minimal half-precision in x-regs' },
      { id: 'Zacas', name: 'Zacas', desc: 'Atomic Compare-and-Swap', use: 'Lock-free algorithms (CAS)' },
      { id: 'Zawrs', name: 'Zawrs', desc: 'Wait-on-Reservation-Set', use: 'Low-power waiting on LR/SC reservations' },
    ],

    // Vector subsets & capabilities (non-crypto)
    z_vector: [
      // Embedded vector base subsets
      { id: 'Zve', name: 'Zve', desc: 'Embedded Vector Base', use: 'Baseline V subset for MCUs' },
      { id: 'Zve32x', name: 'Zve32x', desc: 'Vec Int (32-bit, embedded)', use: 'Int-only embedded vectors' },
      { id: 'Zve32f', name: 'Zve32f', desc: 'Vec FP32 (embedded)', use: 'Embedded FP32 vector compute' },
      { id: 'Zve64x', name: 'Zve64x', desc: 'Vec Int (64-bit, embedded)', use: '64-bit int embedded vectors' },
      { id: 'Zve64f', name: 'Zve64f', desc: 'Vec FP32+Int (64-bit, embedded)', use: 'FP32 + 64-bit int vectors' },
      { id: 'Zve64d', name: 'Zve64d', desc: 'Vec FP64+FP32+Int', use: 'Full FP64 embedded vectors' },

      // Aliases and VLEN capabilities
      { id: 'Zv', name: 'Zv', desc: 'Vector Alias for V', use: 'ISA alias for full RVV' },
      { id: 'Zvl32b', name: 'Zvl32b', desc: 'Min VLEN ≥ 32b', use: 'Vector length capability' },
      { id: 'Zvl64b', name: 'Zvl64b', desc: 'Min VLEN ≥ 64b', use: 'Vector length capability' },
      { id: 'Zvl128b', name: 'Zvl128b', desc: 'Min VLEN ≥ 128b', use: 'Vector length capability' },
      { id: 'Zvl256b', name: 'Zvl256b', desc: 'Min VLEN ≥ 256b', use: 'Vector length capability' },
      { id: 'Zvl512b', name: 'Zvl512b', desc: 'Min VLEN ≥ 512b', use: 'Vector length capability' },
      { id: 'Zvl1024b', name: 'Zvl1024b', desc: 'Min VLEN ≥ 1024b', use: 'Vector length capability' },

      // Vector FP numerics
      { id: 'Zvf', name: 'Zvf', desc: 'Vector FP minimal', use: 'Minimal scalar-like vector FP' },
      { id: 'Zvfh', name: 'Zvfh', desc: 'Vector Half-Precision FP', use: '16-bit FP vector arithmetic' },
      { id: 'Zvfhmin', name: 'Zvfhmin', desc: 'Vector Half-Precision Minimal', use: 'Conv/storage, minimal Zvfh' },
      { id: 'Zvfbfmin', name: 'Zvfbfmin', desc: 'Vector BF16 Minimal', use: 'BF16 conversions in vectors' },
      { id: 'Zvfbfa', name: 'Zvfbfa', desc: 'Vector BF16 Arithmetic', use: 'BF16 arithmetic in vectors' },
      { id: 'Zvfbfwma', name: 'Zvfbfwma', desc: 'Vector BF16 Widening MAC', use: 'BF16 GEMM-style MAC' },
      { id: 'Zvfofp8min', name: 'Zvfofp8min', desc: 'Vector FP8 Minimal', use: 'Minimal FP8 vector support' },

      // Non-crypto vector arithmetic helpers
      { id: 'Zvabd', name: 'Zvabd', desc: 'Vector Abs-Diff', use: 'Absolute-difference operations' },
      { id: 'Zvbb', name: 'Zvbb', desc: 'Vector Bitmanip Base', use: 'Vectorized scalar Zbb ops' },
      { id: 'Zvbc', name: 'Zvbc', desc: 'Vector Carryless Multiply', use: 'Vector CRC / GF ops' },
      { id: 'Zvbc32e', name: 'Zvbc32e', desc: 'Vector CLMUL (32E)', use: 'Carryless multiply for embedded vectors' },
      { id: 'Zvbdota', name: 'Zvbdota', desc: 'Vector BF16 Dot-Acc', use: 'BF16 dot-product accumulate' },
      { id: 'Zvdota', name: 'Zvdota', desc: 'Vector Dot-Acc', use: 'Generic FP dot-product accumulate' },
      { id: 'Zvdot4a', name: 'Zvdot4a', desc: 'Vector 4-way Dot-Acc', use: '4-way dot-product accumulate' },

      { id: 'Zvw', name: 'Zvw', desc: 'Vector Wide Groups', use: 'Wider element/vector width options' },
    ],

    // Control-flow integrity, hints & “maybe ops”
    z_security: [
      { id: 'Zicfilp', name: 'Zicfilp', desc: 'CFI Landing Pads', use: 'Forward-edge CFI for calls' },
      { id: 'Zicfiss', name: 'Zicfiss', desc: 'CFI Shadow Stacks', use: 'Backward-edge CFI (returns)' },
      { id: 'Zicond', name: 'Zicond', desc: 'Integer Conditional Ops', use: 'Branchless selects / cmov' },
      { id: 'Ziccrse', name: 'Ziccrse', desc: 'LR/SC Forward Progress', use: 'Guarantees LR/SC forward progress' },
      { id: 'Zimop', name: 'Zimop', desc: 'May-Be-Ops (NOP family)', use: 'Reserved NOP encodings for future' },
    ],

    // Scalar & vector crypto
    z_crypto: [
      // Scalar crypto umbrella + splits
      { id: 'Zk', name: 'Zk', desc: 'Scalar Crypto Base', use: 'Top-level scalar crypto bundle' },
      { id: 'Zkn', name: 'Zkn', desc: 'NIST Suite (Scalar)', use: 'AES/SHA NIST suite' },
      { id: 'Zknd', name: 'Zknd', desc: 'NIST AES Decrypt', use: 'AES decryption instructions' },
      { id: 'Zkne', name: 'Zkne', desc: 'NIST AES Encrypt', use: 'AES encryption instructions' },
      { id: 'Zknh', name: 'Zknh', desc: 'NIST Hash', use: 'SHA-2 hash instructions' },
      { id: 'Zkr', name: 'Zkr', desc: 'Entropy Source', use: 'True random source interface' },

      { id: 'Zks', name: 'Zks', desc: 'ShangMi Suite (Scalar)', use: 'Chinese SMx crypto bundle' },
      { id: 'Zksed', name: 'Zksed', desc: 'SM4 Block Cipher', use: 'SM4 encrypt/decrypt' },
      { id: 'Zksh', name: 'Zksh', desc: 'SM3 Hash', use: 'SM3 hash operations' },

      { id: 'Zkt', name: 'Zkt', desc: 'Timing-Safe Crypto', use: 'Data-independent latency constraints' },

      // Scalar crypto bitmanip
      { id: 'Zbkb', name: 'Zbkb', desc: 'Crypto Bitmanip (byte)', use: 'Byte-wise crypto bit ops' },
      { id: 'Zbkc', name: 'Zbkc', desc: 'Crypto Bitmanip (carryless)', use: 'Carryless ops for crypto' },
      { id: 'Zbkx', name: 'Zbkx', desc: 'Crypto Bitmanip (crossbar)', use: 'Bit/byte crossbar operations' },

      // Vector crypto umbrella
      { id: 'Zvk', name: 'Zvk', desc: 'Vector Crypto (umbrella)', use: 'Top-level vector crypto suite' },

      // Vector crypto subsets
      { id: 'Zvkb', name: 'Zvkb', desc: 'Vector Crypto Bitmanip', use: 'Vector crypto bit ops' },
      { id: 'Zvkg', name: 'Zvkg', desc: 'Vector GCM/GMAC', use: 'AES-GCM/GMAC acceleration' },
      { id: 'Zvkgs', name: 'Zvkgs', desc: 'Vector GCM Shim', use: 'Profile-specific GCM subset' },
      { id: 'Zvkn', name: 'Zvkn', desc: 'Vector NIST Suite', use: 'Vector AES/SHA suite' },
      { id: 'Zvknc', name: 'Zvknc', desc: 'Vector NIST + CLMUL', use: 'NIST crypto with carryless multiply' },
      { id: 'Zvkned', name: 'Zvkned', desc: 'Vector AES', use: 'Vector AES-ECB/CTR/GCM cores' },
      { id: 'Zvknf', name: 'Zvknf', desc: 'Vector AES Finite-field', use: 'Vector AES finite-field helpers' },
      { id: 'Zvkng', name: 'Zvkng', desc: 'Vector NIST + GCM', use: 'NIST suite + GCM vector bundle' },
      { id: 'Zvknha', name: 'Zvknha', desc: 'Vector SHA-2 (subset)', use: 'Vector SHA-256 subset' },
      { id: 'Zvknhb', name: 'Zvknhb', desc: 'Vector SHA-2 (full)', use: 'Vector SHA-256/512' },
      { id: 'Zvks', name: 'Zvks', desc: 'Vector ShangMi Suite', use: 'Vector SMx algorithms' },
      { id: 'Zvksc', name: 'Zvksc', desc: 'Vector ShangMi + CLMUL', use: 'SMx with carryless multiply' },
      { id: 'Zvksed', name: 'Zvksed', desc: 'Vector SM4', use: 'Vector SM4 cipher' },
      { id: 'Zvksg', name: 'Zvksg', desc: 'Vector ShangMi + GCM', use: 'ShangMi + GCM vectors' },
      { id: 'Zvksh', name: 'Zvksh', desc: 'Vector SM3 Hash', use: 'Vector SM3' },
      { id: 'Zvkt', name: 'Zvkt', desc: 'Vector Timing-Safe Crypto', use: 'Vector data-independent latency' },
    ],

    // System / caches / atomics / load-store utilities
    z_system: [
      { id: 'Zicsr', name: 'Zicsr', desc: 'CSR Access', use: 'Explicit CSR read/write' },
      { id: 'Zifencei', name: 'Zifencei', desc: 'Instruction-Fetch Fence', use: 'Sync I-cache with writes' },

      { id: 'Zicntr', name: 'Zicntr', desc: 'Base Counters/Timers', use: 'cycle/instret + timers' },
      { id: 'Zihpm', name: 'Zihpm', desc: 'Perf Counters', use: 'Hardware performance monitors' },

      { id: 'Zihintpause', name: 'Zihintpause', desc: 'Pause Hint', use: 'Power-friendly spin-wait' },
      { id: 'Zihintntl', name: 'Zihintntl', desc: 'Non-Temporal Locality Hints', use: 'NT load/store hints' },

      { id: 'Zicbom', name: 'Zicbom', desc: 'Cache Management Operations', use: 'Invalidate/clean/flush blocks' },
      { id: 'Zicbop', name: 'Zicbop', desc: 'Cache Prefetch', use: 'Prefetch cache blocks' },
      { id: 'Zicboz', name: 'Zicboz', desc: 'Cache Block Zero', use: 'Fast memset-to-zero' },

      { id: 'Zmmul', name: 'Zmmul', desc: 'Multiply-Only (no DIV)', use: 'Cheaper M subset (mul only)' },

      { id: 'Zaamo', name: 'Zaamo', desc: 'Atomic Memory Operations', use: 'Defines atomic granularity' },
      { id: 'Zabha', name: 'Zabha', desc: 'Byte/Halfword AMO', use: 'Subword AMO support' },

      { id: 'Zalrsc', name: 'Zalrsc', desc: 'LR/SC Extension', use: 'Extended LR/SC semantics' },
      { id: 'Zalasr', name: 'Zalasr', desc: 'LR/SC Alias Rules', use: 'Alias rules for LR/SC sequences' },

      { id: 'Ztso', name: 'Ztso', desc: 'Total Store Ordering', use: 'x86-style TSO memory model' },

      { id: 'Zilsd', name: 'Zilsd', desc: 'Streaming LS (data)', use: 'Streaming loads/stores (data)' },
      { id: 'Zilsp', name: 'Zilsp', desc: 'Streaming LS (prefetch)', use: 'Streaming prefetch hints' },
      { id: 'Zilsme', name: 'Zilsme', desc: 'Streaming Stores (exclusive)', use: 'Streaming store hints' },
      { id: 'Zilsmea', name: 'Zilsmea', desc: 'Streaming Stores (alloc)', use: 'Streaming store + allocate' },
      { id: 'Zilsm*', name: 'Zilsm*', desc: 'Streaming Mem (pattern)', use: 'Wildcard for Zilsm<x>b family' },
      { id: 'Zilsm<x>b', name: 'Zilsm<x>b', desc: 'Streaming Mem (x-byte)', use: 'Line-size specific streaming ops' },

      { id: 'Zclsd', name: 'Zclsd', desc: 'Compressed LS Pair', use: 'Compressed LS pairs (RV32)' },

      // PMA / cache-block / reservation set / misc
      { id: 'Za64rs', name: 'Za64rs', desc: '64B Reservation Set', use: 'Reservation set granularity (64-byte)' },
      { id: 'Za128rs', name: 'Za128rs', desc: '128B Reservation Set', use: 'Reservation set granularity (128-byte)' },
      { id: 'Zic64b', name: 'Zic64b', desc: '64B Cache Blocks', use: 'Requires 64B naturally aligned cache lines' },
      { id: 'Ziccif', name: 'Ziccif', desc: 'Inst-Fetch Atomicity', use: 'Atomic I-fetch in cacheable+coherent regions' },
      { id: 'Ziccrse', name: 'Ziccrse', desc: 'RsrvEventual', use: 'Reservation-set eventuality guarantees' },
      { id: 'Ziccamoa', name: 'Ziccamoa', desc: 'Atomics PMA', use: 'PMA guarantees for A-extension atomics' },
      { id: 'Zicclsm', name: 'Zicclsm', desc: 'Misaligned L/S Support', use: 'Misaligned loads/stores in cacheable+coherent regions' },
      { id: 'Ziccamoc', name: 'Ziccamoc', desc: 'CAS PMA', use: 'PMA guarantees for CAS-style atomics' },

      { id: 'Zibi', name: 'Zibi', desc: 'Interruptible Mem Ops', use: 'Interruptible load/store semantics' },
      { id: 'Zicntrpmf', name: 'Zicntrpmf', desc: 'Counter Filtering', use: 'Mode-based filtering for counters' },
      { id: 'Zimt', name: 'Zimt', desc: 'Time Instructions', use: 'Extended time/TIMECMP instructions' },
      { id: 'Zitagelide', name: 'Zitagelide', desc: 'Tag & ELIDE', use: 'Tagged-memory / elide behaviors' },
      { id: 'Zjid', name: 'Zjid', desc: 'ICache Coherence Alt', use: 'Alternative to Zifencei for I-cache coherence' },
      { id: 'Zjpm', name: 'Zjpm', desc: 'Pointer-Mask Qualifier', use: 'Auxiliary pointer-masking semantics' },
      { id: 'Zccid', name: 'Zccid', desc: 'Cache-Block ID', use: 'Cache block identity / debugging' },
      { id: 'Zama16b', name: 'Zama16b', desc: '16B Misaligned Atomicity', use: 'Misaligned atomicity granule (16 bytes)' },
    ],

    // S / Sv: memory & address-translation
    s_mem: [
      { id: 'Sv32', name: 'Sv32', desc: 'Virtual Memory, 32-bit', use: '2-level page tables (RV32 Linux)' },
      { id: 'Sv39', name: 'Sv39', desc: 'Virtual Memory, 39-bit VA', use: '3-level page tables (RV64 Linux)' },
      { id: 'Sv48', name: 'Sv48', desc: 'Virtual Memory, 48-bit VA', use: '4-level page tables' },
      { id: 'Sv57', name: 'Sv57', desc: 'Virtual Memory, 57-bit VA', use: '5-level page tables' },

      { id: 'Svbare', name: 'Svbare', desc: 'Bare Mode', use: 'No address translation (satp bare)' },

      { id: 'Svpbmt', name: 'Svpbmt', desc: 'Page-Based Memory Types', use: 'Per-page memory types / cacheability' },
      { id: 'Svnapot', name: 'Svnapot', desc: 'NAPOT Mappings', use: 'Hugepages via NAPOT PTEs' },
      { id: 'Svinval', name: 'Svinval', desc: 'Fine-Grained TLB Invalidate', use: 'Fine-grain TLB shootdown instructions' },
      { id: 'Svade', name: 'Svade', desc: 'Access/Dirty Exceptions', use: 'Page-fault on A/D bit issues' },
      { id: 'Svadu', name: 'Svadu', desc: 'Access/Dirty Update', use: 'Hardware A/D-bit updates' },
      { id: 'Svvptc', name: 'Svvptc', desc: 'Visible PTE Changes', use: 'Bounded-time PTE visibility guarantees' },
      { id: 'Svrsw60t59b', name: 'Svrsw60t59b', desc: 'PTE RSW Bits', use: 'Standard RSW field behavior' },

      { id: 'Svatag', name: 'Svatag', desc: 'Tagged Translations', use: 'Address-tagged translation behavior' },
      { id: 'Svukte', name: 'Svukte', desc: 'User-Keyed TLB Entries', use: 'Per-user TLB tagging' },

      // Pointer masking (user/supervisor view)
      { id: 'Supm', name: 'Supm', desc: 'User Pointer Masking', use: 'Mask user pointers' },
      { id: 'Ssnpm', name: 'Ssnpm', desc: 'Supervisor Next-Pointer Mask', use: 'Mask next-mode pointers (S)' },
      { id: 'Sspm', name: 'Sspm', desc: 'Supervisor Pointer Masking', use: 'Supervisor pointer-mask policy' },
    ],

    // S / Sm / Ss: interrupts, counters, QoS, AIA, etc.
    s_interrupt: [
      { id: 'Smaia', name: 'Smaia', desc: 'AIA Machine Extension', use: 'Advanced interrupt arch (M)' },
      { id: 'Ssaia', name: 'Ssaia', desc: 'AIA Supervisor Extension', use: 'Advanced interrupt arch (S)' },

      { id: 'Smclic', name: 'Smclic', desc: 'Machine CLIC', use: 'Machine-level CLIC interrupt controller' },
      { id: 'Smclicconfig', name: 'Smclicconfig', desc: 'Machine CLIC Config', use: 'MCLIC configuration CSRs' },
      { id: 'Smclicshv', name: 'Smclicshv', desc: 'Machine CLIC SHV', use: 'Selective hardware vectored interrupts' },

      { id: 'Ssclic', name: 'Ssclic', desc: 'Supervisor CLIC', use: 'Supervisor-level CLIC interface' },
      { id: 'Suclic', name: 'Suclic', desc: 'User CLIC', use: 'User-level CLIC interface' },

      { id: 'Sstc', name: 'Sstc', desc: 'Supervisor Timer Compare', use: 'Per-hart timer interrupts' },

      { id: 'Smcdeleg', name: 'Smcdeleg', desc: 'M-Mode Counter Delegation', use: 'Delegates HPM counters to S' },
      { id: 'Smcntrpmf', name: 'Smcntrpmf', desc: 'M-Mode Counter Filtering', use: 'Filter counters by privilege' },
      { id: 'Ssccfg', name: 'Ssccfg', desc: 'Counter Configuration (S)', use: 'S-mode control of delegated HPM' },
      { id: 'Sscntrcfg', name: 'Sscntrcfg', desc: 'S-Mode Counter Config', use: 'Supervisor counter configuration' },
      { id: 'Sscounterenw', name: 'Sscounterenw', desc: 'Writable scounteren', use: 'Writable enables for HPMs' },
      { id: 'Sscofpmf', name: 'Sscofpmf', desc: 'Counter Overflow & Filtering', use: 'Overflow + filtering in S-mode' },
      { id: 'Ssccptr', name: 'Ssccptr', desc: 'S Counter Pointer CSR', use: 'Supervisor counter pointer CSR' },

      { id: 'Ssqosid', name: 'Ssqosid', desc: 'QoS Identifiers', use: 'Per-thread QoS tagging' },
      { id: 'Sshpmcfg', name: 'Sshpmcfg', desc: 'S-Mode HPM Config', use: 'Supervisor HPM configuration' },

      { id: 'Smrnmi', name: 'Smrnmi', desc: 'Resumable NMI', use: 'Restartable non-maskable interrupts' },
    ],

    // Traps, debug, state enable, PMP, CSR indirection, profile tags, hypervisor aux
    s_trap: [
      // Debug
      { id: 'Sdext', name: 'Sdext', desc: 'External Debug', use: 'External debug architecture' },
      { id: 'Sdtrig', name: 'Sdtrig', desc: 'Debug Triggers', use: 'HW breakpoints / watchpoints' },
      { id: 'Sdtrigepm', name: 'Sdtrigepm', desc: 'Debug Trigger EPM', use: 'Trigger matching for external PM' },
      { id: 'Sdtrigpend', name: 'Sdtrigpend', desc: 'Debug Trigger Pending', use: 'Pending trigger cause reporting' },

      // Trap / CSR behavior
      { id: 'Smcsrind', name: 'Smcsrind', desc: 'Indirect CSR Access (M)', use: 'CSR indirection at M-mode' },
      { id: 'Sscsrind', name: 'Sscsrind', desc: 'Indirect CSR Access (S)', use: 'CSR indirection at S-mode' },
      { id: 'Smctr', name: 'Smctr', desc: 'Control Transfer Records (M)', use: 'Hardware CFI logs (M)' },
      { id: 'Ssctr', name: 'Ssctr', desc: 'Control Transfer Records (S)', use: 'Hardware CFI logs (S)' },

      { id: 'Sddbltrp', name: 'Sddbltrp', desc: 'Debug Double Trap', use: 'Debug-level nested traps' },
      { id: 'Ssdbltrp', name: 'Ssdbltrp', desc: 'Supervisor Double Trap', use: 'Recoverable nested traps (S)' },
      { id: 'Smdbltrp', name: 'Smdbltrp', desc: 'Machine Double Trap', use: 'Recoverable nested traps (M)' },

      // State enable / PMP / security-ish arch
      { id: 'Smstateen', name: 'Smstateen', desc: 'M-Mode State Enable', use: 'Gate access to extension CSRs' },
      { id: 'Ssstateen', name: 'Ssstateen', desc: 'S-Mode State Enable', use: 'State-enable for S/VS/VU' },
      { id: 'Smepmp', name: 'Smepmp', desc: 'Enhanced PMP', use: 'More flexible PMP rules' },
      { id: 'Smmpm', name: 'Smmpm', desc: 'Machine PMP Mgmt', use: 'Machine-level PMP management' },

      // Profile-visible architectural tags
      { id: 'Sm1p11', name: 'Sm1p11', desc: 'Priv Spec M v1.11', use: 'Machine architecture tag' },
      { id: 'Ss1p11', name: 'Ss1p11', desc: 'Priv Spec S v1.11', use: 'Supervisor architecture tag' },
      { id: 'Sm1p12', name: 'Sm1p12', desc: 'Priv Spec M v1.12', use: 'Machine architecture tag' },
      { id: 'Ss1p12', name: 'Ss1p12', desc: 'Priv Spec S v1.12', use: 'Supervisor architecture tag' },
      { id: 'Sm1p13', name: 'Sm1p13', desc: 'Priv Spec M v1.13', use: 'Machine architecture tag' },
      { id: 'Ss1p13', name: 'Ss1p13', desc: 'Priv Spec S v1.13', use: 'Supervisor architecture tag' },

      // Trap-behavior niceties
      { id: 'Sstvala', name: 'Sstvala', desc: 'stval Address Rule', use: 'Precise faulting VA / instruction' },
      { id: 'Sstvecd', name: 'Sstvecd', desc: 'stvec Direct Mode', use: 'Direct-mode trap vector' },
      { id: 'Sstvecv', name: 'Sstvecv', desc: 'stvec Vectored Mode', use: 'Vectored trap routing' },
      { id: 'Ssdtso', name: 'Ssdtso', desc: 'Supervisor TSO Opt-in', use: 'Supervisors opt into TSO behavior' },
      { id: 'Sstcfg', name: 'Sstcfg', desc: 'Trap Config', use: 'Per-trap configuration controls' },
      { id: 'Ssstrict', name: 'Ssstrict', desc: 'No Non-Conforming Exts', use: 'Disallows non-conforming extensions' },

      { id: 'Ssu32xl', name: 'Ssu32xl', desc: 'UXL=32 support', use: 'User XLEN=32 capability' },
      { id: 'Ssu64xl', name: 'Ssu64xl', desc: 'UXL=64 support', use: 'User XLEN=64 capability' },
      { id: 'Ssube', name: 'Ssube', desc: 'Big-Endian S', use: 'Supervisor big-endian/bi-endian' },
      { id: 'Ssvxscr', name: 'Ssvxscr', desc: 'VS CSR', use: 'Vector state control at S-mode' },

      { id: 'Ssptead', name: 'Ssptead', desc: 'Sup PTE A/D (legacy)', use: 'Legacy name for Svade-style semantics' },

      // Machine-level trap / debug extras
      { id: 'Smcfiss', name: 'Smcfiss', desc: 'M-Mode Shadow Stack', use: 'Machine-level shadow stack config' },
      { id: 'Smdid', name: 'Smdid', desc: 'Debug ID', use: 'Debug/trace identification' },
      { id: 'Smrnpt', name: 'Smrnpt', desc: 'Non-Precise Traps', use: 'Relaxed trap precision' },
      { id: 'Smrntt', name: 'Smrntt', desc: 'Non-Taken Traps', use: 'Trap behavior when not taken' },
      { id: 'Smnpm', name: 'Smnpm', desc: 'Non-Maskable PM', use: 'Power-management/trap interactions' },
      { id: 'Smpmpmt', name: 'Smpmpmt', desc: 'PMP Machine Trap', use: 'PMP-related trap behavior' },
      { id: 'Smsdia', name: 'Smsdia', desc: 'Soft Debug/Instr', use: 'Soft-debug / diagnostics assist' },
      { id: 'Smtdeleg', name: 'Smtdeleg', desc: 'Trap Delegation', use: 'Fine-grain trap delegation controls' },
      { id: 'Smvatag', name: 'Smvatag', desc: 'VA Tagging (M)', use: 'Machine-level virtual-address tagging' },

      // Hypervisor augmentation cluster (Sha subcomponents)
      { id: 'Sha', name: 'Sha', desc: 'Augmented Hypervisor', use: 'Profile-defined hypervisor bundle' },
      { id: 'Shcounterenw', name: 'Shcounterenw', desc: 'HPM Counter Enable (H)', use: 'Writable bits in hcounteren' },
      { id: 'Shtvala', name: 'Shtvala', desc: 'htval Guest Address', use: 'htval contains guest physical address' },
      { id: 'Shvstvala', name: 'Shvstvala', desc: 'vstval Address Rule', use: 'VS stval updated like stval' },
      { id: 'Shvstvecd', name: 'Shvstvecd', desc: 'vstvec Direct', use: 'Direct-mode VS trap vectors' },
      { id: 'Shvsatpa', name: 'Shvsatpa', desc: 'vsatp Modes', use: 'VS translation modes match satp modes' },
      { id: 'Shgatpa', name: 'Shgatpa', desc: 'HGATP Modes', use: 'HGATP SvNNx4 modes required' },
      { id: 'Shlcofideleg', name: 'Shlcofideleg', desc: 'LC/OFI Delegation', use: 'Delegation of load-check / fault types' },

      // Non-ISA “spec tags” modeled as tiles too
      { id: 'RERI', name: 'RERI', desc: 'RAS Error Reporting', use: 'RAS error reporting arch tag' },
      { id: 'HTI', name: 'HTI', desc: 'Trace & Instrumentation', use: 'Trace / instrumentation spec tag' },
    ],
  };

  // ---------------------------------------------------------------------------
  // Profile Definitions – mandatory sets (U64+S64) for RVA20/22/23/RVB23
  // ---------------------------------------------------------------------------
  const profiles = {
    // RVA20U64 + RVA20S64 – baseline “RV64GC-like” profile
    RVA20: [
      'RV64I',
      'M',
      'A',
      'F',
      'D',
      'C',
      'Zicsr',
      'Zicntr',
      'Ziccif',
      'Ziccrse',
      'Ziccamoa',
      'Za128rs',
      'Zicclsm',
      'Zifencei',
      'Ss1p11',
      'Svbare',
      'Sv39',
      'Svade',
      'Ssccptr',
      'Sstvecd',
      'Sstvala',
    ],

    // RVA22U64 + RVA22S64 – as referenced by RVA23 spec
    RVA22: [
      'RV64I',
      'M',
      'A',
      'F',
      'D',
      'C',
      'Zicsr',
      'Zicntr',
      'Zihpm',
      'Ziccif',
      'Ziccrse',
      'Ziccamoa',
      'Zicclsm',
      'Za64rs',
      'Zihintpause',
      'Zba',
      'Zbb',
      'Zbs',
      'Zic64b',
      'Zicbom',
      'Zicbop',
      'Zicboz',
      'Zfhmin',
      'Zkt',
      'Zifencei',
      'Ss1p12',
      'Svbare',
      'Sv39',
      'Svade',
      'Ssccptr',
      'Sstvecd',
      'Sstvala',
      'Sscounterenw',
      'Svpbmt',
      'Svinval',
    ],

    // RVA23U64 + RVA23S64 – full mandatory set
    RVA23: [
      'RV64I',
      'M',
      'A',
      'F',
      'D',
      'C',
      'Zicsr',
      'Zicntr',
      'Zihpm',
      'Ziccif',
      'Ziccrse',
      'Ziccamoa',
      'Zicclsm',
      'Za64rs',
      'Zihintpause',
      'Zba',
      'Zbb',
      'Zbs',
      'Zic64b',
      'Zicbom',
      'Zicbop',
      'Zicboz',
      'Zfhmin',
      'Zkt',

      // New mandatory in RVA23U64
      'V',
      'Zvfhmin',
      'Zvbb',
      'Zvkt',
      'Zihintntl',
      'Zicond',
      'Zimop',
      'Zcmop',
      'Zcb',
      'Zfa',
      'Zawrs',
      'Supm',

      // S-profile extras
      'Zifencei',
      'Ss1p13',
      'Svbare',
      'Sv39',
      'Svade',
      'Ssccptr',
      'Sstvecd',
      'Sstvala',
      'Sscounterenw',
      'Svpbmt',
      'Svinval',
      'Svnapot',
      'Sstc',
      'Sscofpmf',
      'Ssnpm',
      'Ssu64xl',

      // Hypervisor bundle
      'Sha',
      'H',
    ],

    // RVB23U64 + RVB23S64 – embedded-leaning profile
    RVB23: [
      'RV64I',
      'M',
      'A',
      'F',
      'D',
      'C',
      'Zicsr',
      'Zicntr',
      'Zihpm',
      'Ziccif',
      'Ziccrse',
      'Ziccamoa',
      'Zicclsm',
      'Za64rs',
      'Zihintpause',
      'Zic64b',
      'Zicbom',
      'Zicbop',
      'Zicboz',
      'Zkt',

      // RVA23-style unprivileged add-ons (minus V/Zfhmin/Supm mandates)
      'Zihintntl',
      'Zicond',
      'Zimop',
      'Zcmop',
      'Zcb',
      'Zfa',
      'Zawrs',

      'Zifencei',

      'Ss1p13',
      'Svnapot',
      'Svbare',
      'Sv39',
      'Svade',
      'Ssccptr',
      'Sstvecd',
      'Sstvala',
      'Sscounterenw',
      'Svpbmt',
      'Svinval',
      'Sstc',
      'Sscofpmf',
      'Ssu64xl',
    ],
  };

  const isHighlighted = (id) => {
    if (!activeProfile) return false;
    return profiles[activeProfile].includes(id);
  };

  const isDimmed = (id) => {
    if (!activeProfile) return false;
    return !profiles[activeProfile].includes(id);
  };

  const ExtensionBlock = ({ data, colorClass, searchQuery }) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = q.length
      ? [data.id, data.name, data.desc].some((field) =>
          field.toLowerCase().includes(q)
        )
      : false;

    const isSelected = selectedExt?.id === data.id;
    const highlighted = isHighlighted(data.id) || matchesSearch || isSelected;

    return (
      <div
        id={`ext-${data.id}`}
        onClick={() =>
          setSelectedExt((current) =>
            current?.id === data.id ? null : data
          )
        }
        className={`
          relative p-2 rounded border cursor-pointer transition-all duration-200
          ${
            highlighted
              ? 'ring-2 ring-yellow-400 bg-slate-800 scale-105 shadow-lg shadow-yellow-900/20'
              : ''
          }
          ${
            isDimmed(data.id) && !matchesSearch && !isSelected
              ? 'opacity-20 grayscale'
              : `${colorClass} hover:brightness-110`
          }
          ${isSelected ? 'z-20 shadow-xl shadow-yellow-900/40' : 'z-10'}
        `}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-bold text-xs">{data.name}</span>
        </div>
        <div className="text-[9px] leading-tight opacity-80 truncate">
          {data.desc}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-2 md:p-6 font-sans">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Header */}
        <div className="lg:col-span-12 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-800 pb-4 mb-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500">
              RISC-V Extension Landscape
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">
              Interactive breakdown of RISC-V Extensions.
            </p>
          </div>

          <div className="flex gap-2 mt-4 md:mt-0">
            {Object.keys(profiles).map((profile) => (
              <button
                key={profile}
                onClick={() =>
                  setActiveProfile(activeProfile === profile ? null : profile)
                }
                className={`
                  px-3 py-1 rounded text-xs font-bold border transition-all
                  ${
                    activeProfile === profile
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                  }
                `}
              >
                {profile}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-min">
          {/* Search Bar – centered, before Base Architectures */}
          <div className="col-span-full flex justify-center mb-2">
            <div className="w-full max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search extensions by ID, name, or description..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
              />
              <p className="mt-1 text-[10px] text-center text-slate-500">
                Typing here will highlight matching tiles in yellow (case-insensitive).
              </p>
            </div>
          </div>

          {/* 1. Base */}
          <div className="space-y-2 col-span-full">
            <h3 className="text-blue-400 text-xs font-bold uppercase flex items-center gap-2">
              Base ISA
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {extensions.base.map((item) => (
                <ExtensionBlock
                  key={item.id}
                  data={item}
                  searchQuery={searchQuery}
                  colorClass="bg-blue-950 border-blue-800 text-blue-100"
                />
              ))}
            </div>
          </div>

          {/* 2. Standard */}
          <div className="space-y-2 col-span-full">
            <h3 className="text-emerald-400 text-xs font-bold uppercase flex items-center gap-2">
              Standard
            </h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {extensions.standard.map((item) => (
                <ExtensionBlock
                  key={item.id}
                  data={item}
                  searchQuery={searchQuery}
                  colorClass="bg-emerald-950 border-emerald-800 text-emerald-100"
                />
              ))}
            </div>
          </div>

          {/* 3. Z-Extensions (User Mode) */}
          <div className="col-span-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            <div className="space-y-2">
              <h3 className="text-purple-400 text-xs font-bold uppercase flex items-center gap-2">
                Bit Manipulation (Zb)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extensions.z_bit.map((item) => (
                  <ExtensionBlock
                    key={item.id}
                    data={item}
                    searchQuery={searchQuery}
                    colorClass="bg-purple-950/50 border-purple-800/50 text-purple-100"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-indigo-400 text-xs font-bold uppercase flex items-center gap-2">
                Compression (Zc)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extensions.z_compress.map((item) => (
                  <ExtensionBlock
                    key={item.id}
                    data={item}
                    searchQuery={searchQuery}
                    colorClass="bg-indigo-950/50 border-indigo-800/50 text-indigo-100"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-pink-400 text-xs font-bold uppercase flex items-center gap-2">
                Float & Numerics (Zf/Za)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extensions.z_float.map((item) => (
                  <ExtensionBlock
                    key={item.id}
                    data={item}
                    searchQuery={searchQuery}
                    colorClass="bg-pink-950/50 border-pink-800/50 text-pink-100"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-teal-400 text-xs font-bold uppercase flex items-center gap-2">
                Vector Subsets (Zv/Zve)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extensions.z_vector.map((item) => (
                  <ExtensionBlock
                    key={item.id}
                    data={item}
                    searchQuery={searchQuery}
                    colorClass="bg-teal-950/50 border-teal-800/50 text-teal-100"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-red-400 text-xs font-bold uppercase flex items-center gap-2">
                Security & Control (Zi)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extensions.z_security.map((item) => (
                  <ExtensionBlock
                    key={item.id}
                    data={item}
                    searchQuery={searchQuery}
                    colorClass="bg-red-950/50 border-red-800/50 text-red-100"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-slate-400 text-xs font-bold uppercase flex items-center gap-2">
                Cryptography (Zk/Zvk)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extensions.z_crypto.map((item) => (
                  <ExtensionBlock
                    key={item.id}
                    data={item}
                    searchQuery={searchQuery}
                    colorClass="bg-slate-800 border-slate-600 text-slate-300"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-orange-400 text-xs font-bold uppercase flex items-center gap-2">
                System & Caches (Zic)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {extensions.z_system.map((item) => (
                  <ExtensionBlock
                    key={item.id}
                    data={item}
                    searchQuery={searchQuery}
                    colorClass="bg-orange-950/50 border-orange-800/50 text-orange-100"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 4. S-Extensions (Privileged) */}
          <div className="col-span-full pt-4 border-t border-slate-800">
            <h3 className="text-cyan-400 text-xs font-bold uppercase flex items-center gap-2 mb-3">
              S & Sv Extensions (Privileged)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase text-slate-500 font-bold">Memory (Sv)</h4>
                <div className="grid grid-cols-2 gap-2">
                  {extensions.s_mem.map((item) => (
                    <ExtensionBlock
                      key={item.id}
                      data={item}
                      searchQuery={searchQuery}
                      colorClass="bg-cyan-950/30 border-cyan-800/30 text-cyan-100"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase text-slate-500 font-bold">Interrupts (Sm/Ss)</h4>
                <div className="grid grid-cols-2 gap-2">
                  {extensions.s_interrupt.map((item) => (
                    <ExtensionBlock
                      key={item.id}
                      data={item}
                      searchQuery={searchQuery}
                      colorClass="bg-cyan-950/30 border-cyan-800/30 text-cyan-100"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase text-slate-500 font-bold">
                  Trap, Debug & Hypervisor Aux
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {extensions.s_trap.map((item) => (
                    <ExtensionBlock
                      key={item.id}
                      data={item}
                      searchQuery={searchQuery}
                      colorClass="bg-cyan-950/30 border-cyan-800/30 text-cyan-100"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info Panel */}
        <div className="lg:col-span-3 mt-6 lg:mt-0">
          <div className="sticky top-6 bg-slate-900/80 border border-slate-800 backdrop-blur-sm rounded-xl p-4 shadow-2xl min-h-[400px]">
            <h2 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wide">
              <Info size={16} /> Selected Details
            </h2>

            {selectedExt ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6">
                  <h3 className="text-3xl font-black text-white tracking-tight break-words">
                    {selectedExt.name}
                  </h3>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 font-mono border border-slate-700">
                    ID: {selectedExt.id}
                  </span>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Description
                    </h4>
                    <p className="text-slate-200 leading-snug">{selectedExt.desc}</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <h4 className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-2 flex items-center gap-1">
                      <ArrowRight size={10} /> Use Case
                    </h4>
                    <p className="text-slate-400 text-sm italic">{selectedExt.use}</p>
                  </div>

                  {activeProfile && (
                    <div
                      className={`
                      mt-4 p-3 rounded text-xs flex items-center gap-2 border
                      ${
                        isHighlighted(selectedExt.id)
                          ? 'bg-yellow-900/20 border-yellow-700/30 text-yellow-200'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }
                    `}
                    >
                      {isHighlighted(selectedExt.id) ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                          Required in <strong>{activeProfile}</strong>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          Not required in {activeProfile}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-slate-600 text-center space-y-4">
                <LayoutGrid size={32} className="opacity-50" />
                <p className="text-xs max-w-[150px]">
                  Click any block on the left to view technical specifications and use cases.
                </p>
              </div>
            )}

            {/* Legend / Help
            <div className="mt-8 pt-6 border-t border-slate-800 text-[10px] text-slate-500 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-950 border border-blue-800 rounded" />
                <span>Base Architecture</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-950 border border-emerald-800 rounded" />
                <span>Standard / Top-Level</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-950/50 border border-purple-800/50 rounded" />
                <span>Z-Extension (User)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-950/30 border border-cyan-800/30 rounded" />
                <span>S-Extension (System)</span>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RISCVExplorer;