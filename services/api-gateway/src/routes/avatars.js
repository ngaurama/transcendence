const path = require('path');
const fs = require('fs');

async function avatarRoutes(fastify, options) {
  fastify.get('/avatars/*', async (request, reply) => {
    const origin = request.headers.origin;
    const allowedHosts = ['localhost', '127.0.0.1', 'dev.local'];
    
    if (origin) {
      try {
        const hostname = new URL(origin).hostname;
        if (allowedHosts.includes(hostname)) {
          reply.header('Access-Control-Allow-Origin', origin);
        }
      } catch (err) {
        console.warn('Invalid Origin header:', origin);
      }
    }
    
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
    reply.header('Cache-Control', 'public, max-age=86400');
    
    const filename = request.params['*'];
    const filePath = path.join(process.cwd(), '/public/avatars', filename);
    
    try {
      await fs.promises.access(filePath);
      console.log('File exists, serving:', filename);
      const stream = fs.createReadStream(filePath);
      
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 
                        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                        ext === '.gif' ? 'image/gif' : 'application/octet-stream';
      
      reply.type(contentType);
      return reply.send(stream);
      
    } catch (error) {
      console.log('Avatar not found, trying default:', filename, error.message);
      
      const defaultPath = path.join(process.cwd(), '/public/avatars/default.png');
      try {
        await fs.promises.access(defaultPath);
        console.log('Serving default avatar');
        
        const stream = fs.createReadStream(defaultPath);
        reply.type('image/png');
        return reply.send(stream);
        
      } catch (defaultError) {
        console.log('Default avatar als not found');
        reply.code(404).send({ error: 'Avatar not found' });
      }
    }
  });
}

module.exports = avatarRoutes;
