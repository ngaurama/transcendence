import { handleApiError, showRateLimitModal } from "../utils/handleApiError";
import { User } from "../utils/types"

export async function checkAuthStatus(): Promise<User | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    const res = await fetchWithErrorHandling(`/api/auth/validate-token`, {
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

export async function fetchWithErrorHandling(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  
  if (response.status === 429) {
    const errorData = await response.json().catch(() => ({}));
    showRateLimitModal(errorData);
    throw new Error('Rate limit exceeded');
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  
  return response;
}

export * from "./AuthService"
export * from "./PasswordService"
export * from "./TwoFAService"
export * from "./PongService"
export * from "./FriendsService"
export * from "./GameInvitationService"
