import { User } from "../utils/types"

export async function checkAuthStatus(): Promise<User | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    const res = await fetch(`/api/auth/validate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      return null;
    }
    
    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error('Auth status check failed:', error);
    return null;
  }
}


export * from "./AuthService"
export * from "./PasswordService"
export * from "./TwoFAService"
export * from "./PongService"
