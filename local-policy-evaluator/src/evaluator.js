// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : EVALUATOR
// # Environment   : Development
// # Version       : 4.0.1
// # Updated       : 2026-05-12
// #            
// ############################################################

//added fingerprint recomputation and mission trim


import crypto from 'crypto';
import { canonicalize, computeFingerprint } from '../../identity-compiler/src/index.js';

function sha3_256Hex(s) {
  return crypto.createHash('sha3-256').update(s).digest('hex');
}

function isExpired(iso) {
  if (!iso) return true;
  return Date.now() >= new Date(iso).getTime();
}

function prefixAllowed(symbolic, gl) {
  if (!symbolic?.startsWith('#us#.')) return true;
  if (!gl?.enabled) return false;
  if (gl.level === 'FULL') return true;
  if (gl.level === 'RESTRICTED') {
    return (gl.allowedPrefixes || []).some(p => symbolic.startsWith(p));
  }
  return false;
}

export function evaluatePodAgainstPolicy({ pod, policy }) {
  if (!policy) return { allowed: false, reason: 'MISSING_POLICY' };

  const labels = pod.metadata?.labels || {};
  const annotations = pod.metadata?.annotations || {};
  const spec = policy.spec;

  // ----- 1. Agent ID match -----
  if (labels['acelogic.ai/agent-id'] !== spec.agentId) {
    return { allowed: false, reason: 'AGENT_ID_MISMATCH' };
  }

  // ----- 2. Symbolic namespace match -----
  if (annotations['acelogic.ai/symbolic-namespace'] !== spec.symbolicNamespace) {
    return { allowed: false, reason: 'SYMBOLIC_NAMESPACE_MISMATCH' };
  }

  // ----- 3. Kubernetes namespace projection check -----
  if (pod.metadata.namespace !== spec.k8sNamespace) {
    return { allowed: false, reason: 'K8S_NAMESPACE_MISMATCH' };
  }

  // ----- 4. Purpose hash verification (canonicalized mission) -----
  const suppliedPurposeHash = annotations['acelogic.ai/purpose-hash'];
  const canonicalMission = spec.mission.trim();
  const computedPurposeHash = sha3_256Hex(canonicalMission);
  if (suppliedPurposeHash !== spec.purposeHash || suppliedPurposeHash !== computedPurposeHash) {
    return { allowed: false, reason: 'PURPOSE_HASH_MISMATCH' };
  }

  // ----- 5. Grammar license enforcement -----
  if (!prefixAllowed(spec.symbolicNamespace, spec.grammarLicense)) {
    return { allowed: false, reason: 'GRAMMAR_LICENSE_DENIED' };
  }

  // ----- 6. Covenant rules (Tier 5) -----
  if (spec.licenseTier === 'TIER_5' && !spec.covenantHash) {
    return { allowed: false, reason: 'TIER5_REQUIRES_COVENANT_HASH' };
  }
  if (spec.licenseTier !== 'TIER_5' && spec.covenantHash) {
    return { allowed: false, reason: 'COVENANT_HASH_NOT_ALLOWED_BELOW_TIER5' };
  }

  // ----- 7. Fingerprint verification (updated) -----
  // 
  // modifed prev version to recompute fingerprint using canonicalized mission and compare with supplied fingerprint
  const identityMetadataForFingerprint = {
    agentId: spec.agentId,
    symbolicNamespace: spec.symbolicNamespace,
    mission: canonicalMission,
    owner: spec.owner,
    licenseTier: spec.licenseTier,
    grammarLicense: spec.grammarLicense,
  };
  const recomputedFingerprint = computeFingerprint(identityMetadataForFingerprint);
  if (recomputedFingerprint !== spec.fingerprint) {
    return { allowed: false, reason: 'FINGERPRINT_MISMATCH_INTERNAL' };
  }

  // ----- 8. State and lease -----
  if (spec.state !== 'ACTIVE') return { allowed: false, reason: `STATE_${spec.state}` };
  if (!spec.lease?.expiresAt || isExpired(spec.lease.expiresAt)) {
    return { allowed: false, reason: 'LEASE_EXPIRED' };
  }

  return { allowed: true, reason: 'APPROVED' };
}

// ############################################################
// # End of File: evaluator.js
// # Do not modify without code review
// ############################################################

