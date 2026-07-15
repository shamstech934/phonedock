'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Plus, Trash2, Ban, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/lib/useAdmin';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-50 text-purple-700 border-purple-200/50',
  admin: 'bg-blue-50 text-blue-700 border-blue-200/50',
  editor: 'bg-amber-50 text-amber-700 border-amber-200/50',
  reviewer: 'bg-gray-50 text-gray-700 border-gray-200/50',
};

export default function AdminUsersPage() {
  const { admin } = useAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const isSuperAdmin = admin?.role === 'superadmin';

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) { console.error('[fetchUsers]', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    setFormError('');
    if (!form.name || !form.email || !form.password) {
      setFormError('All fields are required');
      return;
    }
    if (form.password.length < 12) {
      setFormError('Password must be at least 12 characters');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreate(false);
        setForm({ name: '', email: '', password: '', role: 'admin' });
        fetchUsers();
      } else {
        setFormError(data.error || 'Failed to create user');
      }
    } catch {
      setFormError('Connection error');
    } finally {
      setFormLoading(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">User Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage admin accounts and roles</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowCreate(true)} size="sm" className="bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="w-4 h-4 mr-1.5" /> Add Admin
          </Button>
        )}
      </div>

      {/* Users Table */}
      <div className="card-premium overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Last Login</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {u.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-xs truncate">{u.name || 'Unnamed'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] font-medium border ${ROLE_COLORS[u.role] || ROLE_COLORS.admin}`}>
                      <Shield className="w-3 h-3 mr-1" />{u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">
                        <CheckCircle className="w-3 h-3 mr-1" />Active
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 text-[10px] font-medium border border-red-200/50">
                        <XCircle className="w-3 h-3 mr-1" />Disabled
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{formatDate(u.lastLogin)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">No admin users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Only superadmins can create or manage admin accounts.</span>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Admin User</h2>
            {formError && <div className="bg-red-50 text-red-600 text-xs rounded-xl px-4 py-2.5 mb-3">{formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="John Doe" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="admin@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Password (12+ chars)</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" placeholder="Strong password" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white">
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowCreate(false); setFormError(''); }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={formLoading} className="flex-1 h-10 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-300 flex items-center justify-center gap-2">
                {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}