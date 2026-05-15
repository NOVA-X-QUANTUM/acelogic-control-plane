// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : COMPILER
// # Environment   : Development
// # Version       : 4.0.0
// # Updated       : 2026-05-10
// #           
// ############################################################

import YAML from 'yaml';
import { computeFingerprint, computePurposeHash, FINGERPRINT_ALGORITHM, PURPOSE_HASH_ALGORITHM, FINGERPRINT_VERSION } from './hash.js';
import { projectUsNamespace } from './namespace.js';
import { normalizeGrammarLicense, validateGrammarAccess, validateCovenantRules } from './license.js';

function requireField(obj, key) {
  if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
    throw new Error(`MISSING_${key.toUpperCase()}`);
  }
}

function policyName(agentId) {
  return String(agentId).toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export function buildIdentityMetadata(input, purposeHash, k8sNamespace) {
  return {
    agentId: input.agentId,
    agentClass: input.agentClass || 'UNSPECIFIED',
    licenseTier: input.licenseTier,
    symbolicNamespace: input.symbolicNamespace,
    k8sNamespace,
    mission: input.mission,
    owner: input.owner || 'UNASSIGNED',
    purposeHash,
    fingerprintVersion: FINGERPRINT_VERSION
  };
}

export function compileAgent(input) {
  for (const key of ['agentId', 'licenseTier', 'symbolicNamespace', 'mission']) {
    requireField(input, key);
  }
  const grammarLicense = normalizeGrammarLicense(input.grammarLicense);
  validateGrammarAccess(input.symbolicNamespace, grammarLicense);
  validateCovenantRules({ licenseTier: input.licenseTier, covenantHash: input.covenantHash || null });
  const k8sNamespace = input.k8sNamespace || projectUsNamespace(input.symbolicNamespace);
  const purposeHash = computePurposeHash(input.mission);
  const identityMetadata = buildIdentityMetadata(input, purposeHash, k8sNamespace);
  const fingerprint = computeFingerprint(identityMetadata);
  const now = input.lastUpdated || new Date().toISOString();
  const policy = {
    apiVersion: 'acelogic.ai/v1',
    kind: 'AgentIdentityPolicy',
    metadata: {
      name: policyName(input.agentId),
      namespace: input.policyNamespace || 'acelogic-system'
    },
    spec: {
      agentId: input.agentId,
      agentClass: input.agentClass || 'UNSPECIFIED',
      licenseTier: input.licenseTier,
      grammarLicense,
      symbolicNamespace: input.symbolicNamespace,
      k8sNamespace,
      mission: input.mission,
      owner: input.owner || 'UNASSIGNED',
      fingerprintAlgorithm: FINGERPRINT_ALGORITHM,
      fingerprintVersion: FINGERPRINT_VERSION,
      fingerprint,
      purposeHashAlgorithm: PURPOSE_HASH_ALGORITHM,
      purposeHash,
      covenantHash: input.covenantHash || null,
      state: input.state || 'ACTIVE',
      lease: {
        epoch: input.epoch || 1,
        expiresAt: input.expiresAt || new Date(Date.now() + 300_000).toISOString()
      },
      source: input.source || { origin: 'unknown', portal: null },
      lastUpdated: now
    }
  };
  return { policy, yaml: YAML.stringify(policy), identityMetadata };
}
// ############################################################
// # End of File: compiler.js
// # Do not modify without code review
// ############################################################

