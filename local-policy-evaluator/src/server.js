// ############################################################
// #                ACELOGIC PLATFORM v4                      #
// ############################################################
// # Module        : SERVER
// # Environment   : Development
// # Version       : 4.1.0
// # Updated       : 2026-05-15
// #
// # Purpose:
// # HTTPS admission webhook server for the
// # ACELOGIC™ Local Policy Evaluator.
//
// # Responsibilities:
// # - Kubernetes admission handling
// # - deterministic identity enforcement
// # - continuity-aware runtime governance
// # - policy cache synchronization
// # - metrics exposure
// # - structured audit logging
// # - fail-closed admission control
// #
// ############################################################

import fs from 'fs';
import https from 'https';
import express from 'express';
import crypto from 'crypto';

import k8s from '@kubernetes/client-node';

import {
  evaluatePodAgainstPolicy
} from './evaluator.js';

// ------------------------------------------------------------------
// Express Application
// ------------------------------------------------------------------

const app = express();

app.use(
  express.json({
    limit: '128kb'
  })
);

// ------------------------------------------------------------------
// Kubernetes Client
// ------------------------------------------------------------------

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

const customApi =
  kc.makeApiClient(
    k8s.CustomObjectsApi
  );

// ------------------------------------------------------------------
// Runtime Configuration
// ------------------------------------------------------------------

const POLICY_NAMESPACE =
  process.env.POLICY_NAMESPACE ||
  'acelogic-system';

const CACHE_REFRESH_MS =
  Number(
    process.env.CACHE_REFRESH_MS || 10000
  );

const ACELOGIC_MODE =
  process.env.ACELOGIC_MODE ||
  'FAIL_CLOSED';

// ------------------------------------------------------------------
// Policy Cache
// ------------------------------------------------------------------

let policyCache = new Map();

let cacheInitialized = false;

let refreshing = false;

/**
 * Refreshes local policy cache from Kubernetes API.
 */
async function refreshCache() {

  if (refreshing) {
    return;
  }

  refreshing = true;

  try {

    const response =
      await customApi.listNamespacedCustomObject(
        'acelogic.ai',
        'v1',
        POLICY_NAMESPACE,
        'agentidentitypolicies'
      );

    const items =
      response.body.items || [];

    const newCache = new Map();

    for (const item of items) {

      const agentId =
        item.spec?.agentId;

      if (agentId) {
        newCache.set(agentId, item);
      }
    }

    policyCache = newCache;

    const logEvent = {
      event: cacheInitialized
        ? 'CACHE_REFRESH'
        : 'CACHE_INITIALIZED',

      policyCount:
        policyCache.size,

      timestamp:
        new Date().toISOString()
    };

    console.log(
      JSON.stringify(logEvent)
    );

    cacheInitialized = true;

  } catch (error) {

    console.error(
      JSON.stringify({
        event: 'CACHE_REFRESH_FAILED',
        error: error.message,
        timestamp:
          new Date().toISOString()
      })
    );

  } finally {

    refreshing = false;
  }
}

// ------------------------------------------------------------------
// Cache Bootstrap
// ------------------------------------------------------------------

refreshCache();

setInterval(
  refreshCache,
  CACHE_REFRESH_MS
);

/**
 * Retrieves policy by deterministic agent ID.
 */
function getPolicyByAgentId(agentId) {

  return (
    policyCache.get(agentId) || null
  );
}

// ------------------------------------------------------------------
// Metrics
// ------------------------------------------------------------------

const metrics = {

  admission_allow_total: 0,

  admission_deny_total: 0,

  identity_verify_fail_total: 0,

  purpose_verify_fail_total: 0,

  continuity_fail_total: 0,

  lease_expired_total: 0,

  policy_cache_refresh_total: 0,

  local_policy_error_total: 0
};

/**
 * Updates metrics counters.
 */
function incrementMetrics(
  decision,
  reason
) {

  if (decision.allowed) {

    metrics.admission_allow_total++;

    return;
  }

  metrics.admission_deny_total++;

  if (reason.includes('FINGERPRINT')) {
    metrics.identity_verify_fail_total++;
  }

  else if (reason.includes('PURPOSE')) {
    metrics.purpose_verify_fail_total++;
  }

  else if (
    reason.includes('CONTINUITY') ||
    reason.includes('DUPLICATE')
  ) {
    metrics.continuity_fail_total++;
  }

  else if (reason.includes('LEASE')) {
    metrics.lease_expired_total++;
  }
}

/**
 * Generates Kubernetes admission response.
 */
function admissionResponse(
  uid,
  allowed,
  reason
) {

  return {
    apiVersion: 'admission.k8s.io/v1',

    kind: 'AdmissionReview',

    response: {
      uid,

      allowed,

      status: {
        code: allowed ? 200 : 403,

        message: allowed
          ? 'ACELOGIC_APPROVED'
          : `ACELOGIC_DENIED:${reason}`
      }
    }
  };
}

// ------------------------------------------------------------------
// Admission Webhook
// ------------------------------------------------------------------

