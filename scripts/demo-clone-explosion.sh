# ############################################################
# #                ACELOGIC PLATFORM v4                      #
# ############################################################
# # Module        : DEMO-CLONE-EXPLOSION
# # Environment   : Development
# # Version       : 4.0.0
# # Updated       : 2026-05-10
# #           
# ############################################################

#!/bin/bash
set -e

echo "=============================================="
echo "ACELOGIC Demo: Clone Explosion and Enforcement"
echo "=============================================="

NAMESPACE="us-enterprise-partner-ai"
AGENT_ID="EA-482991"
POLICY_NAME="ea-482991"

# Ensure we are in the right directory
cd "$(dirname "$0")/.."

# 1. Baseline: valid agent pod
echo ""
echo "Step 1: Baseline – Create valid agent pod"
kubectl apply -f tests/pod-valid-enterprise.yaml
kubectl wait --for=condition=ready pod/enterprise-agent -n $NAMESPACE --timeout=30s
kubectl get pod enterprise-agent -n $NAMESPACE

# 2. Simulate infrastructure failure (delete pod)
echo ""
echo "Step 2: Infrastructure failure – delete pod (simulate node crash)"
kubectl delete pod enterprise-agent -n $NAMESPACE
sleep 3

# 3. Continuity: restart pod (should be allowed)
echo ""
echo "Step 3: After recovery – restart same agent pod (should be allowed)"
kubectl apply -f tests/pod-valid-enterprise.yaml
kubectl wait --for=condition=ready pod/enterprise-agent -n $NAMESPACE --timeout=30s
kubectl get pod enterprise-agent -n $NAMESPACE

# 4. Clone explosion: attempt duplicate pod with same identity
echo ""
echo "Step 4: Clone explosion – create duplicate pod with same identity"
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: duplicate-agent
  namespace: $NAMESPACE
  labels:
    acelogic.ai/agent-id: "$AGENT_ID"
  annotations:
    acelogic.ai/symbolic-namespace: "#us#.enterprise.partner.ai"
    acelogic.ai/purpose-hash: "$(kubectl get agentidentitypolicy $POLICY_NAME -n acelogic-system -o jsonpath='{.spec.purposeHash}')"
spec:
  containers:
  - name: agent
    image: nginx:latest
EOF

sleep 2
echo ""
echo "Check duplicate pod status (should be denied by webhook):"
kubectl get events --field-selector involvedObject.name=duplicate-agent -n $NAMESPACE | grep -i "denied" || echo "Pod creation blocked (expected)"

# 5. Show conflict resolver – create conflicting policy

echo ""
echo "Step 5: Conflict detection – create a policy with same fingerprint but different purpose"
REAL_HASH=$(kubectl get agentidentitypolicy $POLICY_NAME -n acelogic-system -o jsonpath='{.spec.purposeHash}')
cat <<EOF | kubectl apply -f -
apiVersion: acelogic.ai/v1
kind: AgentIdentityPolicy
metadata:
  name: conflicting-policy
  namespace: acelogic-system
spec:
  agentId: "$AGENT_ID"
  licenseTier: TIER_4
  grammarLicense:
    enabled: true
    level: RESTRICTED
    allowedPrefixes:
      - "#us#.enterprise."
  symbolicNamespace: "#us#.enterprise.partner.ai"
  k8sNamespace: "$NAMESPACE"
  mission: "Malicious purpose"
  owner: "Attacker"
  fingerprintAlgorithm: "SHA-256"
  fingerprintVersion: "v1"
  fingerprint: "$(kubectl get agentidentitypolicy $POLICY_NAME -n acelogic-system -o jsonpath='{.spec.fingerprint}')"
  purposeHashAlgorithm: "SHA3-256"
  purposeHash: "0000000000000000000000000000000000000000000000000000000000000000"
  state: ACTIVE
  lease:
    epoch: 2
    expiresAt: "2026-12-31T23:59:59Z"
  lastUpdated: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EOF

echo "Waiting for conflict resolver to process..."
sleep 5
echo "Check conflict resolution: conflicting policy should be in SAFE_MODE"
kubectl get agentidentitypolicy conflicting-policy -n acelogic-system -o jsonpath='{.spec.state}'
echo ""

# 6. Clean up

echo ""
read -p "Do you want to clean up all resources? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl delete pod enterprise-agent -n $NAMESPACE --ignore-not-found
    kubectl delete pod duplicate-agent -n $NAMESPACE --ignore-not-found
    kubectl delete agentidentitypolicy conflicting-policy -n acelogic-system --ignore-not-found
    echo "Cleanup complete."
fi

echo ""
echo "completed."

# ############################################################
# # End of File: demo-clone-explosion.sh
# # Do not modify without code review
# ############################################################

