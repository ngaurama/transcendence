const https = require('https');
const fs = require('fs');
const config = require('../config');
const fetch = require('node-fetch').default;

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  ca: config.certPath,
});

async function authenticateRequest(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return reply.code(401).send({ error: 'Access token required' });
    }

    const response = await fetch(`${config.services.auth}/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ token }),
      agent: httpsAgent,
    });

    if (!response.ok) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const { user } = await response.json();

    request.headers['x-user-id'] = user.id.toString();
    request.headers['x-username'] = user.username;
    request.headers['x-user-email'] = user.email;

  } catch (error) {
    console.error('Authentication error:', error);
    return reply.code(500).send({ error: 'Authentication service unavailable' });
  }
}

module.exports = {
  authenticateRequest
};
