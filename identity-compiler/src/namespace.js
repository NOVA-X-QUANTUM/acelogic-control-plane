// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : NAMESPACE
// # Environment   : Development
// # Version       : 4.0.0
// # Updated       : 2026-05-10
// #           
// ############################################################

export function isUsNamespace(ns) {
  return typeof ns === 'string' && ns.startsWith('#us#.');
}

export function projectUsNamespace(symbolicNamespace) {
  if (!isUsNamespace(symbolicNamespace)) throw new Error('INVALID_US_NAMESPACE');
  const projected = symbolicNamespace
    .replace(/^#us#\./, 'us-')
    .replace(/\./g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(projected)) {
    throw new Error('INVALID_PROJECTED_K8S_NAMESPACE');
  }
  if (projected.length > 63) throw new Error('PROJECTED_NAMESPACE_TOO_LONG');
  return projected;
}

export function validateNamespaceProjection(symbolicNamespace, k8sNamespace) {
  return projectUsNamespace(symbolicNamespace) === k8sNamespace;
}
// ############################################################
// # End of File: namespace.js
// # Do not modify without code review
// ############################################################

