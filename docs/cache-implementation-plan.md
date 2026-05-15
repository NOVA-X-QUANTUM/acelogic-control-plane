


# Policy Cache Implementation Plan

## Current State
The webhook uses a periodic `list` call (every 10 seconds) to refresh the in‑memory policy cache.

## Production Target
Replace the periodic list with a Kubernetes shared informer watching `AgentIdentityPolicy` resources.

### Benefits
- Near‑instant updates when policies change (no polling delay).
- Reduced API server load (no periodic list of all policies).
- Standard Kubernetes pattern, natively provided by `client-go`.

### Implementation Steps
1. Use `@kubernetes/client-node`'s `watch` API or a future `Informer` implementation.
2. On add/update/delete events, update the local `Map` cache.
3. Remove the `setInterval` refresh.

### Impact
Admission latency will drop because no API call is made on the critical path.

### Fallback
If the informer fails to start, fall back to the periodic list as a safe default.


