require("dotenv").config({ path: "/secrets/.env.generated" });

const vault = require("node-vault")({
  apiVersion: "v1",
  endpoint: process.env.VAULT_ADDR,
  token: process.env.APP_VAULT_TOKEN,
  requestOptions: {
    rejectUnauthorized: false,
  },
});

async function loadSecrets() {
  const secrets = {
    auth: {},
    external: {},
    database: {},
  };

  const load = async (path, target, key) => {
    try {
      const resp = await vault.read(path);
      target[key] = resp.data.data;
      console.info(`Loaded secret: ${path}`);
      return true;
    } catch (err) {
      const status = err?.response?.statusCode || "unknown";
      
      if (status === 404) {
        console.warn(`Secret not found at ${path} - this is expected if not configured`);
        target[key] = null;
        return false;
      }
      
      const errors = JSON.stringify(err?.response?.body?.errors || []);
      console.error(
        `Failed to load secret at ${path} (status: ${status}, errors: ${errors})`
      );
      throw err;
    }
  };

  await Promise.all([
    load("secret/data/auth/bcrypt", secrets.auth, "bcrypt"),
    load("secret/data/auth/jwt", secrets.auth, "jwt"),
    load("secret/data/database/config", secrets.database, "config")
  ]);

  await Promise.allSettled([
    load("secret/data/external/github", secrets.external, "github"),
    load("secret/data/external/google", secrets.external, "google"),
    load("secret/data/external/fortytwo", secrets.external, "fortytwo"),
    load("secret/data/external/smtp", secrets.external, "smtp")
  ]);

  return secrets;
}

module.exports = { loadSecrets };
