import { fetchWithErrorHandling } from ".";
import { User } from "../utils/types"

export async function verify2FACode(code: string): Promise<User> {
  const tempToken = localStorage.getItem('temp_token');
  if (!tempToken) throw new Error('No 2FA session');

  try {
    const res = await fetchWithErrorHandling(`/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token: tempToken, code }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '2FA verification failed');
    }

    localStorage.removeItem('temp_token');
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data.user;
  } catch (error) {
    throw error;
  }
}

export async function setup2FA(token: string): Promise<{ secret: string; qr_code: string }> {
  try {
    const res = await fetchWithErrorHandling(`/api/auth/setup-2fa`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      },
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '2FA setup failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

export async function enable2FA(token: string, code: string): Promise<void> {
  try {
    const res = await fetchWithErrorHandling(`/api/auth/enable-2fa`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to enable 2FA');
    }
  } catch (error) {
    throw error;
  }
}
