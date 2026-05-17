// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : INDEX
// # Environment   : Development
// # Version       : 4.0.1
// # Updated       : 2026-05-15
// #
// # Purpose:
// # Public SDK exports for deterministic identity,
// # continuity, namespace projection, and governance
// # compilation utilities.
//
// ############################################################

/* ==========================================================
 * Compiler Exports
 * ========================================================== */

export {
  compileAgent,
  buildIdentityMetadata
} from './compiler.js';

/* ==========================================================
 * Canonicalization
 * ========================================================== */

export {
  canonicalize
} from './canonicalize.js';

/* ==========================================================
 * Hashing Utilities
 * ========================================================== */

export {
  computeFingerprint,
  computePurposeHash
} from './hash.js';

/* ==========================================================
 * Namespace Projection
 * ========================================================== */

export {
  projectUsNamespace,
  validateNamespaceProjection,
  isUsNamespace
} from './namespace.js';

/* ==========================================================
 * Governance & License Enforcement
 * ========================================================== */

export {
  validateGrammarAccess,
  validateCovenantRules,
  normalizeGrammarLicense,
  tierNumber
} from './license.js';

// ############################################################
// # End of File: index.js
// # Do not modify without code review
// ############################################################