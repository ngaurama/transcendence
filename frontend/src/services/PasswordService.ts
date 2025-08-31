export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  try {
    const res = await fetch(`/api/auth/change-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Password change failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

export async function forgotPassword(email: string): Promise<void> {
  try {
    const res = await fetch(`/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Password reset request failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

export async function validateResetToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/auth/validate-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Token validation failed');
    }

    return data.valid;
  } catch (error) {
    throw error;
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  try {
    const res = await fetch(`/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Password reset failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}
