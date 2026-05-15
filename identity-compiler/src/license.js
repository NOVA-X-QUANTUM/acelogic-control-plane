// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : LICENSE
// # Environment   : Development
// # Version       : 4.0.0
// # Updated       : 2026-05-10
// #            
// ############################################################

export const LICENSE_TIERS = new Set(['TIER_0','TIER_1','TIER_2','TIER_3','TIER_4','TIER_5']);
export const GRAMMAR_LEVELS = new Set(['NONE','RESTRICTED','FULL']);

export function tierNumber(tier) {
  if (!LICENSE_TIERS.has(tier)) throw new Error('INVALID_LICENSE_TIER');
  return Number(tier.replace('TIER_',''));
}

export function normalizeGrammarLicense(grammarLicense = {}) {
  const enabled = grammarLicense.enabled === true;
  const level = grammarLicense.level || (enabled ? 'RESTRICTED' : 'NONE');
  if (!GRAMMAR_LEVELS.has(level)) throw new Error('INVALID_GRAMMAR_LEVEL');
  const allowedPrefixes = Array.isArray(grammarLicense.allowedPrefixes) ? grammarLicense.allowedPrefixes : [];
  if (level === 'RESTRICTED' && allowedPrefixes.length === 0) throw new Error('RESTRICTED_GRAMMAR_REQUIRES_ALLOWED_PREFIXES');
  if (!enabled && level !== 'NONE') throw new Error('GRAMMAR_DISABLED_LEVEL_MISMATCH');
  return { enabled, level, allowedPrefixes };
}

export function validateGrammarAccess(symbolicNamespace, grammarLicense) {
  if (!symbolicNamespace?.startsWith('#us#.')) return true;
  const gl = normalizeGrammarLicense(grammarLicense);
  if (!gl.enabled) throw new Error('UNLICENSED_GRAMMAR_USE');
  if (gl.level === 'FULL') return true;
  if (gl.level === 'RESTRICTED') {
    const ok = gl.allowedPrefixes.some(prefix => symbolicNamespace.startsWith(prefix));
    if (!ok) throw new Error('GRAMMAR_PREFIX_DENIED');
    return true;
  }
  throw new Error('UNLICENSED_GRAMMAR_USE');
}

export function validateCovenantRules({ licenseTier, covenantHash }) {
  const tier = tierNumber(licenseTier);
  if (tier === 5 && !covenantHash) throw new Error('TIER5_REQUIRES_COVENANT_HASH');
  if (tier < 5 && covenantHash) throw new Error('COVENANT_HASH_NOT_ALLOWED_BELOW_TIER5');
  return true;
}
// ############################################################
// # End of File: license.js
// # Do not modify without code review
// ############################################################

