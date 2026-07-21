'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface PublicUser { id: string; name: string; email: string; emailVerified?: boolean; createdAt?: string }
interface UserContextValue { user: PublicUser | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }
const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/account/me', { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setUser(res.ok ? data.user : null);
    } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const logout = useCallback(async () => {
    await fetch('/api/account/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, loading, refresh, logout }), [user, loading, refresh, logout]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
export function useUser() {
  const value = useContext(UserContext);
  if (!value) throw new Error('useUser must be used inside UserProvider');
  return value;
}
