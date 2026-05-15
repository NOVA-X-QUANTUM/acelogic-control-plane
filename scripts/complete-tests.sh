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

NAMESPACE="us-enterprise-partner-ai"
AGENT_ID="EA-482991"
POLICY_NAME="ea-482991"
DEPLOY_NS="acelogic-system"

cd "$(dirname "$0")/.."

echo "============================================================"
echo "ACELOGIC Tests"
echo "============================================================"

# Helper: expect DENY

expect_deny() {
    if kubectl apply -f - 2>&1 | grep -q "denied"; then
        echo " Denied as expected"
    else
        echo " Expected DENY but got ALLOW"
        exit 1
    fi
}

# Helper: expect ALLOW

expect_allow() {
    if kubectl apply -f - 2>&1 | grep -q "created"; then
        echo " Allowed as expected"
        kubectl delete -f - --ignore-not-found > /dev/null 2>&1
    else
        echo " Expected ALLOW but got DENY"
        exit 1
    fi
}
# valid pod test

echo "1. Valid canonical agent -> ALLOW"
cat <<EOF | expect_allow
apiVersion: v1
kind: Pod
metadata:
  name: test-valid
  namespace: $NAMESPACE
  labels:
    acelogic.ai/agent-id: "$AGENT_ID"
  annotations:
    acelogic.ai/symbolic-namespace: "#us#.enterprise.partner.ai"
    acelogic.ai/purpose-hash: "$(kubectl get agentidentitypolicy $POLICY_NAME -n $DEPLOY_NS -o jsonpath='{.spec.purposeHash}')"
spec:
  containers:
  - name: agent
    image: nginx:latest
EOF


# missing label test

echo "2. Missing fingerprint label -> DENY"
cat <<EOF | expect_deny
apiVersion: v1
kind: Pod
metadata:
  name: test-no-fingerprint
  namespace: $NAMESPACE
  annotations:
    acelogic.ai/symbolic-namespace: "#us#.enterprise.partner.ai"
    acelogic.ai/purpose-hash: "somehash"
spec:
  containers:
  - name: agent
    image: nginx:latest
EOF

#invalid purpose hash test

echo "3. Invalid purpose hash -> DENY"
cat <<EOF | expect_deny
apiVersion: v1
kind: Pod
metadata:
  name: test-bad-purpose
  namespace: $NAMESPACE
  labels:
    acelogic.ai/agent-id: "$AGENT_ID"
  annotations:
    acelogic.ai/symbolic-namespace: "#us#.enterprise.partner.ai"
    acelogic.ai/purpose-hash: "0000000000000000000000000000000000000000000000000000000000000000"
spec:
  containers:
  - name: agent
    image: nginx:latest
EOF

echo "4. Expired lease -> DENY"

# set lease to past

kubectl patch agentidentitypolicy $POLICY_NAME -n $DEPLOY_NS --type merge -p '{"spec":{"lease":{"expiresAt":"2000-01-01T00:00:00Z"}}}'
sleep 2 # allow cache to refresh (or wait)
cat <<EOF | expect_deny
apiVersion: v1
kind: Pod
metadata:
  name: test-expired
  namespace: $NAMESPACE
  labels:
    acelogic.ai/agent-id: "$AGENT_ID"
  annotations:
    acelogic.ai/symbolic-namespace: "#us#.enterprise.partner.ai"
    acelogic.ai/purpose-hash: "$(kubectl get agentidentitypolicy $POLICY_NAME -n $DEPLOY_NS -o jsonpath='{.spec.purposeHash}')"
spec:
  containers:
  - name: agent
    image: nginx:latest
EOF
# Restore lease

kubectl patch agentidentitypolicy $POLICY_NAME -n $DEPLOY_NS --type merge -p '{"spec":{"lease":{"expiresAt":"2026-12-31T23:59:59Z"}}}'

echo "5. Duplicate canonical identity -> DENY"
# Create a valid pod first
kubectl apply -f tests/pod-valid-enterprise.yaml > /dev/null 2>&1
sleep 2
cat <<EOF | expect_deny
apiVersion: v1
kind: Pod
metadata:
  name: test-duplicate
  namespace: $NAMESPACE
  labels:
    acelogic.ai/agent-id: "$AGENT_ID"
  annotations:
    acelogic.ai/symbolic-namespace: "#us#.enterprise.partner.ai"
    acelogic.ai/purpose-hash: "$(kubectl get agentidentitypolicy $POLICY_NAME -n $DEPLOY_NS -o jsonpath='{.spec.purposeHash}')"
spec:
  containers:
  - name: agent
    image: nginx:latest
EOF
kubectl delete pod enterprise-agent -n $NAMESPACE --ignore-not-found

echo "6. DELETE request "
kubectl run test-delete --image=nginx -n $NAMESPACE
kubectl delete pod test-delete -n $NAMESPACE

echo " DELETE succeeded"

#echo "All tests passed."



# ############################################################
# # End of File: complete-tests.sh
# # Do not modify without code review
# ############################################################