const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');

async function setupSecurity(fastify) {
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", process.env.wwww],
        connectSrc: ["'self'", "ws:", "wss:", process.env.API_URL],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  });
}

async function setupCORS(fastify) {
  await fastify.register(require('@fastify/cors'), {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const hostname = new URL(origin).hostname;
        console.log("HOSTNAME:", hostname);
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.transcendence.local') || hostname.endsWith('.nip.io') || hostname === process.env.LAN_IP || hostname === process.env.HOST) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"), false);
      } catch (err) {
        callback(new Error("Invalid origin"), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });
}

async function setupRateLimiting(fastify) {
  await fastify.register(rateLimit, {
    max: 500,
    timeWindow: '1 minute',
    errorResponseBuilder: function (request, context) {
      return {
        code: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds`,
        date: Date.now(),
        expiresIn: Math.round(context.ttl / 1000)
      };
    }
  });
}

async function setupLogging(fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;
    console.log(`${request.method} ${request.url} - ${reply.statusCode} - ${duration}ms`);
  });
}

module.exports = {
  setupSecurity,
  setupCORS,
  setupRateLimiting,
  setupLogging
};
