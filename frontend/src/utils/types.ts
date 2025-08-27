export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  is_verified: boolean;
  oauth_provider?: string;
  totp_enabled?: boolean;
  is_guest?: boolean;
}
