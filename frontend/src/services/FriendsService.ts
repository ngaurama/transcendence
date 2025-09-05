import { fetchWithErrorHandling } from ".";

// services/FriendsService.ts
export async function searchUsers(query: string): Promise<any> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/users/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Search failed');
    }

    return await res.json();
  } catch (error) {
    throw error;
  }
}

export async function sendFriendRequest(userId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to send friend request');
    }
  } catch (error) {
    throw error;
  }
}

export async function getFriendsList(): Promise<any[]> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/friends`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to get friends list');
    }

    const data = await res.json();
    return data.friends || [];
  } catch (error) {
    console.error('Get friends error:', error);
    return [];
  }
}

export async function getFriendRequests(): Promise<any[]> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/friends/requests`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to get friend requests');
    }

    const data = await res.json();
    return data.requests || [];
  } catch (error) {
    console.error('Get friend requests error:', error);
    return [];
  }
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/friends/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ request_id: requestId }),
    });

    if (!res.ok) {
      throw new Error('Failed to accept friend request');
    }
  } catch (error) {
    throw error;
  }
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/friends/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ request_id: requestId }),
    });

    if (!res.ok) {
      throw new Error('Failed to reject friend request');
    }
  } catch (error) {
    throw error;
  }
}

export async function removeFriend(userId: number): Promise<void> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/friends/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to remove friend');
    }
  } catch (error) {
    throw error;
  }
}

export async function checkFriendshipStatus(userId: string): Promise<string> {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetchWithErrorHandling(`/api/social/friends/status/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to check friendship status');
    }

    const data = await res.json();
    return data.status;
  } catch (error) {
    console.error('Check friendship status error:', error);
    return 'error';
  }
}
