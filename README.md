
<!--
##############################################################################
# ACELOGIC PLATFORM v4.1.0
# Module        : README 
# Environment   : Production
# Updated       : 2026-05-15
##############################################################################
-->

# 🧠 ACELOGIC Control Plane  
## *Deterministic Identity & Execution Governance for Distributed AI Infrastructure*

<p align="center">
  <strong>Kubernetes decides <em>where</em> workloads run.</strong><br/>
  <strong>ACELOGIC decides <em>whether</em> they are allowed to run.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.1.0-blue.svg" alt="Version"/>
  <img src="https://img.shields.io/badge/environment-production-green.svg" alt="Production"/>
  <img src="https://img.shields.io/badge/governance-fail--closed-red.svg" alt="Fail Closed"/>
  <img src="https://img.shields.io/badge/license-source--available-lightgrey.svg" alt="License"/>
</p>

---

## ✨ Overview

This production‑grade implementation provides a **decentralized identity control plane** for AI infrastructure.  
It delivers deterministic identity enforcement, license‑gated symbolic grammar, and sovereign execution control —  
**without external verifiers or centralized state**.

---

## 📦 Components

| Component                       | Description                                                                                                                                                     |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Identity Compiler SDK**       | Deterministic CRD generator using dual‑hash (SHA‑256 fingerprint + SHA3‑256 purpose hash), grammar licensing, covenant rules, and namespace projection.         |
| **Local Policy Evaluator**      | Standalone Kubernetes admission webhook that caches `AgentIdentityPolicy` CRDs and enforces admission locally (no Redis, no external verifier). Includes Prometheus metrics and structured audit logging. |
| **AgentIdentityPolicy CRD**     | Full Kubernetes CRD with schema validation and printer columns.                                                                                                 |
| **Example Policies**            | Enterprise agent policy, namespace projection, and test pods (valid and invalid).                                                                               |

> **Note:** The full ACELOGIC Conflict Resolver (proprietary reconciliation engine) is not included in this public reference. Contact ACELOGIC for the enterprise version.

---

## 🏛️ Architecture Overview

The system follows a **decentralized, Git‑driven policy distribution model**:

1. Any compliant origin (ACELOGIC.ai, enterprise portal, sovereign portal) uses the **Identity Compiler SDK** to produce an `AgentIdentityPolicy` CRD.
2. Policies are stored in a Git repository and distributed via **Config Sync**.
3. Each cluster runs a **Local Policy Evaluator** (admission webhook) that caches policies from the Kubernetes API server (periodic list; a watch‑based informer plan is documented in `docs/cache-implementation-plan.md`).

### 🔁 System Flow

```text
ACELOGIC PROTOCOL LAYER 
         │
         ├── ACELOGIC.ai (Tier 0–2)
         ├── Enterprise Portal (Tier 3–4)
         └── Sovereign Portal (Tier 5)
                │
                ▼
        Identity Compiler SDK
                │
                ▼
        AgentIdentityPolicy CRD
                │
                ▼
        Git / Policy Registry
                │
                ▼
        Config Sync
                │
                ▼
        Cluster‑local Policy Layer 
                │
                ▼
        Admission Webhook 
                │
                ▼
        ALLOW / DENY
```

### 🧭 Architecture Boundary Diagram

```
AI Agents / Workloads
        │
        ▼
┌───────────────────────────────┐
│   ACELOGIC Control Plane      │
│  (Identity + Authority +      │
│   Continuity + SAFE_MODE)     │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│         Kubernetes            │
│   (Orchestration + Compute)   │
└───────────────────────────────┘
        │
        ▼
     Infrastructure
```

---

## ✅ Prerequisites

Install the following dependencies before deployment:

- 🐳 Docker  
- 🧩 `kind` or `minikube`  
- ☸️ `kubectl`  
- 🔐 `openssl`  
- 📦 Node.js (for the Identity Compiler SDK)

---

## 🚀 Quick Start

Clone the repository and run the following commands from the `scripts` directory:

```bash
cd scripts
chmod +x *.sh
./generate-certs.sh     # Generates TLS certificates using OpenSSL
./deploy.sh             # Builds the Docker image and deploys the webhook
./test.sh               # Basic acceptance tests
```

