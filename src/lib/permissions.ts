// ============ ROLE-BASED PERMISSION SYSTEM ============

export type AdminRole = 'superadmin' | 'admin' | 'editor' | 'reviewer';

export type Permission =
  // Dashboard
  | 'dashboard:read'
  // Phones
  | 'phones:read' | 'phones:create' | 'phones:edit' | 'phones:delete' | 'phones:publish' | 'phones:seed'
  // Brands
  | 'brands:read' | 'brands:create' | 'brands:edit' | 'brands:delete'
  // News
  | 'news:read' | 'news:create' | 'news:edit' | 'news:delete' | 'news:publish'
  // Sponsors
  | 'sponsors:read' | 'sponsors:manage'
  // Imports
  | 'imports:read' | 'imports:execute'
  // Collectors
  | 'collectors:read' | 'collectors:manage'
  // Users
  | 'users:read' | 'users:manage'
  // Settings
  | 'settings:read' | 'settings:manage'
  // Activity
  | 'activity:read'
  // Media
  | 'media:upload' | 'media:delete'
  // Trash
  | 'trash:read' | 'trash:restore' | 'trash:delete'
  // Videos
  | 'videos:read' | 'videos:edit' | 'videos:manage';

// ============ PERMISSION MAPS ============

const ALL_PERMISSIONS: Permission[] = [
  'dashboard:read',
  'phones:read', 'phones:create', 'phones:edit', 'phones:delete', 'phones:publish', 'phones:seed',
  'brands:read', 'brands:create', 'brands:edit', 'brands:delete',
  'news:read', 'news:create', 'news:edit', 'news:delete', 'news:publish',
  'sponsors:read', 'sponsors:manage',
  'imports:read', 'imports:execute',
  'collectors:read', 'collectors:manage',
  'users:read', 'users:manage',
  'settings:read', 'settings:manage',
  'activity:read',
  'media:upload', 'media:delete',
  'trash:read', 'trash:restore', 'trash:delete',
  'videos:read', 'videos:edit', 'videos:manage',
];

const rolePermissions: Record<AdminRole, Set<Permission>> = {
  superadmin: new Set(ALL_PERMISSIONS),
  admin: new Set<Permission>([
    'dashboard:read',
    'phones:read', 'phones:create', 'phones:edit', 'phones:delete', 'phones:publish', 'phones:seed',
    'brands:read', 'brands:create', 'brands:edit', 'brands:delete',
    'news:read', 'news:create', 'news:edit', 'news:delete', 'news:publish',
    'sponsors:read', 'sponsors:manage',
    'imports:read', 'imports:execute',
    'collectors:read', 'collectors:manage',
    'users:read',
    'settings:read',
    'activity:read',
    'media:upload', 'media:delete',
    'trash:read', 'trash:restore', 'trash:delete',
    'videos:read', 'videos:edit', 'videos:manage',
  ]),
  editor: new Set<Permission>([
    'dashboard:read',
    'phones:read', 'phones:create', 'phones:edit',
    'brands:read',
    'news:read', 'news:create', 'news:edit',
    'activity:read',
    'media:upload',
  ]),
  reviewer: new Set<Permission>([
    'phones:read',
    'brands:read',
    'news:read',
    'activity:read',
    'collectors:read',
  ]),
};

// ============ PUBLIC API ============

/** Check if a given role has a specific permission */
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return rolePermissions[role]?.has(permission) ?? false;
}

/** Get all permissions for a given role */
export function getPermissions(role: AdminRole): Permission[] {
  return Array.from(rolePermissions[role] ?? []);
}

/** Get all defined permissions */
export function getAllPermissions(): Permission[] {
  return [...ALL_PERMISSIONS];
}

/** Get all defined roles */
export function getAllRoles(): AdminRole[] {
  return ['superadmin', 'admin', 'editor', 'reviewer'];
}