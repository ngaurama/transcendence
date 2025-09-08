FROM node:22-alpine

WORKDIR /app

RUN mkdir -p /app/data /app/public/avatars && \
    chown -R node:node /app && \
    chmod -R 755 /app/public/avatars

COPY package*.json ./

RUN npm ci --only=production

COPY src/ ./src/
COPY public/ ./public/

RUN chown -R node:node /app

USER node

EXPOSE 3001

# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node -e "require('https').get('https://localhost:3000/health', (res) => { \
#     process.exit(res.statusCode === 200 ? 0 : 1) \
#   }).on('error', () => { process.exit(1) })"

CMD ["npm", "start"]
