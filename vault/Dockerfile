FROM hashicorp/vault:1.15

COPY ./config/vault.hcl /vault/config/vault.hcl
COPY ./config/policies/ /vault/config/policies/
COPY ./scripts/ /vault/scripts/

RUN apk add --no-cache curl jq

COPY ./scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
