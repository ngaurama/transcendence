// proxy-routes.js
const httpProxy = require('@fastify/http-proxy');
const config = require('../config');
const { authenticateRequest } = require('../middleware/authentication');
const isProtectedRoutes = require('../utils/route-protection');

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function authProxy(fastify, options) {
  await fastify.register(httpProxy, {
    upstream: config.services.auth,
    prefix: '/auth',
    rewritePrefix: '/',
    websocket: false,
    preHandler: async (request, reply) => {
      request.headers['x-request-id'] = generateRequestId();
      console.log(`Auth Request: ${request.method} ${request.url}`);
    }
  });
}

async function pongProxy(fastify, options) {
  await fastify.register(httpProxy, {
    upstream: config.services.pong,
    prefix: '/pong',
    rewritePrefix: '/',
    websocket: true,
    preHandler: async (request, reply) => {
      request.headers['x-request-id'] = generateRequestId();

      if (isProtectedRoutes.isProtectedPongRoute(request.url)) {
        await authenticateRequest(request, reply);
      }

      console.log(`Pong Request: ${request.method} ${request.url}`);
    }
  });
}

async function socialProxy(fastify, options) {
  await fastify.register(httpProxy, {
    upstream: config.services.social,
    prefix: '/social',
    rewritePrefix: '/',
    websocket: true,
    preHandler: async (request, reply) => {
      request.headers['x-request-id'] = generateRequestId();
      
      // if (isProtectedRoutes.isProtectedSocialRoute(request.url)) {
      //   await authenticateRequest(request, reply);
      // }

      console.log(`Social Request: ${request.method} ${request.url}`);
    }
  });
}

async function proxyRoutes(fastify, options) {
  await fastify.register(authProxy);
  await fastify.register(pongProxy);
  await fastify.register(socialProxy);
}

module.exports = proxyRoutes;
