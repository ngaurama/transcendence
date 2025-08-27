#we will never be running vault in prod mode guys,
#since its a one command load, so this file is kinda useless, but why not

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
    address = "0.0.0.0:8200"
    tls_cert_file = "/vault/config/cert.pem"
    tls_key_file  = "/vault/config/key.pem"
}

api_addr = "https://0.0.0.0:8200"
cluster_addr = "https://0.0.0.0:8201"

# disable_mlock = true

ui = true

default_lease_ttl = "168h"
max_lease_ttl = "720h"
