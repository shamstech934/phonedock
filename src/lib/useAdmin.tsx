'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ============ TYPES ============

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AdminAuthState {
  admin: AdminUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

// ============ CONTEXT ============

const AdminAuthContext = createContext<AdminAuthState>({
  admin: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => false,
});

export function useAdmin(): AdminAuthState {
  return useContext(AdminAuthContext);
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch current session from server (cookie-based) — no localStorage
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/session', {
        credentials: 'include', // Send httpOnly cookie
      });
      if (res.ok) {
        const data = await res.json();
        if (data.admin) {
          setAdmin(data.admin);
          return true;
        }
      }
      setAdmin(null);
      return false;
    } catch {
      setAdmin(null);
      return false;
    }
  }, []);

  // On mount, verify session via cookie
  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  // Login: POST credentials, server sets httpOnly cookie, we get admin info
  const login = useCallback(async () => {
    // After successful login POST, refresh session to get admin data
    const success = await refreshSession();
    if (success) {
      router.push('/admin/dashboard');
    }
  }, [refreshSession, router]);

  // Logout: POST to server to revoke session + clear cookie
  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue with local cleanup even if request fails
    }
    setAdmin(null);
    router.push('/admin/login');
  }, [router]);

  // Redirect to login if not authenticated on admin pages
  useEffect(() => {
    if (!loading && !admin && pathname.startsWith('/admin') && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [admin, loading, pathname, router]);

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, refreshSession }}>
      {children}
    </AdminAuthContext.Provider>
  );
}