app.post(
  '/validate',
  async (req, res) => {

    const review =
      req.body;

    const request =
      review.request;

    const uid =
      request?.uid;

    try {

      // ------------------------------------------------------------
      // Request validation
      // ------------------------------------------------------------

      if (!request) {

        return res.json(
          admissionResponse(
            uid,
            false,
            'ACELOGIC_INVALID_REQUEST'
          )
        );
      }

      // ------------------------------------------------------------
      // DELETE operations bypass enforcement
      // ------------------------------------------------------------

      if (
        request.operation === 'DELETE'
      ) {

        return res.json(
          admissionResponse(
            uid,
            true,
            'ACELOGIC_DELETE_ALLOWED'
          )
        );
      }

      // ------------------------------------------------------------
      // Non-Pod resources bypass
      // ------------------------------------------------------------

      if (
        request.kind?.kind !== 'Pod'
      ) {

        return res.json(
          admissionResponse(
            uid,
            true,
            'ACELOGIC_NON_POD_BYPASS'
          )
        );
      }

      const pod =
        request.object;

      const agentId =
        pod.metadata?.labels?.[
          'acelogic.ai/agent-id'
        ];

      // ------------------------------------------------------------
      // Missing identity
      // ------------------------------------------------------------

      if (!agentId) {

        return res.json(
          admissionResponse(
            uid,
            false,
            'ACELOGIC_MISSING_AGENT_ID'
          )
        );
      }

      // ------------------------------------------------------------
      // Policy lookup
      // ------------------------------------------------------------

      const policy =
        getPolicyByAgentId(agentId);

      // ------------------------------------------------------------
      // Deterministic evaluation
      // ------------------------------------------------------------

      const decision =
        evaluatePodAgainstPolicy({
          pod,
          policy
        });

      incrementMetrics(
        decision,
        decision.reason
      );

      // ------------------------------------------------------------
      // Structured audit log
      // ------------------------------------------------------------

      const auditLog = {

        event: 'ADMISSION_EVALUATION',

        requestUid: uid,

        agentId,

        namespace:
          pod.metadata.namespace,

        pod:
          pod.metadata.name,

        decision:
          decision.allowed
            ? 'ALLOW'
            : 'DENY',

        reason:
          decision.reason,

        fingerprintStatus:
          decision.reason.includes('FINGERPRINT')
            ? 'FAIL'
            : 'PASS',

        purposeStatus:
          decision.reason.includes('PURPOSE')
            ? 'FAIL'
            : 'PASS',

        continuityStatus:
          decision.reason.includes('CONTINUITY')
            ? 'FAIL'
            : 'PASS',

        leaseStatus:
          decision.reason.includes('LEASE')
            ? 'FAIL'
            : 'PASS',

        timestamp:
          new Date().toISOString()
      };

      console.log(
        JSON.stringify(auditLog)
      );

      return res.json(
        admissionResponse(
          uid,
          decision.allowed,
          decision.reason
        )
      );

    } catch (error) {

      metrics.local_policy_error_total++;

      console.error(
        JSON.stringify({
          event: 'LOCAL_POLICY_ERROR',

          error:
            error.message,

          stack:
            error.stack,

          timestamp:
            new Date().toISOString()
        })
      );

      return res.json(
        admissionResponse(
          uid,
          false,
          `ACELOGIC_LOCAL_POLICY_ERROR:${error.message}`
        )
      );
    }
  }
);

// ------------------------------------------------------------------
// Metrics Endpoint
// ------------------------------------------------------------------

app.get('/metrics', (_, res) => {

  res.set(
    'Content-Type',
    'text/plain'
  );

  let output = '';

  for (
    const [key, value]
    of Object.entries(metrics)
  ) {

    output += `${key} ${value}\n`;
  }

  res.send(output);
});

// ------------------------------------------------------------------
// Health Endpoints
// ------------------------------------------------------------------

app.get('/healthz', (_, res) => {

  return res.json({
    ok: true,
    mode: ACELOGIC_MODE
  });
});

app.get('/readyz', (_, res) => {

  if (!cacheInitialized) {

    return res
      .status(503)
      .json({
        ok: false,
        reason: 'CACHE_NOT_READY'
      });
  }

  return res.json({
    ok: true
  });
});

// ------------------------------------------------------------------
// HTTPS Server
// ------------------------------------------------------------------

const tlsOptions = {

  key:
    fs.readFileSync(
      '/app/tls/tls.key'
    ),

  cert:
    fs.readFileSync(
      '/app/tls/tls.crt'
    )
};

const PORT =
  process.env.PORT || 8443;

https
  .createServer(
    tlsOptions,
    app
  )
  .listen(PORT, () => {

    console.log(
      JSON.stringify({
        event: 'ACELOGIC_SERVER_STARTED',

        mode: ACELOGIC_MODE,

        policyNamespace:
          POLICY_NAMESPACE,

        port: PORT,

        timestamp:
          new Date().toISOString()
      })
    );
  });

// ############################################################
// # End of File: server.js
// # Do not modify without code review
// ############################################################