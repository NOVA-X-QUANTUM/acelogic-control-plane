# ############################################################
# #                ACELOGIC PLATFORM v4                      #
# ############################################################
# # Module        : DEMO-ENHANCED
# # Environment   : Development
# # Version       : 4.0.0
# # Updated       : 2026-05-10
# #          
# ############################################################

#!/bin/bash
set -e

echo "============================================================"
echo "ACELOGIC Demo (Fail‑Closed, DELETE, Fingerprint, Latency)"
echo "============================================================"

NAMESPACE="us-enterprise-partner-ai"
AGENT_ID="EA-482991"
POLICY_NAME="ea-482991"
DEPLOY_NAMESPACE="acelogic-system"

cd "$(dirname "$0")/.."

# Helper: measure time of kubectl apply
time_kubectl() {
    local start=$(date +%s%N)
    kubectl apply -f "$1" > /dev/null 2>&1
    local end=$(date +%s%N)
    echo "$(( ($end - $start) / 1000000 )) ms"
}

# 1. Baseline – valid pod
echo ""
echo "Baseline: valid agent pod"
kubectl apply -f tests/pod-valid-enterprise.yaml
kubectl wait --for=condition=ready pod/enterprise-agent -n $NAMESPACE --timeout=30s
kubectl get pod enterprise-agent -n $NAMESPACE
echo "Pod created and running."

# 2. Latency measurement
echo ""
echo "Latency overhead (admission webhook round‑trip)"
echo -n "   Time to create valid pod: "
time_kubectl tests/pod-valid-enterprise.yaml

# 3. Delete pod (simulate crash)
echo ""
echo "Simulate node crash – delete pod"
kubectl delete pod enterprise-agent -n $NAMESPACE
sleep 2

# 4. Restart – continuity
echo ""
echo "Restart same agent – identity continuity"
kubectl apply -f tests/pod-valid-enterprise.yaml
kubectl wait --for=condition=ready pod/enterprise-agent -n $NAMESPACE --timeout=30s
echo "Pod restarted and allowed (fingerprint unchanged)."

# 5. Duplicate prevention
echo ""
echo "Clone explosion – duplicate pod with same identity"
cat <<EOF | kubectl apply -f - 2>&1 | grep -q "denied" && echo " Duplicate denied (correct)" || echo " Duplicate allowed (unexpected)"
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

# 6. Metadata change → new fingerprint (should be denied)
echo ""
echo " Identity mutation – same agentId, different metadata"
REAL_HASH=$(kubectl get agentidentitypolicy $POLICY_NAME -n acelogic-system -o jsonpath='{.spec.purposeHash}')
cat <<EOF | kubectl apply -f - 2>&1 | grep -q "denied" && echo " Pod with changed metadata denied (correct)" || echo " Unexpected behavior"
apiVersion: v1
kind: Pod
metadata:
  name: mutated-agent
  namespace: $NAMESPACE
  labels:
    acelogic.ai/agent-id: "$AGENT_ID"
  annotations:
    acelogic.ai/symbolic-namespace: "#us#.enterprise.partner.ai"
    acelogic.ai/purpose-hash: "$REAL_HASH"
    # Add an extra annotation to change metadata
    acelogic.ai/extra: "changed"
spec:
  containers:
  - name: agent
    image: nginx:latest
EOF

# 7. Fail‑closed test (scale webhook to 0)
echo ""
echo " Fail‑closed test – scale webhook to 0"
kubectl scale deployment acelogic-evaluator -n $DEPLOY_NAMESPACE --replicas=0
sleep 5
echo -n "   Attempt to create a pod while webhook is down: "
kubectl apply -f tests/pod-valid-enterprise.yaml 2>&1 | grep -q "Internal error occurred" && echo " Pod creation failed (fail‑closed works)" || echo " Pod was created (fail‑open – not desired)"
# Clean up the failed attempt
kubectl delete pod enterprise-agent -n $NAMESPACE --ignore-not-found

# 8. Fail‑open DELETE test
echo ""
echo " DELETE operation – always allowed (fail‑open)"
kubectl run test-delete --image=nginx -n $NAMESPACE
kubectl wait --for=condition=ready pod/test-delete -n $NAMESPACE --timeout=30s
kubectl delete pod test-delete -n $NAMESPACE


echo " DELETE succeeded (fail‑open enforced)."

# 9. Restore webhook
echo ""
echo " Restore webhook and verify everything works again"
kubectl scale deployment acelogic-evaluator -n $DEPLOY_NAMESPACE --replicas=1
kubectl wait --for=condition=ready pod -l app=acelogic-evaluator -n $DEPLOY_NAMESPACE --timeout=60s
kubectl apply -f tests/pod-valid-enterprise.yaml
kubectl wait --for=condition=ready pod/enterprise-agent -n $NAMESPACE --timeout=30s

echo "Webhook restored, pod creation works."

# 10. Audit log
echo ""
echo "Audit log (last 10 decisions):"
kubectl logs -n $DEPLOY_NAMESPACE -l app=acelogic-evaluator --tail=10 | grep -E "APPROVED|DENIED"

# Cleanup
echo ""
read -p "Clean up all demo resources? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl delete pod enterprise-agent -n $NAMESPACE --ignore-not-found
    kubectl delete pod duplicate-agent -n $NAMESPACE --ignore-not-found
    kubectl delete pod mutated-agent -n $NAMESPACE --ignore-not-found
    echo "Cleanup complete."
fi

echo ""
echo "demo finished."


# ############################################################
# # End of File: demo-enhanced.sh
# # Do not modify without code review
# ############################################################

