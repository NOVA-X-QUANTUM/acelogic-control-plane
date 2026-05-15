# ############################################################
# #                ACELOGIC PLATFORM v4                      #
# ############################################################
# # Module        : DEPLOY
# # Environment   : Development
# # Version       : 4.0.2
# # Updated       : 2026-05-12
# #          
# ############################################################

#!/bin/bash
set -e

cd ../local-policy-evaluator
docker build -t acelogic/evaluator:v4.0.2 .
kind load docker-image acelogic/evaluator:v4.0.0 --name acelogic

cd ..

kubectl apply -f crd/agentidentitypolicy-crd.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/validating-webhook.yaml  

# Create TLS secret BEFORE deployment
kubectl create secret generic acelogic-evaluator-tls \
  --from-file=tls.crt=local-policy-evaluator/tls/tls.crt \
  --from-file=tls.key=local-policy-evaluator/tls/tls.key \
  -n acelogic-system --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s/evaluator-deployment.yaml

kubectl wait --for=condition=ready pod -l app=acelogic-evaluator -n acelogic-system --timeout=60s

# Patch webhook with CA bundle
CA_BUNDLE=$(cat local-policy-evaluator/tls/ca.crt | base64 | tr -d '\n')
kubectl patch validatingwebhookconfiguration acelogic-evaluator --type='json' -p="[{'op': 'add', 'path': '/webhooks/0/clientConfig/caBundle', 'value':'${CA_BUNDLE}'}]"

kubectl apply -f config-sync-repo/namespaces/us-enterprise-partner-ai.yaml
kubectl apply -f config-sync-repo/identities/ea-482991.yaml

echo "Completed deployment of ACELOGIC "


# ############################################################
# # End of File: deploy.sh
# # Do not modify without code review
# ############################################################

