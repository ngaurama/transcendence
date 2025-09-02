const { validateToken } = require('../utils/auth');
const fetch = require('node-fetch').default;
const https = require('https');
const fs = require('fs');
const path = require('path');

const certPath = path.resolve('/app/certs/server.crt');
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  ca: fs.readFileSync(certPath),
});

async function notifyPongService(type, requesterId, addresseeId, requestId) {
  const pongServiceUrl = process.env.PONG_SERVICE_URL || 'https://pong-service:3003';
  try {
    await fetch(`${pongServiceUrl}/notify/friend-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, requesterId, addresseeId, requestId }),
      agent: httpsAgent,
    });
  } catch (error) {
    console.error('Error notifying pong service:', error);
  }
}

module.exports = function setupFriendsRoutes(fastify, socialService) {
    fastify.get('/users/search', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const { q } = request.query;
      if (!q || q.length < 2) {
        return reply.code(400).send({ error: 'Search query must be at least 2 characters' });
      }

      const users = await socialService.db.all(`
        SELECT id, username, display_name, avatar_url, 
               (SELECT status FROM user_presence WHERE user_id = users.id) as online_status
        FROM users 
        WHERE (username LIKE ? OR display_name LIKE ?) 
          AND is_active = TRUE 
          AND is_guest = FALSE
          AND id != ?
        LIMIT 20
      `, [`%${q}%`, `%${q}%`, user.id]);

      return { users };
    } catch (error) {
      console.error('User search error:', error);
      return reply.code(500).send({ error: 'Search failed' });
    }
  });

  // Send friend request
  
  
  fastify.post('/friends/request', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const currentUser = await validateToken(token);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const { user_id } = request.body;
      
      if (!user_id) {
        return reply.code(400).send({ error: 'User ID required' });
      }

      if (user_id === currentUser.id) {
        return reply.code(400).send({ error: 'Cannot add yourself as friend' });
      }

      const user = await socialService.db.get(
        'SELECT id FROM users WHERE id = ? AND is_active = TRUE AND is_guest = FALSE',
        [user_id]
      );

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const existingFriendship = await socialService.db.get(`
        SELECT * FROM friendships 
        WHERE (requester_id = ? AND addressee_id = ?) 
           OR (requester_id = ? AND addressee_id = ?)
      `, [currentUser.id, user_id, user_id, currentUser.id]);

      if (existingFriendship) {
        const statusMap = {
          'pending': 'Friend request already pending',
          'accepted': 'Already friends',
          'blocked': 'Cannot send friend request',
          'rejected': 'Friend request was previously rejected'
        };
        return reply.code(400).send({ error: statusMap[existingFriendship.status] });
      }

      const result = await socialService.db.run(`
        INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES (?, ?, 'pending')
      `, [currentUser.id, user_id]);

      const requestId = result.lastID;

      await socialService.db.run(`
        INSERT INTO friend_requests (from_user_id, to_user_id, status)
        VALUES (?, ?, 'pending')
      `, [currentUser.id, user_id]);

      await notifyPongService('sent', currentUser.id, user_id, requestId);
      return { success: true, message: 'Friend request sent' };
    } catch (error) {
      console.error('Friend request error:', error);
      return reply.code(500).send({ error: 'Failed to send friend request' });
    }
  });

  // Get pending friend requests
  fastify.get('/friends/requests', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const requests = await socialService.db.all(`
        SELECT fr.id, fr.from_user_id, fr.created_at,
               u.username, u.display_name, u.avatar_url
        FROM friend_requests fr
        JOIN users u ON u.id = fr.from_user_id
        WHERE fr.to_user_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `, [user.id]);

      return { requests };
    } catch (error) {
      console.error('Get friend requests error:', error);
      return reply.code(500).send({ error: 'Failed to get friend requests' });
    }
  });

  // Accept friend request
  fastify.post('/friends/accept', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const currentUser = await validateToken(token);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const { request_id } = request.body;
      
      if (!request_id) {
        return reply.code(400).send({ error: 'Request ID required' });
      }

      // Get the request
      const friendRequest = await socialService.db.get(`
        SELECT * FROM friend_requests 
        WHERE id = ? AND to_user_id = ? AND status = 'pending'
      `, [request_id, currentUser.id]);

      if (!friendRequest) {
        return reply.code(404).send({ error: 'Friend request not found' });
      }

      // Update friendship status
      await socialService.db.run(`
        UPDATE friendships 
        SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
        WHERE requester_id = ? AND addressee_id = ?
      `, [friendRequest.from_user_id, currentUser.id]);

      // Update request status
      await socialService.db.run(`
        UPDATE friend_requests 
        SET status = 'accepted'
        WHERE id = ?
      `, [request_id]);

      await notifyPongService('accepted', friendRequest.from_user_id, currentUser.id);      return { success: true, message: 'Friend request accepted' };
    } catch (error) {
      console.error('Accept friend request error:', error);
      return reply.code(500).send({ error: 'Failed to accept friend request' });
    }
  });

  // Reject friend request
  fastify.post('/friends/reject', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const currentUser = await validateToken(token);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const { request_id } = request.body;
      
      if (!request_id) {
        return reply.code(400).send({ error: 'Request ID required' });
      }

      const friendRequest = await socialService.db.get(`
        SELECT * FROM friend_requests 
        WHERE id = ? AND to_user_id = ? AND status = 'pending'
      `, [request_id, currentUser.id]);

      if (!friendRequest) {
        return reply.code(404).send({ error: 'Friend request not found' });
      }

      await socialService.db.run(`
        UPDATE friend_requests 
        SET status = 'rejected'
        WHERE id = ? AND to_user_id = ?
      `, [request_id, currentUser.id]);

      await socialService.db.run(`
        UPDATE friendships 
        SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
        WHERE requester_id = (SELECT from_user_id FROM friend_requests WHERE id = ?) 
          AND addressee_id = ?
      `, [request_id, currentUser.id]);

      await notifyPongService('rejected', friendRequest.from_user_id, currentUser.id);
      return { success: true, message: 'Friend request rejected' };
    } catch (error) {
      console.error('Reject friend request error:', error);
      return reply.code(500).send({ error: 'Failed to reject friend request' });
    }
  });

  // Get friends list
  fastify.get('/friends', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const user = await validateToken(token);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const friends = await socialService.db.all(`
        SELECT 
          u.id, u.username, u.display_name, u.avatar_url,
          up.status as online_status,
          up.current_activity,
          up.last_seen_at
        FROM friendships f
        JOIN users u ON (
          (f.requester_id = u.id AND f.addressee_id = ?) OR 
          (f.addressee_id = u.id AND f.requester_id = ?)
        )
        LEFT JOIN user_presence up ON up.user_id = u.id
        WHERE f.status = 'accepted'
        ORDER BY up.status = 'online' DESC, u.display_name
      `, [user.id, user.id]);

      return { friends };
    } catch (error) {
      console.error('Get friends error:', error);
      return reply.code(500).send({ error: 'Failed to get friends list' });
    }
  });

  // Remove friend
  fastify.delete('/friends/:friend_id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const currentUser = await validateToken(token);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const friend_id = parseInt(request.params.friend_id);
      
      if (!friend_id) {
        return reply.code(400).send({ error: 'Friend ID required' });
      }

      // Delete friendship
      const result = await socialService.db.run(`
        DELETE FROM friendships 
        WHERE ((requester_id = ? AND addressee_id = ?) 
        OR (requester_id = ? AND addressee_id = ?))
          AND status = 'accepted'
      `, [currentUser.id, friend_id, friend_id, currentUser.id]);

      await socialService.db.run(`
        DELETE FROM friend_requests 
        WHERE (from_user_id = ? AND to_user_id = ?)
          OR (from_user_id = ? AND to_user_id = ?)
      `, [currentUser.id, friend_id, friend_id, currentUser.id]);

      if (result.changes === 0) {
        return reply.code(404).send({ error: 'Friendship not found' });
      }

      return { success: true, message: 'Friend removed' };
    } catch (error) {
      console.error('Remove friend error:', error);
      return reply.code(500).send({ error: 'Failed to remove friend' });
    }
  });

  // Check friendship status
  fastify.get('/friends/status/:user_id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const currentUser = await validateToken(token);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const user_id = parseInt(request.params.user_id);
      
      if (!user_id) {
        return reply.code(400).send({ error: 'User ID required' });
      }

      const friendship = await socialService.db.get(`
        SELECT status FROM friendships 
        WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      `, [currentUser.id, user_id, user_id, currentUser.id]);

      return { status: friendship?.status || 'not_friends' };
    } catch (error) {
      console.error('Friendship status error:', error);
      return reply.code(500).send({ error: 'Failed to check friendship status' });
    }
  });
};
