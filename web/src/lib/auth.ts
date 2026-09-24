export type UserRole = 'ADMIN' | 'AE' | 'QC' | 'CONTACT_CENTER';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  user_code: string;
}

const TOKEN_KEY = 'pmt_token';
const USER_KEY = 'pmt_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: User, remember: boolean = true): void {
  if (typeof window === 'undefined') return;
  // Always save to session storage
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));

  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
