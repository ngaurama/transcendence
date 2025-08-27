import { User } from "../utils/types"

export async function login(username: string, password: string): Promise<{ requires2FA?: boolean; user?: User }> {
  try {
    const res = await fetch(`/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await res.json();
    
    if (data.requires_2fa) {
      localStorage.setItem('temp_token', data.temp_token);
      return { requires2FA: true };
    }

    if (data.success) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      return { user: data.user };
    }

    throw new Error(data.error || 'Login failed');
  } catch (error) {
    throw error;
  }
}

export async function register(
  username: string,
  email: string,
  password: string,
  displayName: string,
  acceptGdpr: boolean
): Promise<User> {
  try {
    const res = await fetch(`/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username, 
        email,
        password, 
        display_name: displayName,
        accept_gdpr: acceptGdpr 
      }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data.user;
  } catch (error) {
    throw error;
  }
}

export async function logout(): Promise<void> {
  const token = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');

  if (token && refreshToken) {
    try {
      await fetch(`/api/auth/logout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  localStorage.clear();
}

export async function uploadAvatar(token: string, file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`/api/auth/upload-avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Avatar upload failed');
    }

    return data.avatar_url;
  } catch (error) {
    throw error;
  }
}

export async function guestLogin(alias: string): Promise<{ user: User; access_token: string; refresh_token: string }> {
  try {
    const res = await fetch(`/api/auth/guest-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Guest login failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

export function initiateOAuth(provider: 'google' | 'github'): void {
  window.location.href = `/api/auth/oauth/${provider}`;
}
