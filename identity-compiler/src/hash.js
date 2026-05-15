// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : HASH
// # Environment   : Development
// # Version       : 4.0.0
// # Updated       : 2026-05-10
// #          
// ############################################################

import crypto from 'crypto';
import { canonicalize } from './canonicalize.js';

export const FINGERPRINT_ALGORITHM = 'SHA-256';
export const PURPOSE_HASH_ALGORITHM = 'SHA3-256';
export const FINGERPRINT_VERSION = 'v1';

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function sha3_256Hex(input) {
  return crypto.createHash('sha3-256').update(input).digest('hex');
}

export function computePurposeHash(mission) {
  if (!mission || typeof mission !== 'string') throw new Error('MISSING_MISSION');
  return sha3_256Hex(mission);
}

export function computeFingerprint(identityMetadata) {
  return sha256Hex(canonicalize(identityMetadata));
}
// ############################################################
// # End of File: hash.js
// # Do not modify without code review
// ############################################################