For a full suite of **hardening tests**, run:

```bash
./complete-tests.sh
```

---

## 📊 Metrics and Audit Logging

### 📈 Metrics Endpoint

The webhook exposes a Prometheus‑style endpoint at `/metrics` with the following counters:

| Metric                         | Description                                      |
|--------------------------------|--------------------------------------------------|
| `admission_allow_total`        | Approved pod creations                          |
| `admission_deny_total`         | Rejected pod creations                          |
| `identity_verify_fail_total`   | Rejections due to fingerprint mismatch          |
| `purpose_verify_fail_total`    | Rejections due to purpose hash mismatch         |
| `continuity_fail_total`        | Rejections due to duplicate identity            |
| `lease_expired_total`          | Rejections due to expired lease                 |

To scrape metrics, configure Prometheus to target the webhook service on port `8443` with the `/metrics` path.

### 📝 Audit Logging

All admission decisions are logged in **structured JSON format**, including:

- Timestamp  
- Request UID  
- Pod namespace and name  
- Decision (`ALLOW` / `DENY`)  
- Denial reason (if applicable)  
- Policy fingerprint (if matched)

---

## 🧪 Testing

| Test Script               | Purpose                                                                             |
|---------------------------|-------------------------------------------------------------------------------------|
| `test.sh`                 | Basic acceptance: valid pod (ALLOW), invalid pod (DENY), delete operation (ALLOW).  |
| `complete-tests.sh`       | Hardening validation: missing fingerprint, invalid purpose hash, expired lease, duplicate identity, delete. |

Run `./complete-tests.sh` to verify all denial reasons.

---

## 📁 Directory Structure

```text
acelogic-devops/
├── identity-compiler/       # SDK source (public reference)
├── local-policy-evaluator/  # Webhook source and Dockerfile (public reference)
├── crd/                     # AgentIdentityPolicy CRD
├── config-sync-repo/        # Example Git repository structure
├── k8s/                     # Kubernetes manifests
├── tests/                   # Test pod definitions
├── scripts/                 # Deployment and test automation
├── docs/                    # Additional documentation
└── README.md                # This file
```

> The proprietary `conflict-resolver/` component is not included in this public repository. Contact ACELOGIC for the full enterprise version.

---

## 🔒 Security

| Area                     | Implementation                                                                                 |
|--------------------------|------------------------------------------------------------------------------------------------|
| **TLS mutual auth**      | Webhook runs with a CA‑signed certificate; API server validates via CA bundle in `ValidatingWebhookConfiguration`. |
| **HTTPS only**           | Listens exclusively on port `8443` — no plain HTTP endpoints.                                  |
| **Minimal RBAC**         | Service account has only `get`, `list`, `watch` on `agentidentitypolicies`.                    |
| **Namespace isolation**  | Webhook limited to namespaces labelled `acelogic.ai/enabled: "true"`.                          |







---

## 📊 Capability Matrix

| Capability                     | Status          |
|--------------------------------|-----------------|
| Admission Enforcement          | ✅ Implemented  |
| Lease Validation               | ✅ Implemented  |
| SAFE_MODE                      | ✅ Implemented  |
| Namespace Projection           | ✅ Implemented  |
| Metrics                        | ✅ Implemented  |
| Audit Logging                  | ✅ Implemented  |
| Conflict Resolution            | ⚠️ Proprietary  |


---

## 🌐 Public Reference Architecture

This repository is the **public reference implementation** of the ACELOGIC control plane for deterministic identity governance.  

**Included in this public repo:**

- Identity Compiler SDK (core fingerprint and purpose hash)  
- Admission webhook skeleton (cache, metrics, audit logging)  
- AgentIdentityPolicy CRD and Kubernetes deployment manifests  
- Example Config Sync structure and test pods  
- Deployment scripts (TLS generation, deployment, testing)  


For the full enterprise implementation, contact ACELOGIC.

---

## 📄 License

This software is **source‑available** for reference and evaluation.  
Redistribution, modification, or commercial use requires explicit permission from ACELOGIC.  
See the `LICENSE` file in the repository root for details.

---

<!--
##############################################################################
# End of File: README.md
# Do not modify without code review
##############################################################################
-->

