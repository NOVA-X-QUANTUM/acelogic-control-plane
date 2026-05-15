# ############################################################
# #                ACELOGIC PLATFORM v4                      #
# ############################################################
# # Module        : GENERATE-CERTS
# # Environment   : Development
# # Version       : 4.0.2
# # Updated       : 2026-05-12
# #          
# ############################################################

#!/bin/bash

set -e
mkdir -p ../local-policy-evaluator/tls
cd ../local-policy-evaluator/tls

cat > ca-config.json <<EOF
{
  "signing": {
    "default": { "expiry": "8760h" },
    "profiles": {
      "webhook": { "expiry": "8760h", "usages": ["signing", "key encipherment", "server auth"] }
    }
  }
}
EOF

cat > ca-csr.json <<EOF
{
  "CN": "ACELOGIC CA",
  "key": { "algo": "rsa", "size": 2048 }
}
EOF

openssl genrsa -out ca-key.pem 2048
openssl req -x509 -new -nodes -key ca-key.pem -days 365 -out ca.pem -subj "/CN=ACELOGIC-CA"

cat > webhook-csr.json <<EOF
{
  "CN": "acelogic-evaluator.acelogic-system.svc",
  "key": { "algo": "rsa", "size": 2048 },
  "hosts": [
    "acelogic-evaluator",
    "acelogic-evaluator.acelogic-system",
    "acelogic-evaluator.acelogic-system.svc",
    "acelogic-evaluator.acelogic-system.svc.cluster.local"
  ]
}
EOF

openssl genrsa -out webhook-key.pem 2048
openssl req -new -key webhook-key.pem -out webhook.csr -config <(cat webhook-csr.json)
openssl x509 -req -in webhook.csr -CA ca.pem -CAkey ca-key.pem -CAcreateserial -out webhook.pem -days 365 -extensions v3_req -extfile <(echo -e "[v3_req]\nsubjectAltName=DNS:acelogic-evaluator,DNS:acelogic-evaluator.acelogic-system,DNS:acelogic-evaluator.acelogic-system.svc,DNS:acelogic-evaluator.acelogic-system.svc.cluster.local")

cp webhook.pem tls.crt
cp webhook-key.pem tls.key
cp ca.pem ca.crt

echo "Certificates generated"

# ############################################################
# # End of File: generate-certs.sh
# # Do not modify without code review
# ############################################################

