#!/bin/sh
echo "Starting Vault in development mode with tls..."

vault server -dev \
  -dev-root-token-id=${VAULT_TOKEN:-dev-root-token} \
  -dev-listen-address=0.0.0.0:8200 \
  -dev-tls &

until curl -s -k --insecure https://localhost:8200/v1/sys/health > /dev/null; do
  echo "Waiting for Vault to start..."
  sleep 1
done

echo "Initializing Vault..."
sh /vault/scripts/vault-init.sh

tail -f /dev/null
