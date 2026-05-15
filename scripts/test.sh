# ############################################################
# #                ACELOGIC PLATFORM v4                      #
# ############################################################
# # Module        : TEST
# # Environment   : Development
# # Version       : 4.0.0
# # Updated       : 2026-05-10
# #            
# ############################################################

#!/bin/bash
echo "Test 1: valid pod "
kubectl apply -f ../tests/pod-valid-enterprise.yaml
sleep 2
kubectl get pod enterprise-agent -n us-enterprise-partner-ai


echo "Test 2: invalid pod (wrong namespace)"
kubectl apply -f ../tests/pod-invalid-us-namespace.yaml
sleep 2
kubectl get events --field-selector involvedObject.name=invalid-agent

echo "Test 3: delete operation  succeed"
kubectl delete pod enterprise-agent -n us-enterprise-partner-ai --ignore-not-found

# ############################################################
# # End of File: test.sh
# # Do not modify without code review
# ############################################################

