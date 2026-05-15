# ACELOGIC Fail‑Closed / Fail‑Open Policy

## Admission Operations

- CREATE and UPDATE operations on pods are fail‑closed.
  - If the ACELOGIC webhook is unreachable, returns an error, or rejects the request, the pod is not created.
  - This ensures that no workload runs without a verified identity.

- DELETE operations on pods are fail‑open.
  - The webhook does not intercept DELETE requests.
  - Deletions are always allowed, even when the verifier is down, to prevent lock‑in and allow cluster recovery.

