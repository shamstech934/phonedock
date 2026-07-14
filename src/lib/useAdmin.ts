'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AdminUser { id: string; email: string; name: string; role: string; }

export function useAdmin() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('pd_admin');
    const storedToken = localStorage.getItem('pd_token');
    if (stored && storedToken) {
      try {
        setAdmin(JSON.parse(stored));
        setToken(storedToken);
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = (a: AdminUser, t: string) => {
    localStorage.setItem('pd_admin', JSON.stringify(a));
    localStorage.setItem('pd_token', t);
    setAdmin(a);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem('pd_admin');
    localStorage.removeItem('pd_token');
    setAdmin(null);
    setToken(null);
    router.push('/admin/login');
  };

  return { admin, token, loading, login, logout };
}