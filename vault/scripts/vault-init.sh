#!/bin/bash

VAULT_ADDR="https://localhost:8200"
VAULT_TOKEN="${VAULT_TOKEN:-dev-root-token}"

echo "initializing Vault with secrets..."

MAX_RETRIES=15
RETRY_COUNT=0

until curl -s -k --insecure $VAULT_ADDR/v1/sys/health > /dev/null 2>&1; do
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Vault not ready after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "waiting for Vault to be ready... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT+1))
done

echo "vault is ready!"

KV_STATUS=$(curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
  $VAULT_ADDR/v1/sys/mounts | jq -r '.data."secret/"?.type')

if [ "$KV_STATUS" != "kv" ] && [ "$KV_STATUS" != "kv-v2" ]; then
  echo "enabling KV secrets engine..."
  curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
       -X POST \
       -d '{"type":"kv","options":{"version":"2"}}' \
       $VAULT_ADDR/v1/sys/mounts/secret
else
  echo "KV secrets engine already enabled at secret/"
fi

echo "creating application policy..."
POLICY_CONTENT=$(cat /vault/config/policies/app-policy.hcl | jq -Rs '.')
POLICY_RESPONSE=$(curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
     -H "Content-Type: application/json" \
     -X PUT \
     -d "{\"policy\": $POLICY_CONTENT}" \
     $VAULT_ADDR/v1/sys/policies/acl/app-policy)

echo "Policy upload response: $POLICY_RESPONSE"

if vault policy read app-policy >/dev/null 2>&1; then
    echo "Policy created successfully"
else
    echo "ERROR: Policy creation failed!"
    exit 1
fi

echo "storing JWT secrets..."
curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
     -X POST \
     -d '{
       "data": {
         "secret": "'${JWT_SECRET:-$(openssl rand -base64 64 | tr -d '\n')}'",
         "expire": "'${JWT_EXPIRE:-24h}'",
         "algorithm": "HS256"
       }
     }' \
     $VAULT_ADDR/v1/secret/data/auth/jwt

echo "storing database configuration..."
curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
     -X POST \
     -d '{
       "data": {
         "path": "/app/data/ft_transcendence.db",
         "max_connections": "10",
         "timeout": "30s"
       }
     }' \
     $VAULT_ADDR/v1/secret/data/database/config

if [ ! -z "$GOOGLE_CLIENT_ID" ] && [ ! -z "$GOOGLE_CLIENT_SECRET" ]; then
  echo "storing Google OAuth secrets..."
  curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
       -X POST \
       -d '{
         "data": {
           "client_id": "'$GOOGLE_CLIENT_ID'",
           "client_secret": "'$GOOGLE_CLIENT_SECRET'",
           "redirect_uri": "'${GOOGLE_REDIRECT_URI}'"
         }
       }' \
       $VAULT_ADDR/v1/secret/data/external/google
fi

if [ ! -z "$GITHUB_CLIENT_ID" ] && [ ! -z "$GITHUB_CLIENT_SECRET" ]; then
  echo "storing Github OAuth secrets..."
  curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
       -X POST \
       -d '{
         "data": {
           "client_id": "'$GITHUB_CLIENT_ID'",
           "client_secret": "'$GITHUB_CLIENT_SECRET'",
           "redirect_uri": "'${GITHUB_REDIRECT_URI}'"
         }
       }' \
       $VAULT_ADDR/v1/secret/data/external/github
fi


if [ ! -z "$SMTP_EMAIL" ] && [ ! -z "$SMTP_PASSWORD" ]; then
  echo "storing SMTP secrets..."
  curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
       -X POST \
       -d "$(jq -n --arg ps "$SMTP_PASSWORD" \
                   '{
                     "data": {
                       "email": "'$SMTP_EMAIL'",
                       "host": "'$SMTP_HOST'",
                       "port": "'$SMTP_PORT'",
                       "password": $ps
                     }
                   }')" \
       $VAULT_ADDR/v1/secret/data/external/smtp
fi

echo "storing 2FA configuration..."
curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
     -X POST \
     -d '{
       "data": {
         "issuer": "ft_transcendence",
         "window": "1",
         "period": "30"
       }
     }' \
     $VAULT_ADDR/v1/secret/data/auth/2fa

echo "storing bcrypt configuration..."
curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
     -X POST \
     -d '{
       "data": {
         "rounds": "'${BCRYPT_ROUNDS:-12}'"
       }
     }' \
     $VAULT_ADDR/v1/secret/data/auth/bcrypt


echo "creating application service token..."
TOKEN_RESPONSE=$(curl -s --insecure -H "X-Vault-Token: $VAULT_TOKEN" \
     -X POST \
     -d '{
       "policies": ["app-policy"],
       "ttl": "168h",
       "renewable": true
     }' \
     $VAULT_ADDR/v1/auth/token/create)

echo "Raw token response: $TOKEN_RESPONSE"

APP_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.auth.client_token' 2>/dev/null)

if [ -z "$APP_TOKEN" ]; then
  APP_TOKEN=$(echo "$TOKEN_RESPONSE" | \
    python3 -c "import sys, json; print(json.load(sys.stdin)['auth']['client_token']" 2>/dev/null)
fi

if [ ! -z "$APP_TOKEN" ]; then
  echo "application token created: $APP_TOKEN"
  echo "APP_VAULT_TOKEN=$APP_TOKEN" > /app/.env.generated
else
  echo "ERROR: not again bruh. failed to create application token:"
  echo "$TOKEN_RESPONSE"
  exit 1
fi

echo "vault initialization complete!"
echo ""
echo "vault UI is at: https://localhost:8200/ui"
echo "root token: $VAULT_TOKEN"
echo "app token: $APP_TOKEN"
