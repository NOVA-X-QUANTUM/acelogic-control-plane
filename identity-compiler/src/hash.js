// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : HASH
// # Environment   : Development
// # Version       : 4.0.1
// # Updated       : 2026-05-15
// #
// # Purpose:
// # Deterministic hashing utilities for identity,
// # continuity, and governance validation.
//
// # Responsibilities:
// # - canonical identity fingerprinting
// # - purpose hash generation
// # - deterministic hash normalization
// # - continuity-safe hashing inputs
// #
// ############################################################

import crypto from 'crypto';

import { canonicalize } from './canonicalize.js';

// ------------------------------------------------------------------
// Hashing standards
// ------------------------------------------------------------------

export const FINGERPRINT_ALGORITHM = 'SHA-256';

export const PURPOSE_HASH_ALGORITHM = 'SHA3-256';

export const FINGERPRINT_VERSION = 'v1';

// ------------------------------------------------------------------
// SHA-256 utility
// ------------------------------------------------------------------

export function sha256Hex(input) {
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');
}

// ------------------------------------------------------------------
// SHA3-256 utility
// ------------------------------------------------------------------

export function sha3_256Hex(input) {
  return crypto
    .createHash('sha3-256')
    .update(input)
    .digest('hex');
}

// ------------------------------------------------------------------
// Deterministic purpose hash
// ------------------------------------------------------------------

/**
 * Computes a deterministic purpose hash
 * from mission-aligned execution intent.
 */
export function computePurposeHash(mission) {

  if (
    !mission ||
    typeof mission !== 'string'
  ) {
    throw new Error(
      'ACELOGIC_MISSING_MISSION'
    );
  }

  return sha3_256Hex(mission);
}

// ------------------------------------------------------------------
// Deterministic identity fingerprint
// ------------------------------------------------------------------

/**
 * Computes a deterministic identity fingerprint
 * from canonicalized identity metadata.
 */
export function computeFingerprint(
  identityMetadata
) {

  return sha256Hex(
    canonicalize(identityMetadata)
  );
}

// ############################################################
// # End of File: hash.js
// # Do not modify without code review
// ############################################################