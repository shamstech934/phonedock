'use client';

import { Users, Shield, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

export default function AdminUsersPage() {
  const { admin } = useAdmin();

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">User Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage admin accounts and roles</p>
        </div>
      </div>

      <div className="card-premium p-5 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-blue-500" />
          </div>
          <h2 className="font-bold text-sm text-gray-900">Current Admin</h2>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-900">{admin?.name || 'Admin User'}</h3>
            <p className="text-xs text-muted-foreground">{admin?.email || 'admin@phonedock.pk'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200/50">
              <Shield className="w-3 h-3 mr-1" />{admin?.role || 'admin'}
            </Badge>
            <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">Active</Badge>
          </div>
        </div>
      </div>

      <div className="card-premium p-8 text-center animate-fade-in">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="font-bold text-gray-900 mb-2">Full User Management Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
          Multi-admin support, role-based permissions, invitation system, and activity tracking for admin users are currently under development.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
          {[
            { label: 'Multi-Admin', desc: 'Add & manage multiple admins' },
            { label: 'Role System', desc: 'Editor, viewer, superadmin roles' },
            { label: 'Invitations', desc: 'Email invite & onboarding flow' },
          ].map(item => (
            <div key={item.label} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-900">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <AlertCircle className="w-3 h-3" />
          <span>Currently only the logged-in admin is displayed. Contact the system administrator for access changes.</span>
        </div>
      </div>
    </div>
  );
}