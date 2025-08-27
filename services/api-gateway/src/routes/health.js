const https = require('https');
const fs = require('fs');
const config = require('../config');
const fetch = require('node-fetch').default;

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  ca: config.certPath,
});

async function healthRoutes(fastify, options) {
  fastify.get('/health', async (request, reply) => {
    const healthChecks = {};

    for (const [serviceName, serviceUrl] of Object.entries(config.services)) {
      if (serviceName === 'serviceConfigs') continue;
      
      try {
        const response = await fetch(`${serviceUrl}/health`, {
          method: 'GET',
          timeout: 5000,
          agent: httpsAgent,
        });
        healthChecks[serviceName] = {
          status: response.ok ? 'healthy' : 'unhealthy',
          statusCode: response.status
        };
      } catch (error) {
        healthChecks[serviceName] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    const allHealthy = Object.values(healthChecks).every(check => check.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: healthChecks
    };
  });
}

module.exports = healthRoutes;
