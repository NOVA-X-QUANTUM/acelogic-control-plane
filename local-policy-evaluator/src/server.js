// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : SERVER
// # Environment   : Development
// # Version       : 4.0.1
// # Updated       : 2026-05-12
// #           
// ############################################################

// updated version
//(metrics + audit logging + cache)

import fs from 'fs';
import https from 'https';
import express from 'express';
import k8s from '@kubernetes/client-node';
import { evaluatePodAgainstPolicy } from './evaluator.js';

const app = express();
app.use(express.json({ limit: '128kb' }));

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

const POLICY_NAMESPACE = process.env.POLICY_NAMESPACE || 'acelogic-system';
const CACHE_REFRESH_MS = 10000;

// Cache
let policyCache = new Map();
let cacheInitialized = false;
let refreshing = false;

async function refreshCache() {
  if (refreshing) return;
  refreshing = true;
  try {
    const res = await customApi.listNamespacedCustomObject(
      'acelogic.ai', 'v1', POLICY_NAMESPACE, 'agentidentitypolicies'
    );
    const items = res.body.items || [];
    const newCache = new Map();
    for (const item of items) {
      const agentId = item.spec?.agentId;
      if (agentId) newCache.set(agentId, item);
    }
    policyCache = newCache;
    if (!cacheInitialized) {
      cacheInitialized = true;
      console.log(`Cache initialized with ${policyCache.size} policies`);
    } else {
      console.log(`Cache refreshed: ${policyCache.size} policies`);
    }
  } catch (err) {
    console.error('Failed to refresh policy cache', err);
  } finally {
    refreshing = false;
  }
}

// Start first refresh immediately, then periodically
refreshCache();
setInterval(refreshCache, CACHE_REFRESH_MS);

function getPolicyByAgentId(agentId) {
  return policyCache.get(agentId) || null;
}

// Metrics counters
let metrics = {
  admission_allow_total: 0,
  admission_deny_total: 0,
  identity_verify_fail_total: 0,
  purpose_verify_fail_total: 0,
  continuity_fail_total: 0,
  lease_expired_total: 0,
};

function incrementMetrics(decision, reason) {
  if (decision.allowed) {
    metrics.admission_allow_total++;
  } else {
    metrics.admission_deny_total++;
    if (reason.includes('FINGERPRINT')) metrics.identity_verify_fail_total++;
    else if (reason.includes('PURPOSE')) metrics.purpose_verify_fail_total++;
    else if (reason.includes('DUPLICATE')) metrics.continuity_fail_total++;
    else if (reason.includes('LEASE')) metrics.lease_expired_total++;
  }
}

function admissionResponse(uid, allowed, reason) {
  return {
    apiVersion: 'admission.k8s.io/v1',
    kind: 'AdmissionReview',
    response: {
      uid,
      allowed,
      status: { code: allowed ? 200 : 403, message: allowed ? 'APPROVED' : `DENIED: ${reason}` }
    }
  };
}

app.post('/validate', async (req, res) => {
  const review = req.body;
  const request = review.request;
  const uid = request?.uid;
  try {
    if (!request) return res.json(admissionResponse(uid, false, 'INVALID_REQUEST'));
    if (request.operation === 'DELETE') return res.json(admissionResponse(uid, true, 'DELETE_ALLOWED'));
    if (request.kind?.kind !== 'Pod') return res.json(admissionResponse(uid, true, 'NON_POD_BYPASS'));

    const pod = request.object;
    const agentId = pod.metadata?.labels?.['acelogic.ai/agent-id'];
    if (!agentId) return res.json(admissionResponse(uid, false, 'MISSING_AGENT_ID'));

    const policy = getPolicyByAgentId(agentId);
    const decision = evaluatePodAgainstPolicy({ pod, policy });
    incrementMetrics(decision, decision.reason);

    const auditLog = {
      agent_id: agentId,
      namespace: pod.metadata.namespace,
      pod: pod.metadata.name,
      decision: decision.allowed ? "ALLOW" : "DENY",
      reason: decision.reason,
      fingerprint_status: decision.reason.includes('FINGERPRINT') ? "FAIL" : "PASS",
      purpose_status: decision.reason.includes('PURPOSE') ? "FAIL" : "PASS",
      continuity_status: decision.reason.includes('DUPLICATE') ? "FAIL" : "PASS",
      lease_status: decision.reason.includes('LEASE') ? "FAIL" : "PASS",
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(auditLog));

    return res.json(admissionResponse(uid, decision.allowed, decision.reason));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message, stack: err.stack }));
    return res.json(admissionResponse(uid, false, `LOCAL_POLICY_ERROR:${err.message}`));
  }
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  let output = '';
  for (const [k, v] of Object.entries(metrics)) {
    output += `${k} ${v}\n`;
  }
  res.send(output);
});

app.get('/healthz', (_, res) => res.json({ ok: true }));
app.get('/readyz', (_, res) => {
  if (!cacheInitialized) {
    return res.status(503).json({ ok: false, reason: 'cache not ready' });
  }
  return res.json({ ok: true });
});

const options = {
  key: fs.readFileSync('/app/tls/tls.key'),
  cert: fs.readFileSync('/app/tls/tls.crt'),
};

const PORT = process.env.PORT || 8443;
https.createServer(options, app).listen(PORT, () => {
  console.log(`ACELOGIC Local Policy Evaluator (HTTPS) with cache, metrics, audit on :${PORT}`);
});



// ############################################################
// # End of File: server.js
// # Do not modify without code review
// ############################################################

