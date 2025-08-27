const fetch = require('node-fetch').default;
const https = require('https');
const fs = require('fs');
const path = require('path');

const certPath = path.resolve('/app/certs/server.crt');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  ca: fs.readFileSync(certPath),
});

async function validateToken(token) {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'https://auth-service:3001';
    const response = await fetch(`${authServiceUrl}/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ token }),
      agent: httpsAgent,
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.user;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

module.exports = { validateToken };
